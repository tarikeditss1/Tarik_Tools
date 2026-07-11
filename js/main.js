document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

function queryAll(selector) {
    var list = document['querySelectorAll'](selector);
    var arr = [];
    for (var i = 0; i < list.length; i++) {
        arr.push(list[i]);
    }
    return arr;
}

// ============================================================

//  SpeedFlow Pro – main.js

// ============================================================

var cs = new CSInterface();

// Persistent Settings File Helper
var settingsFile = '';
try {
    var os = require('os');
    var path = require('path');
    var fs = require('fs');
    settingsFile = path.join(os.homedir(), '.speedgraph_pro_settings.json');
    var oldSettingsFile = path.join(os.homedir(), '.speedflow_pro_settings.json');
    
    // Migrate old settings to new settings file if it exists and new one doesn't
    if (fs.existsSync(oldSettingsFile) && !fs.existsSync(settingsFile)) {
        try {
            fs.writeFileSync(settingsFile, fs.readFileSync(oldSettingsFile, 'utf8'), 'utf8');
        } catch(e) {}
    }
} catch(e) {}

function getPersistedSettings() {
    if (!settingsFile) return {};
    try {
        var fs = require('fs');
        if (fs.existsSync(settingsFile)) {
            var data = fs.readFileSync(settingsFile, 'utf8');
            return JSON.parse(data) || {};
        }
    } catch(e) {}
    return {};
}

function savePersistedSettings(obj) {
    if (!settingsFile) return;
    try {
        var fs = require('fs');
        var current = getPersistedSettings();
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                current[k] = obj[k];
            }
        }
        fs.writeFileSync(settingsFile, JSON.stringify(current, null, 2), 'utf8');
    } catch(e) {}
}

// Restore localStorage from disk on startup
try {
    var settings = getPersistedSettings();
    for (var k in settings) {
        if (settings.hasOwnProperty(k)) {
            var val = settings[k];
            if (typeof val === 'object') {
                localStorage.setItem(k, JSON.stringify(val));
            } else {
                localStorage.setItem(k, String(val));
            }
        }
    }
} catch(e) {}

// Override localStorage.setItem to auto-save to disk
var _origSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    _origSetItem.call(localStorage, key, value);
    try {
        var obj = {};
        obj[key] = value;
        savePersistedSettings(obj);
    } catch(e) {}
};



// ── TOAST ──────────────────────────────────────────────────

var toastTimeout = null;

function showToast(msg, duration) {
    duration = duration !== undefined ? duration : 1500;

    var t = document.getElementById('toast');

    t.textContent = msg;

    t.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(function () { t.classList.remove('show'); }, duration);

}



// ── AE BRIDGE ──────────────────────────────────────────────

function runScript(script, cb) {

    cs.evalScript(script, function (res) { if (cb) cb(res); });

}



// ── TABS ────────────────────────────────────────────────────

queryAll('.tab').forEach(function (tab) {

    tab.addEventListener('click', function () {

        queryAll('.tab').forEach(function (t) { t.classList.remove('active'); });

        queryAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });

        tab.classList.add('active');

        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

    });

});



// ── KATMAN BUTONLARI ────────────────────────────────────────

var layerBtns = {

    btnPrecomp:     ['doPrecomp()', '✓ Pre-Comp yapıldı'],

    btnAklliKopya:  ['trueDuplicate()', '✓ Bağımsız kopyalama yapıldı'],

    btnTemizle:     ['cleanLayers()', '✓ Katmanlar temizlendi'],

    btnTersCevir:   ['reverseLayerOrder()', '✓ Sıra ters çevrildi']

};



Object.keys(layerBtns).forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', function (e) {
            if (window.isEditLayoutMode) return;
            var shiftKey = e.shiftKey ? "true" : "false";
            var fps = document.getElementById('inpPreCompFPS') ? document.getElementById('inpPreCompFPS').value : 60;
            var scriptName = layerBtns[id][0];
            
            if (id === 'btnTemizle') {
                var cEffects = document.getElementById('chkCleanEffects') ? document.getElementById('chkCleanEffects').checked : true;
                var cMasks = document.getElementById('chkCleanMasks') ? document.getElementById('chkCleanMasks').checked : true;
                var cKeys = document.getElementById('chkCleanKeys') ? document.getElementById('chkCleanKeys').checked : true;
                var cExpr = document.getElementById('chkCleanExpr') ? document.getElementById('chkCleanExpr').checked : false;
                var cTrans = document.getElementById('chkCleanTransform') ? document.getElementById('chkCleanTransform').checked : false;
                scriptName = 'cleanLayers(' + cEffects + ', ' + cMasks + ', ' + cKeys + ', ' + cExpr + ', ' + cTrans + ')';
            } else {
                scriptName = scriptName.replace('()', '(' + shiftKey + ', ' + fps + ')');
            }
            
            runScript(scriptName, function (res) {
                if (res && res.indexOf('ERROR:') === 0) {
                    window.showAlert(res.substring(6));
                } else {
                    showToast(layerBtns[id][1]);
                }
            });
        });
    }
});





// ═══════════════════════════════════════════════════════════
//  FLOW TAB – İnteraktif Bezier Canvas (AE Graph Editor ile Birebir Uyumlu)
// ═══════════════════════════════════════════════════════════

// AE ease state — these hold the values that get sent to AE
var slSpeedIn      = { value: 0   };
var slSpeedOut     = { value: 0   };
var slInfluenceIn  = { value: 33  };
var slInfluenceOut = { value: 33  };

var canvas     = document.getElementById('curveCanvas');
var ctx        = canvas.getContext('2d');
var curveLabel = document.getElementById('curveLabel');

var CW = canvas.width;
var CH = canvas.height;

// Canvas layout — square box centered with padding for labels
var PAD   = 24;
var BOX_W = CW - PAD * 2;
var BOX_H = CH - PAD * 2;

// Normalized Bezier control points (AE Graph Editor mapping)
// cp1 = Out handle from start keyframe: cp1.x = outInfluence/100, cp1.y=0 → speed=0 at start
// cp2 = In  handle into end  keyframe: cp2.x = 1-inInfluence/100, cp2.y=1 → speed=0 at end
// These match AE Easy Ease: influence 33%, speed 0
var cp1 = { x: 0.33, y: 0.00 };
var cp2 = { x: 0.67, y: 1.00 };
try {
    var savedCp1 = localStorage.getItem('flowease_cp1');
    var savedCp2 = localStorage.getItem('flowease_cp2');
    if (savedCp1) cp1 = JSON.parse(savedCp1);
    if (savedCp2) cp2 = JSON.parse(savedCp2);
} catch(e) {}

var activeFlowType = 'ease';
var graphMode = localStorage.getItem('flowease_graphMode') || 'value';

// Presets mapped to AE's actual ease behavior:
//   cp1.y = 0           → speed=0 at start (Easy Ease on out handle)
//   cp1.y = cp1.x       → linear slope at start
//   cp2.y = 1           → speed=0 at end   (Easy Ease on in handle)
//   cp2.y = cp2.x       → linear slope at end (cp2.y=cp2.x means slope=(1-cp2.x)/(1-cp2.x)=1)
var PRESETS = {
    'ease'     : { cp1:[0.33, 0.00], cp2:[0.67, 1.00], label:'Easy Ease'  },  // F9 — 33% inf, speed=0 both ends
    'ease-in'  : { cp1:[0.33, 0.00], cp2:[0.67, 0.67], label:'Ease In'    },  // Slow start, linear end
    'ease-out' : { cp1:[0.33, 0.33], cp2:[0.67, 1.00], label:'Ease Out'   },  // Linear start, slow end
    'linear'   : { cp1:[0.33, 0.33], cp2:[0.67, 0.67], label:'Linear'     }   // Constant speed
};


var flipY = false;
try {
    var savedFlipY = localStorage.getItem('flowease_flipY');
    if (savedFlipY) flipY = (savedFlipY === 'true');
} catch(e) {}

var btnFlipY = document.getElementById('btnFlipY');
if (btnFlipY) {
    if (flipY) {
        btnFlipY.style.color = '#2e8ff5';
        btnFlipY.style.borderColor = '#2e8ff5';
    }
    btnFlipY.addEventListener('click', function() {
        flipY = !flipY;
        if (flipY) {
            btnFlipY.style.color = '#2e8ff5';
            btnFlipY.style.borderColor = '#2e8ff5';
        } else {
            btnFlipY.style.color = 'var(--text-dim)';
            btnFlipY.style.borderColor = 'var(--border)';
        }
        localStorage.setItem('flowease_flipY', String(flipY));
        drawFlow();
    });
}

// Convert normalized (0-1, y=0 bottom) → canvas pixels
// AE Value Graph: bottom = 0 (start value), top = 1 (end value)
function toCanvas(nx, ny) {
    var mappedY = flipY ? ny : (1 - ny);
    return {
        x: PAD + nx * BOX_W,
        y: PAD + mappedY * BOX_H
    };
}

// Convert canvas pixels → normalized (clamp X, allow Y outside 0-1 for overshoot)
function fromCanvas(cx, cy) {
    var nx = Math.max(0.001, Math.min(0.999, (cx - PAD) / BOX_W));
    var rawNy = (cy - PAD) / BOX_H;
    var ny = flipY ? rawNy : (1 - rawNy);
    return {
        x: nx,
        y: ny
    };
}

function drawFlow() {
    ctx.clearRect(0, 0, CW, CH);

    var p0 = toCanvas(0, 0);
    var p3 = toCanvas(1, 1);
    var c1 = toCanvas(cp1.x, cp1.y);
    var c2 = toCanvas(cp2.x, cp2.y);

    // ── Background box outline ──────────────────────────────
    ctx.strokeStyle = 'rgba(91,164,245,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, PAD, BOX_W, BOX_H);

    // ── Diagonal guide (linear reference) ──────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p3.x, p3.y); ctx.stroke();
    ctx.setLineDash([]);

    // ── Grid lines ──────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (var g = 1; g < 4; g++) {
        var gx = PAD + BOX_W * g / 4;
        var gy = PAD + BOX_H * g / 4;
        ctx.beginPath(); ctx.moveTo(gx, PAD); ctx.lineTo(gx, PAD + BOX_H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(PAD + BOX_W, gy); ctx.stroke();
    }

    if (graphMode === 'speed') {
        // ── SPEED GRAPH (hız eğrisi — AE speed graph gibi) ──
        // Speed = derivative of value bezier w.r.t. X (time)
        ctx.strokeStyle = 'rgba(91,164,245,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        var pts = [];
        for (var i = 0; i <= 200; i++) {
            var t = i / 200;
            var mt = 1 - t;
            // Bezier X and Y at parameter t
            var bx = 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t;
            var dx_dt = 3*mt*mt*cp1.x + 6*mt*t*(cp2.x - cp1.x) + 3*t*t*(1 - cp2.x);
            var dy_dt = 3*mt*mt*cp1.y + 6*mt*t*(cp2.y - cp1.y) + 3*t*t*(1 - cp2.y);
            var speed = (Math.abs(dx_dt) > 0.0001) ? (dy_dt / dx_dt) : 0;
            pts.push({ bx: bx, speed: speed });
        }

        // Normalize speed to box height (max visible speed = 2x linear)
        var maxSpd = 2.0;
        for (var i = 0; i < pts.length; i++) {
            var cx2 = PAD + pts[i].bx * BOX_W;
            var normSpd = Math.min(1, Math.max(0, pts[i].speed / maxSpd));
            var cy2 = flipY ? (PAD + normSpd * BOX_H) : (PAD + BOX_H - normSpd * BOX_H);
            if (i === 0) ctx.moveTo(cx2, cy2);
            else ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();

        // Speed graph handles on baseline
        var BASELINE = flipY ? PAD : (PAD + BOX_H);
        var sh1 = { x: PAD + cp1.x * BOX_W, y: BASELINE };
        var sh2 = { x: PAD + cp2.x * BOX_W, y: BASELINE };
        var sp0 = { x: PAD,           y: BASELINE };
        var sp3 = { x: PAD + BOX_W,   y: BASELINE };

        ctx.strokeStyle = 'rgba(47,128,237,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sp0.x, sp0.y); ctx.lineTo(sh1.x, sh1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sp3.x, sp3.y); ctx.lineTo(sh2.x, sh2.y); ctx.stroke();

        [sp0, sp3, sh1, sh2].forEach(function(pt, idx) {
            ctx.beginPath(); ctx.arc(pt.x, pt.y, idx < 2 ? 5 : 6, 0, Math.PI * 2);
            ctx.fillStyle = idx < 2 ? 'rgba(255,255,255,0.8)' : '#2f80ed';
            ctx.fill();
        });

        lastHandles = { p0: sp0, p3: sp3, c1: sh1, c2: sh2 };

    } else {
        // ── VALUE GRAPH (değer eğrisi — AE value graph gibi) ──
        ctx.lineWidth = 2.5;

        // Check for overshoot (Y outside 0-1)
        var hasOvershoot = (cp1.y < 0 || cp1.y > 1 || cp2.y < 0 || cp2.y > 1);
        if (hasOvershoot) {
            // Clipped gradient for overshoot indication
            ctx.strokeStyle = 'rgba(255,160,50,0.9)';
        } else {
            ctx.strokeStyle = 'rgba(91,200,255,0.95)';
        }

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
        ctx.stroke();

        // Clamp handle drawings visually to remain inside the canvas view
        var c1_draw = {
            x: c1.x,
            y: Math.min(CH - 8, Math.max(8, c1.y))
        };
        var c2_draw = {
            x: c2.x,
            y: Math.min(CH - 8, Math.max(8, c2.y))
        };

        // Handle lines
        ctx.strokeStyle = 'rgba(47,128,237,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(c1_draw.x, c1_draw.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(c2_draw.x, c2_draw.y); ctx.stroke();

        // Anchor points (start/end) — white circles
        [p0, p3].forEach(function(pt) {
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
        });

        // Control handles — blue circles
        [c1_draw, c2_draw].forEach(function(pt) {
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#2f80ed'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        lastHandles = { p0: p0, p3: p3, c1: c1_draw, c2: c2_draw };
    }

    // ── Axis labels ─────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('0', PAD - 12, PAD + BOX_H + 3);
    ctx.fillText('1', PAD + BOX_W - 3, PAD + BOX_H + 12);

    // ── Update influence/speed display ──────────────────────
    updateInfoFromCurve();
}

function updateInfoFromCurve() {
    // Out influence = cp1.x * 100 (how far along time the out handle reaches)
    var outInf = Math.round(cp1.x * 100);
    // In influence = (1 - cp2.x) * 100 (how far from end the in handle reaches)
    var inInf  = Math.round((1 - cp2.x) * 100);
    // Speeds from slope: out speed slope = cp1.y / cp1.x, in speed slope = (1 - cp2.y) / (1 - cp2.x)
    var outSpeedRaw = cp1.x > 0.001 ? cp1.y / cp1.x : 0;
    var inSpeedRaw  = (1 - cp2.x) > 0.001 ? (1 - cp2.y) / (1 - cp2.x) : 0;

    slInfluenceOut.value = outInf;
    slInfluenceIn.value  = inInf;
    // Store normalized slopes — will be scaled by actual value delta in ExtendScript
    slSpeedOut.value = Math.round(outSpeedRaw * 100) / 100;
    slSpeedIn.value  = Math.round(inSpeedRaw  * 100) / 100;

    // Update display labels if they exist
    var elOutInf = document.getElementById('dispOutInf');
    var elInInf  = document.getElementById('dispInInf');
    var elOutSpd = document.getElementById('dispOutSpd');
    var elInSpd  = document.getElementById('dispInSpd');
    if (elOutInf) elOutInf.textContent = outInf + '%';
    if (elInInf)  elInInf.textContent  = inInf  + '%';
    if (elOutSpd) elOutSpd.textContent = (outSpeedRaw * 100).toFixed(0);
    if (elInSpd)  elInSpd.textContent  = (inSpeedRaw  * 100).toFixed(0);

    // Also sync cp input boxes
    var i1x = document.getElementById('inpCp1x');
    var i1y = document.getElementById('inpCp1y');
    var i2x = document.getElementById('inpCp2x');
    var i2y = document.getElementById('inpCp2y');
    if (i1x && document.activeElement !== i1x) i1x.value = cp1.x.toFixed(3);
    if (i1y && document.activeElement !== i1y) i1y.value = cp1.y.toFixed(3);
    if (i2x && document.activeElement !== i2x) i2x.value = cp2.x.toFixed(3);
    if (i2y && document.activeElement !== i2y) i2y.value = cp2.y.toFixed(3);
}

// ── Mouse Drag ───────────────────────────────────────────────
var dragging   = null;
var HIT_RADIUS = 12;
var lastHandles = { p0:{x:0,y:0}, p3:{x:0,y:0}, c1:{x:0,y:0}, c2:{x:0,y:0} };

function getMousePos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (CW / rect.width),
        y: (e.clientY - rect.top)  * (CH / rect.height)
    };
}

function ptDist(ax, ay, bx, by) {
    return Math.sqrt((ax-bx)*(ax-bx) + (ay-by)*(ay-by));
}

canvas.addEventListener('mousedown', function(e) {
    var m = getMousePos(e);
    if      (ptDist(m.x, m.y, lastHandles.c1.x, lastHandles.c1.y) < HIT_RADIUS) { dragging = 'cp1'; canvas.style.cursor = 'grabbing'; }
    else if (ptDist(m.x, m.y, lastHandles.c2.x, lastHandles.c2.y) < HIT_RADIUS) { dragging = 'cp2'; canvas.style.cursor = 'grabbing'; }
});

canvas.addEventListener('mousemove', function(e) {
    var m = getMousePos(e);
    if (!dragging) {
        if (ptDist(m.x, m.y, lastHandles.c1.x, lastHandles.c1.y) < HIT_RADIUS ||
            ptDist(m.x, m.y, lastHandles.c2.x, lastHandles.c2.y) < HIT_RADIUS) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }
});

// mouseup anywhere (including outside canvas) stops dragging
document.addEventListener('mouseup', function() {
    if (dragging) {
        localStorage.setItem('flowease_cp1', JSON.stringify(cp1));
        localStorage.setItem('flowease_cp2', JSON.stringify(cp2));
    }
    dragging = null;
    canvas.style.cursor = 'default';
});
// mouseleave just resets cursor but does NOT stop drag — so handle can go past canvas edge
canvas.addEventListener('mouseleave', function() { if (!dragging) canvas.style.cursor = 'default'; });

// When mouse moves outside canvas while dragging, clamp to canvas bounds
document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var rect = canvas.getBoundingClientRect();
    var clampedX = Math.min(Math.max(e.clientX, rect.left), rect.right);
    var clampedY = Math.min(Math.max(e.clientY, rect.top - rect.height), rect.bottom + rect.height);
    var m = {
        x: (clampedX - rect.left) * (CW / rect.width),
        y: (clampedY - rect.top)  * (CH / rect.height)
    };
    if (graphMode === 'speed') {
        var rawX = Math.max(0.001, Math.min(0.999, (m.x - PAD) / BOX_W));
        if (dragging === 'cp1') cp1.x = rawX;
        else                    cp2.x = rawX;
    } else {
        var n = fromCanvas(m.x, m.y);
        if (dragging === 'cp1') {
            cp1.x = n.x;
            cp1.y = n.y;
        } else {
            cp2.x = n.x;
            cp2.y = n.y;
        }
    }
    activeFlowType = 'custom';
    queryAll('.fp-tab').forEach(function(b) { b.classList.remove('active'); });
    drawFlow();
});

// ── Apply Preset ──────────────────────────────────────────────
function applyPreset(type) {
    var pr = PRESETS[type];
    if (!pr) return;
    cp1 = { x: pr.cp1[0], y: pr.cp1[1] };
    cp2 = { x: pr.cp2[0], y: pr.cp2[1] };
    activeFlowType = type;
    drawFlow();
    localStorage.setItem('flowease_cp1', JSON.stringify(cp1));
    localStorage.setItem('flowease_cp2', JSON.stringify(cp2));
}

// Initial draw
drawFlow();

// ── KF COUNT STATE ───────────────────────────────────────────
var selectedKfMode = 'auto';

var btnToggleKf = document.getElementById('btnToggleKf');
if (btnToggleKf) {
    btnToggleKf.addEventListener('click', function() {
        var currentKf = parseInt(btnToggleKf.dataset.kf, 10) || 2;
        currentKf++;
        if (currentKf > 4) currentKf = 2;
        btnToggleKf.dataset.kf = currentKf;
        btnToggleKf.textContent = currentKf + '-KEY';
        selectedKfMode = currentKf.toString();
        var infoEl = document.getElementById('flowAutoInfo');
        if (infoEl) infoEl.style.display = 'none';
        drawFlow();
        showToast('KF Modu: ' + selectedKfMode + ' keyframe');
    });
}

var _graphModeBtns = queryAll('.graph-mode-btn');
for (var _gmbI = 0; _gmbI < _graphModeBtns.length; _gmbI++) {
    (function(btn) {
        btn.addEventListener('click', function() {
            for (var _gbi = 0; _gbi < _graphModeBtns.length; _gbi++) {
                _graphModeBtns[_gbi].classList.remove('active');
                _graphModeBtns[_gbi].style.color = 'var(--text-dim)';
            }
            this.classList.add('active');
            this.style.color = 'var(--text)';
            graphMode = this.getAttribute('data-mode');
            localStorage.setItem('flowease_graphMode', graphMode);
            drawFlow();
        });
    })(_graphModeBtns[_gmbI]);
}

// ── FLOW PRESET TABS ──────────────────────────────────────────
queryAll('.fp-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        queryAll('.fp-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyPreset(btn.dataset.flow);
        showToast('Graph: ' + btn.textContent.trim() + ' seçildi');
    });
});

// ── AUTO READ FROM AE ─────────────────────────────────────────
document.getElementById('btnReadFlow').addEventListener('click', function() {
    selectedKfMode = 'auto';
    if (btnToggleKf) {
        btnToggleKf.style.border = '1px solid #334155';
        btnToggleKf.style.color  = 'var(--text-dim)';
        btnToggleKf.classList.remove('active');
    }

    runScript('readFlowFromSelected()', function(res) {
        if (!res || res === 'null' || res === 'undefined') {
            showToast("⚠ AE'de keyframeli özellik seçin"); return;
        }
        try {
            var data = JSON.parse(res);
            if (data.error) { showToast('⚠ ' + data.error); return; }

            var infoEl  = document.getElementById('flowAutoInfo');
            var infoTxt = document.getElementById('flowAutoInfoText');
            if (infoEl && infoTxt) {
                infoTxt.innerHTML = '🔍 <strong>' + data.propertyName + '</strong> &nbsp;|&nbsp; Seçili KF: <strong>' + data.selectedKeysCount + '</strong> / Toplam: ' + data.totalKeys;
                infoEl.style.display = 'block';
            }

            if (data.selectedKeysCount >= 2 && data.selectedKeysCount <= 4) {
                var btn = document.getElementById('kfBtn' + data.selectedKeysCount);
                if (btn) {
                    btn.classList.add('active');
                    btn.style.border = '1px solid #2f80ed';
                    btn.style.color  = '#2f80ed';
                    selectedKfMode   = String(data.selectedKeysCount);
                }
            }

            if (data.outInfluence !== undefined) {
                // Convert AE ease values back to bezier control points
                // outInfluence → cp1.x, inInfluence → cp2.x
                // outSpeed slope → cp1.y/cp1.x, inSpeed slope → (1-cp2.y)/(1-cp2.x)
                var newCp1x = Math.min(0.99, Math.max(0.01, data.outInfluence / 100));
                var newCp2x = Math.min(0.99, Math.max(0.01, 1 - data.inInfluence / 100));
                var newCp1y = Math.min(2, Math.max(-0.5, newCp1x * data.outSlope));
                var newCp2y = Math.min(1.5, Math.max(-0.5, 1 - newCp2x * data.inSlope));
                cp1 = { x: newCp1x, y: newCp1y };
                cp2 = { x: newCp2x, y: newCp2y };
                activeFlowType = 'custom';
                queryAll('.fp-tab').forEach(function(b) { b.classList.remove('active'); });
                drawFlow();
                localStorage.setItem('flowease_cp1', JSON.stringify(cp1));
                localStorage.setItem('flowease_cp2', JSON.stringify(cp2));
                showToast('✓ AE keyframe değerleri okundu');
            }
        } catch(e) { showToast('⚠ Parse hatası: ' + e.message); }
    });
});



// ── FLOW UYGULA ───────────────────────────────────────────────
document.getElementById('btnApplyFlow').addEventListener('click', function() {
    var opts = JSON.stringify({
        type   : activeFlowType,
        cp1x   : Math.round(cp1.x * 10000) / 10000,
        cp1y   : Math.round(cp1.y * 10000) / 10000,
        cp2x   : Math.round(cp2.x * 10000) / 10000,
        cp2y   : Math.round(cp2.y * 10000) / 10000,
        kfMode : selectedKfMode
    });

    runScript('applyFlow(' + opts + ')', function(res) {
        if (res && res.indexOf('ERROR:') === 0) {
            window.showAlert(res.substring(6));
        } else {
            var modeStr = selectedKfMode === 'auto' ? 'Otomatik' : (selectedKfMode + ' KF');
            showToast('⚡ Flow uygulandı! (' + modeStr + ')');
        }
    });
});

// Input box sync (cp1x, cp1y, cp2x, cp2y manual edit)
['inpCp1x','inpCp1y','inpCp2x','inpCp2y'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function() {
        var v = parseFloat(this.value);
        if (isNaN(v)) return;
        if (id === 'inpCp1x') cp1.x = Math.max(0.001, Math.min(0.999, v));
        if (id === 'inpCp1y') cp1.y = v;
        if (id === 'inpCp2x') cp2.x = Math.max(0.001, Math.min(0.999, v));
        if (id === 'inpCp2y') cp2.y = v;
        activeFlowType = 'custom';
        queryAll('.fp-tab').forEach(function(b) { b.classList.remove('active'); });
        drawFlow();
    });
});


// ══════════════════════════════════

//  PRESET KAYDETME

// ══════════════════════════════════

var PRESETS_KEY = 'speedflow_presets_v1';



function loadPresets() {

    try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch(e) { return []; }

}

function savePresetsToStorage(arr) {

    localStorage.setItem(PRESETS_KEY, JSON.stringify(arr));

}



function drawMiniPreset(mc, pr) {

    if (!mc) return;

    var mctx = mc.getContext('2d');

    var W = mc.width; var H = mc.height; var p = 5;

    mctx.clearRect(0, 0, W, H);

    // Background

    mctx.fillStyle = 'rgba(10,14,28,0.95)';

    mctx.fillRect(0, 0, W, H);

    // Border

    mctx.strokeStyle = 'rgba(47,128,237,0.2)';

    mctx.lineWidth = 1;

    mctx.strokeRect(0.5, 0.5, W-1, H-1);

    // Get cp1/cp2 from preset

    var pc1 = pr.cp1 || [0.25, 0.1];

    var pc2 = pr.cp2 || [0.75, 0.9];

    var x0 = p, y0 = H-p, x3 = W-p, y3 = p;

    var cx1 = x0 + pc1[0]*(W-p*2);  var cy1 = H-p - pc1[1]*(H-p*2);

    var cx2 = x0 + pc2[0]*(W-p*2);  var cy2 = H-p - pc2[1]*(H-p*2);

    // Curve

    var grad = mctx.createLinearGradient(x0, y0, x3, y3);

    grad.addColorStop(0, '#1a5fb4'); grad.addColorStop(1, '#5ba4f5');

    mctx.strokeStyle = grad;

    mctx.lineWidth = 1.8;

    mctx.shadowColor = '#2f80ed';

    mctx.shadowBlur = 4;

    mctx.beginPath();

    mctx.moveTo(x0, y0);

    mctx.bezierCurveTo(cx1, cy1, cx2, cy2, x3, y3);

    mctx.stroke();

    mctx.shadowBlur = 0;

    // Anchor dots

    [[x0,y0],[x3,y3]].forEach(function(pt) {

        mctx.beginPath(); mctx.arc(pt[0], pt[1], 2, 0, Math.PI*2);

        mctx.fillStyle = '#2f80ed'; mctx.fill();

    });

}



function renderPresets() {

    var list = document.getElementById('presetList');

    var presets = loadPresets();

    list.innerHTML = '';

    if (!presets.length) {

        list.innerHTML = '<div class="preset-empty">Henüz kayıtlı preset yok.</div>';

        return;

    }

    presets.forEach(function (pr, idx) {

        var item = document.createElement('div');

        item.className = 'preset-item';

        var typeLabel = pr.type || 'custom';

        item.innerHTML =

            '<canvas class="preset-mini-canvas" width="64" height="40"></canvas>' +

            '<div class="preset-item-info">' +

            '  <span class="preset-item-name">' + pr.name + '</span>' +

            '  <span class="preset-item-meta">' + typeLabel + '</span>' +

            '</div>' +

            '<button class="preset-item-del" data-idx="' + idx + '">✕</button>';



        // Draw mini bezier curve preview

        drawMiniPreset(item.querySelector('.preset-mini-canvas'), pr);



        item.addEventListener('click', function (e) {

            if (e.target.classList.contains('preset-item-del')) return;

            applyPresetValues(pr);

            showToast('Preset yuklendi: ' + pr.name);

        });

        item.querySelector('.preset-item-del').addEventListener('click', function (e) {

            e.stopPropagation();

            var arr = loadPresets();

            arr.splice(idx, 1);

            savePresetsToStorage(arr);

            renderPresets();

            showToast('Preset silindi');

        });

        list.appendChild(item);

    });

}



function applyPresetValues(pr) {

    // Priority: use saved cp1/cp2 if available, else fall back to PRESETS table

    if (pr.cp1 && pr.cp2) {

        cp1 = { x: pr.cp1[0], y: pr.cp1[1] };

        cp2 = { x: pr.cp2[0], y: pr.cp2[1] };

    } else if (pr.type && PRESETS[pr.type]) {

        var preset = PRESETS[pr.type];

        cp1 = { x: preset.cp1[0], y: preset.cp1[1] };

        cp2 = { x: preset.cp2[0], y: preset.cp2[1] };

    }

    activeFlowType = pr.type || 'custom';

    slSpeedIn.value      = pr.speedIn  !== undefined ? pr.speedIn  : 80;

    slSpeedOut.value     = pr.speedOut !== undefined ? pr.speedOut : 80;

    slInfluenceIn.value  = pr.influenceIn  !== undefined ? pr.influenceIn  : 75;

    slInfluenceOut.value = pr.influenceOut !== undefined ? pr.influenceOut : 75;



    queryAll('.fp-tab').forEach(function (b) {

        b.classList.toggle('active', b.dataset.flow === activeFlowType);

    });

    drawFlow();

}



// Save preset modal

document.getElementById('btnSavePreset').addEventListener('click', function () {

    document.getElementById('presetNameInput').value = '';

    document.getElementById('presetSaveOverlay').classList.add('open');

    setTimeout(function() { document.getElementById('presetNameInput').focus(); }, 200);

});



function closePresetModal() { document.getElementById('presetSaveOverlay').classList.remove('open'); }

document.getElementById('closePresetSave').addEventListener('click', closePresetModal);

document.getElementById('cancelPresetSave').addEventListener('click', closePresetModal);



document.getElementById('confirmSavePreset').addEventListener('click', function () {

    var name = document.getElementById('presetNameInput').value.trim();

    if (!name) { showToast('⚠ Bir isim girin'); return; }

    var arr = loadPresets();

    arr.push({

        name: name, type: activeFlowType,

        cp1: [cp1.x, cp1.y], cp2: [cp2.x, cp2.y],

        speedIn: parseInt(slSpeedIn.value), speedOut: parseInt(slSpeedOut.value),

        influenceIn: parseInt(slInfluenceIn.value), influenceOut: parseInt(slInfluenceOut.value)

    });

    savePresetsToStorage(arr);

    renderPresets();

    closePresetModal();

    showToast('💾 Preset kaydedildi: ' + name);

});



document.getElementById('presetNameInput').addEventListener('keydown', function (e) {

    if (e.key === 'Enter') document.getElementById('confirmSavePreset').click();

});



// ── CUSTOM CONFIRM DIALOG ────────────────────────────────

function showConfirmDialog(onYes) {

    var overlay = document.getElementById('confirmOverlay');

    overlay.classList.add('open');



    function cleanup() {

        overlay.classList.remove('open');

        document.getElementById('btnConfirmYes').removeEventListener('click', handleYes);

        document.getElementById('btnConfirmCancel').removeEventListener('click', handleCancel);

    }

    function handleYes()    { cleanup(); onYes(); }

    function handleCancel() { cleanup(); }



    document.getElementById('btnConfirmYes').addEventListener('click', handleYes);

    document.getElementById('btnConfirmCancel').addEventListener('click', handleCancel);

}



document.getElementById('clearPresets').addEventListener('click', function () {

    showConfirmDialog(function () {

        savePresetsToStorage([]);

        renderPresets();

        showToast('Tüm presetler silindi');

    });

});



renderPresets();



// ══════════════════════════════════

//  EFEKT TAB – FFX Klasör

// ══════════════════════════════════

var selectedFFX = null;



function processFFXFolderData(res, showNotification) {
    if (showNotification === undefined) showNotification = true;
    if (!res || res === 'null' || res === 'undefined' || res.trim() === '') {
        if (showNotification) showToast('⚠ Klasör seçilmedi');
        return;
    }
    var cleanRes = res.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    try {
        var data = JSON.parse(cleanRes);
        if (data && data.error) {
            if (showNotification) showToast('⚠ Hata: ' + data.error);
            return;
        }
        if (data && data.path) {
            document.getElementById('folderPath').textContent = data.path;
            localStorage.setItem('flowease_ffxFolder', data.path);
            renderFFXList(data.files || []);
            if (showNotification) {
                showToast('✓ ' + (data.files ? data.files.length : 0) + ' FFX dosyası bulundu');
            }
        } else {
            if (showNotification) showToast('⚠ FFX bulunamadı');
        }
    } catch(e) {
        if (showNotification) showToast('⚠ Klasör okunurken hata: ' + e.message);
        console.error('FFX folder parse error. Raw response:', res);
    }
}

document.getElementById('btnSelectFolder').addEventListener('click', function () {
    runScript('selectFFXFolder()', function (res) {
        processFFXFolderData(res, true);
    });
});

// Bind Refresh button
var btnRefreshFolder = document.getElementById('btnRefreshFolder');
if (btnRefreshFolder) {
    btnRefreshFolder.addEventListener('click', function () {
        var savedPath = localStorage.getItem('flowease_ffxFolder');
        if (!savedPath) {
            showToast('⚠ Önce bir klasör seçmelisiniz!');
            return;
        }
        runScript('getFFXFiles("' + savedPath.replace(/\\/g, '\\\\') + '")', function (res) {
            processFFXFolderData(res, true);
        });
    });
}

// Load FFX Folder Memory on startup
(function loadFFXFolderMemory() {
    var savedPath = localStorage.getItem('flowease_ffxFolder');
    if (savedPath) {
        runScript('getFFXFiles("' + savedPath.replace(/\\/g, '\\\\') + '")', function (res) {
            if (res && !res.startsWith('ERROR')) {
                processFFXFolderData(res, false);
            }
        });
    }
})();



var allFFXFiles = [];
var activeFFXTab = 'library';

function renderFFXList(files) {
    allFFXFiles = files;
    var list = document.getElementById('effectList');
    if (!list) return;
    list.innerHTML = '';
    
    var favs = [];
    try {
        var fStr = localStorage.getItem('ffx_favorites');
        if (fStr) favs = JSON.parse(fStr);
    } catch(e) {}
    
    if (activeFFXTab === 'favorites') {
        if (favs.length === 0) {
            list.innerHTML = '<div class="effect-empty">Henüz favori efekt eklemediniz.</div>';
            return;
        }
        var path = require('path');
        favs.forEach(function(fPath) {
            var name = path.basename(fPath);
            var item = createEffectItem({ name: name, path: fPath }, true);
            list.appendChild(item);
        });
    } else {
        if (!files || files.length === 0) {
            list.innerHTML = '<div class="effect-empty">Bu klasörde .ffx dosyası bulunamadı.</div>';
            return;
        }
        files.forEach(function (f) {
            var isFav = favs.indexOf(f.path) !== -1;
            var item = createEffectItem(f, isFav);
            list.appendChild(item);
        });
    }
}

function createEffectItem(f, isFav) {
    var item = document.createElement('div');
    item.className = 'effect-item';
    if (isFav) item.classList.add('is-fav');
    
    // Star element
    var star = document.createElement('span');
    star.className = 'fav-star';
    star.innerHTML = isFav ? '★' : '☆';
    star.style.marginRight = '8px';
    star.style.color = isFav ? '#fbbf24' : 'var(--text-dim)';
    star.style.cursor = 'pointer';
    star.style.fontSize = '15px';
    star.style.lineHeight = '1';
    
    star.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleFavorite(f.path);
    });
    
    var name = document.createElement('span');
    name.className = 'effect-item-name';
    name.innerText = decodeURIComponent(f.name).replace(/\.ffx$/i, '');
    name.style.flex = '1';
    
    item.appendChild(star);
    item.appendChild(name);
    
    if (selectedFFX === f.path) {
        item.classList.add('selected');
    }
    
    item.addEventListener('click', function () {
        var allItems = document.querySelectorAll('.effect-item');
        for (var k = 0; k < allItems.length; k++) {
            allItems[k].classList.remove('selected');
        }
        item.classList.add('selected');
        selectedFFX = f.path;
        document.getElementById('btnApplyEffect').disabled = false;
    });
    
    item.addEventListener('dblclick', function () {
        selectedFFX = f.path;
        var applyAtIn = document.getElementById('chkApplyAtInPoint') ? document.getElementById('chkApplyAtInPoint').checked : false;
        var stretch = document.getElementById('chkStretchPresets') ? document.getElementById('chkStretchPresets').checked : false;
        var scriptStr = 'applyFFX(' + JSON.stringify(selectedFFX) + ', ' + applyAtIn + ', ' + stretch + ')';
        if (cs && selectedFFX) {
            cs.evalScript(scriptStr);
        }
    });
    
    return item;
}

function toggleFavorite(fPath) {
    var favs = [];
    try {
        var fStr = localStorage.getItem('ffx_favorites');
        if (fStr) favs = JSON.parse(fStr);
    } catch(e) {}
    
    var idx = favs.indexOf(fPath);
    if (idx !== -1) {
        favs.splice(idx, 1);
    } else {
        favs.push(fPath);
    }
    
    localStorage.setItem('ffx_favorites', JSON.stringify(favs));
    renderFFXList(allFFXFiles);
}

// Bind tabs
function bindFFXTabs() {
    var tLib = document.getElementById('tabFFXLibrary');
    var tFav = document.getElementById('tabFFXFavorites');
    if (tLib && tFav) {
        tLib.addEventListener('click', function() {
            activeFFXTab = 'library';
            tLib.classList.add('active');
            tFav.classList.remove('active');
            var fb = document.getElementById('ffxFolderBar');
            if (fb) fb.style.display = 'flex';
            
            var listEl = document.getElementById('effectList');
            if (listEl) {
                listEl.classList.remove('fade-in-active');
                void listEl.offsetWidth;
                listEl.classList.add('fade-in-active');
            }
            renderFFXList(allFFXFiles);
        });
        tFav.addEventListener('click', function() {
            activeFFXTab = 'favorites';
            tFav.classList.add('active');
            tLib.classList.remove('active');
            var fb = document.getElementById('ffxFolderBar');
            if (fb) fb.style.display = 'none';
            
            var listEl = document.getElementById('effectList');
            if (listEl) {
                listEl.classList.remove('fade-in-active');
                void listEl.offsetWidth;
                listEl.classList.add('fade-in-active');
            }
            renderFFXList(allFFXFiles);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindFFXTabs);
} else {
    bindFFXTabs();
}

// Effect search filter

document.getElementById('effectSearch').addEventListener('input', function () {

    var q = this.value.toLowerCase();

    queryAll('.effect-item').forEach(function (item) {

        item.style.display = item.querySelector('.effect-item-name').textContent.toLowerCase().includes(q) ? 'flex' : 'none';

    });

});

// Checkbox Memory for FFX Options
var chkApplyAtInPoint = document.getElementById('chkApplyAtInPoint');
if (chkApplyAtInPoint) {
    var savedApplyAtIn = localStorage.getItem('flowease_chkApplyAtInPoint');
    if (savedApplyAtIn !== null) {
        chkApplyAtInPoint.checked = (savedApplyAtIn === 'true');
    } else {
        chkApplyAtInPoint.checked = true; // default to checked
    }
    chkApplyAtInPoint.addEventListener('change', function() {
        localStorage.setItem('flowease_chkApplyAtInPoint', String(chkApplyAtInPoint.checked));
    });
}

var chkStretchPresets = document.getElementById('chkStretchPresets');
if (chkStretchPresets) {
    var savedStretch = localStorage.getItem('flowease_chkStretchPresets');
    if (savedStretch !== null) {
        chkStretchPresets.checked = (savedStretch === 'true');
    } else {
        chkStretchPresets.checked = false; // default to unchecked
    }
    chkStretchPresets.addEventListener('change', function() {
        localStorage.setItem('flowease_chkStretchPresets', String(chkStretchPresets.checked));
    });
}

document.getElementById('btnApplyEffect').addEventListener('click', function () {
    if (!selectedFFX) return;
    var applyAtIn = document.getElementById('chkApplyAtInPoint') ? document.getElementById('chkApplyAtInPoint').checked : false;
    var stretch = document.getElementById('chkStretchPresets') ? document.getElementById('chkStretchPresets').checked : false;
    
    var scriptStr = 'applyFFX(' + JSON.stringify(selectedFFX) + ', ' + applyAtIn + ', ' + stretch + ')';
    runScript(scriptStr, function (res) {
        if (res && res.indexOf("Error") > -1) {
            showToast('⚠ Hata: ' + res);
        } else {
            showToast('✦ FFX uygulandı!');
        }
    });
});



// ══════════════════════════════════

//  SETTINGS MODAL

// ══════════════════════════════════

// ══════════════════════════════════

//  SETTINGS MODAL

// ══════════════════════════════════

function loadSettings() {
    var snapQual = localStorage.getItem('snapshotQuality') || 'auto';
    var snapQualEl = document.getElementById('snapshotQuality');
    if (snapQualEl) snapQualEl.value = snapQual;

    var snapFold = localStorage.getItem('snapshotFolder') || '';
    var snapFoldEl = document.getElementById('snapshotFolderPath');
    if (snapFoldEl) {
        snapFoldEl.textContent = snapFold ? snapFold : "Masaüstü (Varsayılan)";
    }
    var snapAsk = localStorage.getItem('snapshotAlwaysAsk') !== 'false';
    var snapAskChk = document.getElementById('chkSnapshotAlwaysAsk');
    if (snapAskChk) snapAskChk.checked = snapAsk;

    var fps = localStorage.getItem('preCompFPS') || '60';
    var inp = document.getElementById('inpPreCompFPS');
    if (inp) inp.value = fps;
    
    var anim = localStorage.getItem('animationsEnabled') !== 'false';
    var chk = document.getElementById('chkAnim');
    if (chk) chk.checked = anim;
    if (anim) {
        document.body.classList.remove('animations-disabled');
    } else {
        document.body.classList.add('animations-disabled');
    }
    
    var cleanEffects = localStorage.getItem('cleanEffects') !== 'false';
    var chkCleanEffects = document.getElementById('chkCleanEffects');
    if (chkCleanEffects) chkCleanEffects.checked = cleanEffects;
    
    var cleanMasks = localStorage.getItem('cleanMasks') !== 'false';
    var chkCleanMasks = document.getElementById('chkCleanMasks');
    if (chkCleanMasks) chkCleanMasks.checked = cleanMasks;
    
    var cleanKeys = localStorage.getItem('cleanKeys') !== 'false';
    var chkCleanKeys = document.getElementById('chkCleanKeys');
    if (chkCleanKeys) chkCleanKeys.checked = cleanKeys;
    
    var cleanExpr = localStorage.getItem('cleanExpr') === 'true';
    var chkCleanExpr = document.getElementById('chkCleanExpr');
    if (chkCleanExpr) chkCleanExpr.checked = cleanExpr;
    
    var cleanTransform = localStorage.getItem('cleanTransform') === 'true';
    var chkCleanTransform = document.getElementById('chkCleanTransform');
    if (chkCleanTransform) chkCleanTransform.checked = cleanTransform;
    
    var solidColor = localStorage.getItem('flowease_solidColor') || '#1a1a1a';
    var picker = document.getElementById('solidColorPicker');
    if (picker) picker.value = solidColor;
}

function saveSettingsToStorage() {
    var snapQualEl = document.getElementById('snapshotQuality');
    if (snapQualEl) localStorage.setItem('snapshotQuality', snapQualEl.value);

    var snapAskChk = document.getElementById('chkSnapshotAlwaysAsk');
    if (snapAskChk) localStorage.setItem('snapshotAlwaysAsk', String(snapAskChk.checked));

    var fpsInput = document.getElementById('inpPreCompFPS');
    if (fpsInput) localStorage.setItem('preCompFPS', fpsInput.value);
    
    var animInput = document.getElementById('chkAnim');
    if (animInput) {
        var anim = animInput.checked;
        localStorage.setItem('animationsEnabled', anim);
        if (anim) {
            document.body.classList.remove('animations-disabled');
        } else {
            document.body.classList.add('animations-disabled');
        }
    }
    
    var chkCleanEffects = document.getElementById('chkCleanEffects');
    if (chkCleanEffects) localStorage.setItem('cleanEffects', chkCleanEffects.checked);
    
    var chkCleanMasks = document.getElementById('chkCleanMasks');
    if (chkCleanMasks) localStorage.setItem('cleanMasks', chkCleanMasks.checked);
    
    var chkCleanKeys = document.getElementById('chkCleanKeys');
    if (chkCleanKeys) localStorage.setItem('cleanKeys', chkCleanKeys.checked);
    
    var chkCleanExpr = document.getElementById('chkCleanExpr');
    if (chkCleanExpr) localStorage.setItem('cleanExpr', chkCleanExpr.checked);
    
    var chkCleanTransform = document.getElementById('chkCleanTransform');
    if (chkCleanTransform) localStorage.setItem('cleanTransform', chkCleanTransform.checked);
    
    var picker = document.getElementById('solidColorPicker');
    if (picker) localStorage.setItem('flowease_solidColor', picker.value);
    
    showToast('✓ Ayarlar kaydedildi');
}

// Load settings on startup
loadSettings();

document.getElementById('btnSettings').addEventListener('click', function () {
    loadSettings();
    document.getElementById('settingsOverlay').classList.add('open');
});

function closeSettings() { document.getElementById('settingsOverlay').classList.remove('open'); }

document.getElementById('closeSettings').addEventListener('click', closeSettings);

document.getElementById('cancelSettings').addEventListener('click', closeSettings);

document.getElementById('settingsOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeSettings();
});

document.getElementById('saveSettings').addEventListener('click', function () {
    saveSettingsToStorage();
    closeSettings();
});



// ══════════════════════════════════════════════════════════

//  ALTYAZİ TAB — Tarık Tools API Entegrasyonu (Gelişmiş v2.1)

// ══════════════════════════════════════════════════════════



var TT_BASE_URL = 'https://tariktools.com';

var subFile = null;

var subSegments = null;

var subSrtContent = null;

var subMode = 'auto'; // 'auto' (Otomatik) veya 'manual' (Manuel)



// ── API KEY DOĞRULAMA & GİRİŞ EKRANI KONTROLÜ ─────────────

var verifiedApiKey = localStorage.getItem('tt_api_key') || '';



function updateAuthUi() {

    var authGate = document.getElementById('aiAuthGate');

    var mainUi = document.getElementById('aiMainUi');

    

    if (verifiedApiKey) {

        if(authGate) authGate.style.display = 'none';

        if(mainUi) mainUi.style.display = 'block';

        

        loadCredits(verifiedApiKey);

        startCompPolling(); // Active composition name poll

        

        var preview = document.getElementById('apiKeyPreview');

        if (preview) {

            var displayKey = verifiedApiKey;

            if (displayKey.length > 12) {

                displayKey = displayKey.substring(0, 8) + '...' + displayKey.substring(displayKey.length - 4);

            }

            preview.textContent = 'Key: ' + displayKey;

        }

    } else {

        if(authGate) authGate.style.display = 'block';

        if(mainUi) mainUi.style.display = 'none';

        stopCompPolling();

    }

}



document.getElementById('btnShowKey').addEventListener('click', function () {

    var inp = document.getElementById('ttApiKey');

    inp.type = inp.type === 'password' ? 'text' : 'password';

    this.textContent = inp.type === 'password' ? '👁' : '🙈';

});



// Kaydet (Ve API'den doğrula)

document.getElementById('btnSaveApiKey').addEventListener('click', function () {

    var key = document.getElementById('ttApiKey').value.trim();

    if (!key) { showToast('⚠ API Key boş'); return; }

    

    showToast('🔑 Doğrulanıyor...');

    fetch(TT_BASE_URL + '/api/external/api-key', {

        headers: {

            'Authorization': 'ApiKey ' + key

        }

    })

    .then(function(res) {

        return res.json();

    })

    .then(function(data) {

        if (data && data.error) {

            showToast('❌ Hata: ' + data.error);

        } else if (data && data.credits !== undefined) {

            // Key valid!

            localStorage.setItem('tt_api_key', key);

            verifiedApiKey = key;

            updateAuthUi();

            showToast('✓ Bağlantı başarılı!');

        } else {

            showToast('❌ Geçersiz API Key!');

        }

    })

    .catch(function(err) {

        showToast('❌ Bağlantı hatası: ' + err.message);

    });

});



// Çıkış (API Key sil)

document.getElementById('btnDisconnect').addEventListener('click', function () {

    localStorage.removeItem('tt_api_key');

    verifiedApiKey = '';

    document.getElementById('ttApiKey').value = '';

    updateAuthUi();

    showToast('Bağlantı kesildi.');

});



// Siteden API Key al (tariktools.com developer API paneline git)

document.getElementById('btnGetApiKey').addEventListener('click', function () {

    showToast('🌐 Tarık Tools Developer paneli açılıyor...');

    cs.openURLInDefaultBrowser("https://tariktools.com/dashboard");

});



// AI Sub-Tabs (Altyazı vs Vokal)

var aiTabSubtitle = document.getElementById('aiTabSubtitle');

var aiTabVocal = document.getElementById('aiTabVocal');

var aiContentSubtitle = document.getElementById('aiContentSubtitle');

var aiContentVocal = document.getElementById('aiContentVocal');



if (aiTabSubtitle && aiTabVocal) {

    aiTabSubtitle.addEventListener('click', function() {

        aiTabSubtitle.classList.add('active');

        aiTabVocal.classList.remove('active');

        aiContentSubtitle.style.display = 'block';

        aiContentVocal.style.display = 'none';

    });

    

    aiTabVocal.addEventListener('click', function() {

        aiTabVocal.classList.add('active');

        aiTabSubtitle.classList.remove('active');

        aiContentVocal.style.display = 'block';

        aiContentSubtitle.style.display = 'none';

    });

}



function loadCredits(apiKey) {

    if (!apiKey) return;

    var creditText = document.getElementById('creditText');

    creditText.textContent = 'Kredi yükleniyor...';

    

    fetch(TT_BASE_URL + '/api/external/api-key', {

        headers: {

            'Authorization': 'ApiKey ' + apiKey

        }

    })

    .then(function(res) {

        return res.json();

    })

    .then(function(data) {

        if (data && data.credits !== undefined) {

            creditText.textContent = data.credits + ' Kredi mevcut';

        } else {

            creditText.textContent = 'Kredi bilgisi alınamadı';

        }

    })

    .catch(function() {

        creditText.textContent = 'Bağlantı hatası';

    });

}



// ── AKTİF KOMPOZİSYON VE SEÇİLİ KATMAN POLLEME (OTOMATİK MOD İÇİN) ──────

var compPollInterval = null;

function startCompPolling() {

    if (compPollInterval) clearInterval(compPollInterval);

    compPollInterval = setInterval(function () {

        // Comp polling

        cs.evalScript('getActiveCompName()', function (name) {

            var lbl = document.getElementById('lblActiveComp');

            if (lbl) {

                if (name && name.trim()) {

                    lbl.textContent = name;

                    lbl.style.color = '#00f2fe';

                } else {

                    lbl.textContent = 'Yok';

                    lbl.style.color = '#ff6b6b';

                }

            }

        });

        // Selected layer polling

        cs.evalScript('getSelectedLayerName()', function (layerName) {

            var lbl = document.getElementById('lblActiveLayer');

            var lblVocal = document.getElementById('lblActiveVocalLayer');

            var activeName = (layerName && layerName.trim()) ? layerName : '';

            

            if (lbl) {

                if (activeName) {

                    lbl.textContent = activeName;

                    lbl.style.color = '#00f2fe';

                } else {

                    lbl.textContent = 'Yok (Lütfen sesli bir katman seçin)';

                    lbl.style.color = '#ff6b6b';

                }

            }

            if (lblVocal) {

                if (activeName) {

                    lblVocal.textContent = activeName;

                    lblVocal.style.color = '#00f2fe';

                } else {

                    lblVocal.textContent = 'Yok (Lütfen bir katman seçin)';

                    lblVocal.style.color = '#ff6b6b';

                }

            }

        });

    }, 1500);

}



function stopCompPolling() {

    if (compPollInterval) {

        clearInterval(compPollInterval);

        compPollInterval = null;

    }

}





// ── SUB-TAB MOD DEĞİŞTİRME (OTOMATİK vs MANUEL) ───────────

document.getElementById('modeTabAuto').addEventListener('click', function () {

    subMode = 'auto';

    this.classList.add('active');

    document.getElementById('modeTabManual').classList.remove('active');

    document.getElementById('modeContentAuto').style.display = 'block';

    document.getElementById('modeContentManual').style.display = 'none';

});



document.getElementById('modeTabManual').addEventListener('click', function () {

    subMode = 'manual';

    this.classList.add('active');

    document.getElementById('modeTabAuto').classList.remove('active');

    document.getElementById('modeContentManual').style.display = 'block';

    document.getElementById('modeContentAuto').style.display = 'none';

});



// ── MANUEL DOSYA SEÇİMİ / DRAG & DROP ────────────────────

var dropZone = document.getElementById('subDropZone');

var fileInput = document.getElementById('subFileInput');



dropZone.addEventListener('click', function () { fileInput.click(); });



fileInput.addEventListener('change', function () {

    if (this.files[0]) setSubFile(this.files[0]);

});



dropZone.addEventListener('dragover', function (e) {

    e.preventDefault(); dropZone.classList.add('drag-over');

});

dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag-over'); });

dropZone.addEventListener('drop', function (e) {

    e.preventDefault(); dropZone.classList.remove('drag-over');

    var f = e.dataTransfer.files[0];

    if (f) setSubFile(f);

});



function setSubFile(f) {

    var maxSize = 50 * 1024 * 1024;

    if (f.size > maxSize) { showToast("⚠ Dosya 50MB'dan büyük!"); return; }

    subFile = f;

    dropZone.classList.add('has-file');

    document.getElementById('subDropText').textContent = f.name;

    showToast('✓ Dosya seçildi: ' + f.name);

}



// ── İLERLEME ÇUBUĞU ───────────────────────────────────────

var progressInterval = null;

function startProgress() {

    var bar = document.getElementById('subProgressFill');

    var txt = document.getElementById('subProgressText');

    document.getElementById('subProgress').style.display = 'flex';

    document.getElementById('subResult').style.display = 'none';

    document.getElementById('btnImportToAE').disabled = true;

    var pct = 5;

    bar.style.width = pct + '%';

    progressInterval = setInterval(function () {

        pct = Math.min(pct + (Math.random() * 3), 90);

        bar.style.width = pct + '%';

        if (subMode === 'auto' && pct < 25) {

            txt.textContent = 'AE kompozisyonunun sesi render alınıyor...';

        } else if (pct < 50) {

            txt.textContent = 'Ses sunucuya yükleniyor...';

        } else if (pct < 80) {

            txt.textContent = 'AI işliyor (Whisper)...';

        } else {

            txt.textContent = 'Segmentler oluşturuluyor...';

        }

    }, 600);

}



function stopProgress(success) {

    clearInterval(progressInterval);

    var bar = document.getElementById('subProgressFill');

    bar.style.width = success ? '100%' : '0%';

    setTimeout(function () {

        document.getElementById('subProgress').style.display = 'none';

        bar.style.width = '0%';

    }, 600);

}



// ── ALTYAZI AYARLARI MODALI ────────────────────────────────

document.getElementById('btnGenerateSub').addEventListener('click', function () {

    var apiKey = verifiedApiKey || localStorage.getItem('tt_api_key') || '';

    if (!apiKey) { showToast('⚠ Önce API Key girin'); return; }

    

    if (subMode === 'manual' && !subFile) { 

        showToast('⚠ Önce ses/video dosyası seçin'); 

        return; 

    }

    

    document.getElementById('subSettingsOverlay').classList.add('open');

});



document.getElementById('closeSubSettings').addEventListener('click', function () {

    document.getElementById('subSettingsOverlay').classList.remove('open');

});

document.getElementById('cancelSubSettings').addEventListener('click', function () {

    document.getElementById('subSettingsOverlay').classList.remove('open');

});



document.getElementById('btnConfirmGenerateSub').addEventListener('click', function () {

    document.getElementById('subSettingsOverlay').classList.remove('open');

    

    var apiKey = verifiedApiKey || localStorage.getItem('tt_api_key') || '';

    var lang      = document.getElementById('subLang').value;

    var wordLimit = document.getElementById('subWordLimit').value;

    var textCase  = document.getElementById('subTextCase').value;



    if (subMode === 'manual') {

        sendToTranscribeAPI(subFile, apiKey, lang, wordLimit, textCase);

    } else {

        // Otomatik Mod: Önce seçili katmanın direkt kaynak dosyasını oku (Sıfır Render Hızı!)

        startProgress();

        cs.evalScript('getSelectedLayerSourcePath()', function (sourceResStr) {

            console.log("getSelectedLayerSourcePath raw response:", sourceResStr);

            try {

                if (!sourceResStr) {

                    throw new Error("Katman bilgisi alınamadı.");

                }

                var sourceRes = JSON.parse(sourceResStr);

                if (sourceRes.error) {

                    stopProgress(false);

                    showToast('❌ Hata: ' + decodeURIComponent(sourceRes.error));

                    return;

                }



                var fs = require('fs');

                var path = require('path');



                if (sourceRes.hasSourceFile) {

                    var sourcePath = decodeURIComponent(sourceRes.path);

                    var statObj = window.cep.fs.stat(sourcePath);

                    if (statObj.err === 0 && statObj.data.isFile) {

                        var fileSizeMB = statObj.data.size / (1024 * 1024);



                        var ext = sourcePath.split('.').pop().toLowerCase();

                        var isAudioFile = (ext === 'mp3' || ext === 'wav' || ext === 'm4a' || ext === 'aac');



                        // Maksimum limit 50MB. Render sürecinden tamamen kaçınmak için boyutu 50MB altındaki HER dosya (video veya ses) doğrudan okunup sunucuya gönderilir!

                        if (fileSizeMB < 50) {

                            console.log("Direct file upload. Size:", fileSizeMB.toFixed(2), "MB. Path:", sourcePath);

                            

                            var readResult = window.cep.fs.readFile(sourcePath, window.cep.encoding.Base64);

                            if (readResult.err === 0) {

                                var base64Data = readResult.data.replace(/[\r\n]+/g, "");

                                var mime = 'audio/' + (ext || 'wav');

                                if (ext === 'mp3') mime = 'audio/mpeg';

                                if (ext === 'm4a') mime = 'audio/mp4';

                                if (ext === 'mp4' || ext === 'mov') mime = 'video/mp4';

                                

                                var dataUrl = 'data:' + mime + ';base64,' + base64Data;

                                var fileName = sourcePath.split('\\\\').pop().split('/').pop();



                                var payload = {

                                    audioDataUrl: dataUrl,

                                    fileName: fileName,

                                    language: lang,

                                    wordLimit: wordLimit,

                                    textCase: textCase

                                };



                                executeTranscribeRequestDirect(payload, apiKey, sourceRes.startTime, sourceRes.inPoint, sourceRes.outPoint);

                                return;

                            }

                        }

                    }

                }



                // EĞER RENDER ŞART İSE (Pre-comp ise veya dosya çok büyükse): Hızlı Render Al (Video Kapalı!)

                console.log("Falling back to audio-only rendering...");

                triggerAudioRenderSub(apiKey, lang, wordLimit, textCase);



            } catch (err) {

                stopProgress(false);

                showToast('❌ Hata: ' + err.message);

            }

        });

    }

});



function triggerAudioRenderSub(apiKey, lang, wordLimit, textCase) {

    cs.evalScript('exportSelectedLayerAudio()', function (renderRes) {

        console.log("exportSelectedLayerAudio raw response:", renderRes);

        try {

            if (!renderRes) {

                throw new Error("ExtendScript boş yanıt döndürdü.");

            }

            var res = JSON.parse(renderRes);

            if (res.error) {

                stopProgress(false);

                showToast('❌ Hata: ' + decodeURIComponent(res.error));

                return;

            }

            

            var filePath = decodeURIComponent(res.path);

            var statObj = window.cep.fs.stat(filePath);

            

            if (statObj.err !== 0) {

                stopProgress(false);

                showToast('❌ Hata: Render edilen dosya bulunamadı.');

                return;

            }

            

            var readResult = window.cep.fs.readFile(filePath, window.cep.encoding.Base64);

            if (readResult.err !== 0) {

                stopProgress(false);

                showToast('❌ Hata: Render dosyası okunamadı. Hata Kodu: ' + readResult.err);

                return;

            }

            

            var base64Data = readResult.data.replace(/[\r\n]+/g, "");

            

            var mime = 'audio/wav';

            var firstBytes = base64Data.substring(0, 10);

            if (firstBytes.indexOf("AAAA") === 0 || firstBytes.indexOf("AAAB") === 0) {

                mime = 'video/mp4'; // H.264/MP4/M4A signature

            } else if (firstBytes.indexOf("UklGR") === 0) {

                mime = 'audio/wav'; // WAV signature

            } else if (firstBytes.indexOf("SUQz") === 0 || firstBytes.indexOf("//Nkx") === 0) {

                mime = 'audio/mpeg'; // MP3 signature

            } else {

                var ext = filePath.split('.').pop().toLowerCase();

                if (ext === 'mp3') mime = 'audio/mpeg';

                if (ext === 'm4a') mime = 'audio/mp4';

                if (ext === 'mp4' || ext === 'mov') mime = 'video/mp4';

            }

            

            var dataUrl = 'data:' + mime + ';base64,' + base64Data;

            

            try { window.cep.fs.deleteFile(filePath); } catch(e){}

            

            var fileName = filePath.split('\\\\').pop().split('/').pop();

            

            var payload = {

                audioDataUrl: dataUrl,

                fileName: fileName,

                language: lang,

                wordLimit: wordLimit,

                textCase: textCase

            };

            

            executeTranscribeRequest(payload, apiKey);

            

        } catch(err) {

            stopProgress(false);

            var detail = renderRes ? String(renderRes).substring(0, 120) : "boş";

            showToast('❌ Render hatası: ' + err.message + ' (Cevap: ' + detail + ')');

        }

    });

}



function executeTranscribeRequestDirect(payload, apiKey, startTime, inPoint, outPoint) {

    fetch(TT_BASE_URL + '/api/external/transcribe', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json',

            'Authorization': 'ApiKey ' + apiKey

        },

        body: JSON.stringify(payload)

    })

    .then(function(res) {

        return res.json();

    })

    .then(function(data) {

        if (data.error) {

            stopProgress(false);

            showToast('❌ Hata: ' + data.error);

            return;

        }

        stopProgress(true);



        // Segmentleri After Effects kompozisyon zamanlamasına göre kaydır ve görünür aralığa göre kırp

        var offset = startTime || 0;

        var filteredSegments = [];

        for (var i = 0; i < data.segments.length; i++) {

            var seg = data.segments[i];

            var absoluteStart = seg.start + offset;

            var absoluteEnd = seg.end + offset;



            // Görünür aralığa denk gelenleri filtrele (0.5 sn tolerans payı ile)

            if (absoluteStart >= inPoint - 0.5 && absoluteEnd <= outPoint + 0.5) {

                seg.start = absoluteStart - inPoint;

                seg.end = absoluteEnd - inPoint;

                filteredSegments.push(seg);

            }

        }



        subSegments = filteredSegments;

        

        // Yeniden SRT formatı oluştur (Kırpılmış segmentlere göre)

        function toSrt(secs) {
            var h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = Math.floor(secs%60), ms = Math.round((secs%1)*1000);
            function pad2(n){ return (n < 10 ? '0' : '') + n; }
            function pad3(n){ return (n < 10 ? '00' : (n < 100 ? '0' : '')) + n; }
            return pad2(h) + ':' + pad2(m) + ':' + pad2(s) + ',' + pad3(ms);
        }

        var _srtParts = [];
        for (var _si = 0; _si < subSegments.length; _si++) {
            var _seg = subSegments[_si];
            _srtParts.push((_si + 1) + '\n' + toSrt(_seg.start) + ' --> ' + toSrt(_seg.end) + '\n' + _seg.text);
        }
        subSrtContent = _srtParts.join('\n\n');



        // Kredi güncelle

        if (data.creditsLeft !== undefined) {

            document.getElementById('creditText').textContent = data.creditsLeft + ' Kredi mevcut';

        }



        // Sonuç göster

        document.getElementById('subResult').style.display = 'flex';

        document.getElementById('subResultTitle').textContent = 'Altyazı Hazır ✓';

        document.getElementById('subResultMeta').textContent = (subSegments.length) + ' segment (Sıfır Render)';

        document.getElementById('btnImportToAE').disabled = false;

        showToast('✅ ' + subSegments.length + ' altyazı oluşturuldu!');

    })

    .catch(function(e) {

        stopProgress(false);

        showToast('❌ İstek başarısız oldu: ' + e.message);

    });

}



function sendToTranscribeAPI(fileObj, apiKey, lang, wordLimit, textCase) {

    startProgress();

    var reader = new FileReader();

    reader.onload = function (e) {

        var payload = {

            audioDataUrl: e.target.result,

            fileName: fileObj.name,

            language: lang,

            wordLimit: wordLimit,

            textCase: textCase

        };

        executeTranscribeRequest(payload, apiKey);

    };

    reader.readAsDataURL(fileObj);

}



function executeTranscribeRequest(payload, apiKey) {

    fetch(TT_BASE_URL + '/api/external/transcribe', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json',

            'Authorization': 'ApiKey ' + apiKey

        },

        body: JSON.stringify(payload)

    })

    .then(function(res) {

        return res.json();

    })

    .then(function(data) {

        if (data.error) {

            stopProgress(false);

            showToast('❌ Hata: ' + data.error);

            return;

        }

        stopProgress(true);

        subSegments = data.segments;

        subSrtContent = data.srt;



        // Kredi güncelle

        if (data.creditsLeft !== undefined) {

            document.getElementById('creditText').textContent = data.creditsLeft + ' Kredi mevcut';

        }



        // Sonuç göster

        document.getElementById('subResult').style.display = 'flex';

        document.getElementById('subResultTitle').textContent = 'Altyazı Hazır ✓';

        document.getElementById('subResultMeta').textContent = (subSegments.length) + ' segment · ' + Math.round(data.text.length/10) + ' sn ses';

        document.getElementById('btnImportToAE').disabled = false;

        showToast('✅ ' + subSegments.length + ' altyazı oluşturuldu!');

    })

    .catch(function(e) {

        stopProgress(false);

        showToast('❌ İstek başarısız oldu: ' + e.message);

    });

}



// ── SRT İNDİR ─────────────────────────────────────────────

document.getElementById('btnSaveSRT').addEventListener('click', function () {

    if (!subSrtContent) { showToast('⚠ Önce altyazı oluşturun'); return; }

    cs.evalScript('saveSRTFile(' + JSON.stringify(subSrtContent) + ')', function() {

        showToast('⬇ SRT kaydedildi');

    });

});



// ── AE'YE AKTAR ───────────────────────────────────────────

document.getElementById('btnImportToAE').addEventListener('click', function () {

    if (!subSegments || !subSegments.length) { showToast('⚠ Altyazı yok'); return; }

    

    var fs = require('fs');

    var path = require('path');

    var os = require('os');

    var tempPath = path.join(os.tmpdir(), 'ae_sub_data_' + new Date().getTime() + '.json');

    var segJson = JSON.stringify(subSegments);

    fs.writeFileSync(tempPath, segJson, 'utf8');



    if (subMode === 'auto') {

        cs.evalScript('getSelectedLayerInPoint()', function (inPointStr) {

            var offset = parseFloat(inPointStr) || 0;

            var scriptStr = '(function(){ try { return importSubtitleToAE_FromFile("' + tempPath.replace(/\\/g, '/') + '", ' + offset + '); } catch(e) { return "HATA: GLOBAL " + e.toString(); } })()';

            cs.evalScript(scriptStr, function (res) {

                if (res && res.indexOf("HATA") !== -1) {

                    showToast('❌ ' + res);

                } else {

                    showToast('✦ ' + (res || 'Aktarıldı (Boş Yanıt)'));

                }

            });

        });

    } else {

        var scriptStr = '(function(){ try { return importSubtitleToAE_FromFile("' + tempPath.replace(/\\/g, '/') + '", 0); } catch(e) { return "HATA: GLOBAL " + e.toString(); } })()';

        cs.evalScript(scriptStr, function (res) {

            if (res && res.indexOf("HATA") !== -1) {

                showToast('❌ ' + res);

            } else {

                showToast('✦ ' + (res || 'Aktarıldı (Boş Yanıt)'));

            }

        });

    }

});



// ── VOKAL AYIRMA MANTIĞI ─────────────────────────────────────

var vocalModeOverlay = document.getElementById('vocalModeOverlay');

if (document.getElementById('btnIsolateVocal')) {

    document.getElementById('btnIsolateVocal').addEventListener('click', function () {

        var apiKey = verifiedApiKey || localStorage.getItem('tt_api_key') || '';

        if (!apiKey) { showToast('⚠ Lütfen Developer Kodunuzu girin'); return; }

        updateStemCheckboxes();
if (vocalModeOverlay) vocalModeOverlay.classList.add('open');

    });

}

if (document.getElementById('closeVocalMode')) {

    document.getElementById('closeVocalMode').addEventListener('click', function () { vocalModeOverlay.classList.remove('open'); });

}

if (document.getElementById('cancelIsolateVocal')) {

    document.getElementById('cancelIsolateVocal').addEventListener('click', function () { vocalModeOverlay.classList.remove('open'); });

}



function updateStemCheckboxes() {

    var model = document.getElementById('vocalModelSelectModal').value;

    var container = document.getElementById('stemSelectionOptions');

    if (!container) return;

    

    var html = '';

    if (model === 'standart') {

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="vocals" checked> 🎙 Ana Vokal</label>';

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="instrumental"> 🎵 Müzik (Enstrümantal)</label>';

    } else if (model.indexOf('karaoke') !== -1) {

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="vocals" checked> 🎙 Ana Vokal (Sıfır Müzik)</label>';

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="backing"> 🗣 Ara Vokal (Backing)</label>';

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="instrumental"> 🎵 Müzik</label>';

    } else if (model === 'detayli') {

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="vocals" checked> 🎙 Ana Vokal</label>';

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="drums"> 🥁 Davul</label>';

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="bass"> 🎸 Bas Gitar</label>';

        html += '<label class="checkbox-row" style="margin-bottom:4px;"><input type="checkbox" value="other"> 🎹 Diğer Enstrümanlar</label>';

    }

    container.innerHTML = html;

}



if (document.getElementById('vocalModelSelectModal')) {

    document.getElementById('vocalModelSelectModal').addEventListener('change', updateStemCheckboxes);

}



if (document.getElementById('confirmIsolateVocal')) {

    document.getElementById('confirmIsolateVocal').addEventListener('click', function () {

        if (vocalModeOverlay) vocalModeOverlay.classList.remove('open');

        var apiKey = verifiedApiKey || localStorage.getItem('tt_api_key') || '';

        

        var model = document.getElementById('vocalModelSelectModal').value;

        var muteOriginal = document.getElementById('chkMuteOriginalModal').checked;



        // Get selected stems

        var selectedStems = [];

        var checkboxes = queryAll('#stemSelectionOptions input[type="checkbox"]:checked');

        checkboxes.forEach(function(chk) { selectedStems.push(chk.value); });

        

        if (selectedStems.length === 0) {

            showToast('Lütfen en az bir katman seçin!');

            return;

        }



        document.getElementById('vocalProgress').style.display = 'flex';

        document.getElementById('vocalProgressFill').style.width = '30%';

        document.getElementById('vocalProgressText').textContent = 'Ses okunuyor...';



        // Ses Katmanını Oku

        cs.evalScript('getSelectedLayerSourcePath()', function (sourceResStr) {

            try {

                if (!sourceResStr) throw new Error("Katman bilgisi alınamadı.");

                var sourceRes = JSON.parse(sourceResStr);

                if (sourceRes.error) { throw new Error(decodeURIComponent(sourceRes.error)); }



                var fs = require('fs');

                var sourcePath = decodeURIComponent(sourceRes.path);

                var statObj = window.cep.fs.stat(sourcePath);

                

                if (statObj.err === 0 && statObj.data.isFile) {

                    var fileSizeMB = statObj.data.size / (1024 * 1024);

                    var ext = sourcePath.split('.').pop().toLowerCase();

                    var isAudioOrVideo = (['mp3', 'wav', 'm4a', 'aac', 'mp4', 'mov'].indexOf(ext) !== -1);



                    if (fileSizeMB < 50 && isAudioOrVideo) {

                        // Direkt Oku

                        var readResult = window.cep.fs.readFile(sourcePath, window.cep.encoding.Base64);

                        if (readResult.err === 0) {

                            var base64Data = readResult.data.replace(/[\r\n]+/g, "");

                            var mime = 'audio/' + (ext || 'wav');

                            if (ext === 'mp3') mime = 'audio/mpeg';

                            if (ext === 'm4a' || ext === 'mp4' || ext === 'mov') mime = 'video/mp4';

                            

                            var dataUrl = 'data:' + mime + ';base64,' + base64Data;

                            var fileName = sourcePath.split('\\').pop().split('/').pop();

                            

                            executeVocalIsolation(dataUrl, fileName, model, apiKey, sourceRes.startTime, sourceRes.inPoint, sourceRes.outPoint, muteOriginal, selectedStems);

                            return;

                        }

                    }

                }

                

                // Eğer direkt okunamadıysa Render'a düş (Render Audio)

                document.getElementById('vocalProgressText').textContent = 'Geçici render alınıyor...';

                cs.evalScript('exportSelectedLayerAudio()', function (renderRes) {

                    try {

                        var res = JSON.parse(renderRes);

                        if (res.error) throw new Error(decodeURIComponent(res.error));

                        

                        var filePath = decodeURIComponent(res.path);

                        var readResult = window.cep.fs.readFile(filePath, window.cep.encoding.Base64);

                        if (readResult.err !== 0) throw new Error("Render dosyası okunamadı.");

                        

                        var base64Data = readResult.data.replace(/[\r\n]+/g, "");

                        var mime = 'audio/wav'; // Default exported

                        var dataUrl = 'data:' + mime + ';base64,' + base64Data;

                        

                        try { window.cep.fs.deleteFile(filePath); } catch(e){}

                        var fileName = filePath.split('\\').pop().split('/').pop();

                        

                        // For rendered audio, the file itself is already trimmed.

                        // The file's internal time 0 should align with the comp's inPoint.

                        // Therefore, startTime = inPoint. inPoint = inPoint. outPoint = outPoint.

                        executeVocalIsolation(dataUrl, fileName, model, apiKey, sourceRes.inPoint, sourceRes.inPoint, sourceRes.outPoint, muteOriginal, selectedStems);

                    } catch(err) {

                        document.getElementById('vocalProgress').style.display = 'none';

                        showToast('❌ Render hatası: ' + err.message);

                    }

                });



            } catch (err) {

                document.getElementById('vocalProgress').style.display = 'none';

                showToast('❌ Hata: ' + err.message);

            }

        });

    });

}



function executeVocalIsolation(audioDataUrl, fileName, model, apiKey, startTime, inPoint, outPoint, muteOriginal, selectedStems) {

    document.getElementById('vocalProgressFill').style.width = '60%';

    document.getElementById('vocalProgressText').textContent = 'Sunucuya gönderiliyor... (Bu işlem biraz sürebilir)';

    

    // Map the karaoke models to what the server expects

    var serverModel = model;

    if (model === 'karaoke_hizli') serverModel = 'karaoke';

    if (model === 'karaoke_yavas') serverModel = 'karaoke-slow';



    fetch(TT_BASE_URL + '/api/external/isolate-vocal', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json',

            'Authorization': 'ApiKey ' + apiKey

        },

        body: JSON.stringify({ audioDataUrl: audioDataUrl, fileName: fileName, model: serverModel, selectedStems: selectedStems })

    })

    .then(function(res) { return res.json(); })

    .then(function(data) {

        if (data.error) {

            document.getElementById('vocalProgress').style.display = 'none';

            showToast('❌ Sunucu Hatası: ' + data.error);

            return;

        }

        

        document.getElementById('vocalProgressFill').style.width = '90%';

        document.getElementById('vocalProgressText').textContent = 'Vokal indiriliyor...';

        

        // Gelen ses katmanlarini (stems) isle

        if (data.audioDataUrls) {

            var stems = Object.keys(data.audioDataUrls);

            var isFirst = true;

            var hasError = false;

            var fs = require('fs');

            var path = require('path');

            var os = require('os');



            function importNextStem(index) {

                if (index >= stems.length) {

                    document.getElementById('vocalProgress').style.display = 'none';

                    if (!hasError) showToast('Katmanlar basariyla ayrildi ve eklendi!');

                    if (data.creditsLeft !== undefined) {

                        var credEl = document.getElementById('creditText');

                        if(credEl) credEl.textContent = data.creditsLeft + ' Kredi';

                    }

                    return;

                }

                var stemName = stems[index];

                var rawData = data.audioDataUrls[stemName];

                var b64Data = rawData.indexOf(',') !== -1 ? rawData.split(',')[1] : rawData;

                var tempPath = path.join(os.tmpdir(), 'vocal_' + stemName + '_' + Date.now() + '.wav');

                var buf = Buffer.from(b64Data, 'base64');

                fs.writeFileSync(tempPath, buf);

                var doMute = isFirst ? muteOriginal : false;

                var safePath = tempPath.replace(/\\/g, '/');

                var scriptStr = '(function(){ try { return importIsolatedAudioToAE(\"' + safePath + '\", ' + startTime + ', ' + inPoint + ', ' + outPoint + ', ' + doMute + ', \"' + stemName + '\"); } catch(e) { return \"HATA: \" + e.toString(); } })()';

                cs.evalScript(scriptStr, function(res) {

                    if (res && res.indexOf('HATA') !== -1) { showToast('Hata: ' + res); hasError = true; }

                    isFirst = false;

                    importNextStem(index + 1);

                });

            }



            document.getElementById('vocalProgressFill').style.width = '100%';

            document.getElementById('vocalProgressText').textContent = "AE'ye aktariliyor...";

            importNextStem(0);

        } else {

            document.getElementById('vocalProgress').style.display = 'none';

            showToast('Hata: Sunucu gecersiz veri dondurdu. Yanit: ' + JSON.stringify(data).substring(0, 100));

        }

    })

    .catch(function(e) {

        document.getElementById('vocalProgress').style.display = 'none';

        showToast('❌ İstek başarısız oldu: ' + e.message);

    });

}



// Arayüzü başlat (Hafızadan API Key oku)

updateAuthUi();



// ── Input Listeners ───────────────────────────────────────────
// (flipY button is already set up at the top of the file — do NOT add it again here)



    ['inpCp1x','inpCp1y','inpCp2x','inpCp2y'].forEach(function(id) {

    var el = document.getElementById(id);

    if (el) {

        el.addEventListener('input', function() {

            var v = parseFloat(this.value) || 0;

            if (id==='inpCp1x') cp1.x = v;

            if (id==='inpCp1y') cp1.y = v;

            if (id==='inpCp2x') cp2.x = v;

            if (id==='inpCp2y') cp2.y = v;

            activeFlowType = 'custom';

            drawFlow();

            localStorage.setItem('flowease_cp1', JSON.stringify(cp1));

            localStorage.setItem('flowease_cp2', JSON.stringify(cp2));

        });

    }

});



// ── KEYBOARD SHORTCUTS ──────────────────────────────────────────





// Show shortcuts hint on first load

(function() {

    if (!localStorage.getItem('sf_shortcuts_seen')) {

        setTimeout(function() {

            showToast('💡 İpucu: 1-4=Preset, M=Ayna, Ctrl+C=Kopyala, Space=Uygula');

            localStorage.setItem('sf_shortcuts_seen', '1');

        }, 2000);

    }

})();



// ═══════════════════════════════════════════════════════════

//  NEW FEATURES v2.5

// ═══════════════════════════════════════════════════════════



// ── 1. UNDO / REDO SYSTEM (10 steps) ───────────────────────

var undoStack = [];

var redoStack = [];

var MAX_UNDO = 10;



function pushUndo() {

    undoStack.push({ cp1: {x:cp1.x, y:cp1.y}, cp2: {x:cp2.x, y:cp2.y} });

    if (undoStack.length > MAX_UNDO) undoStack.shift();

    redoStack = [];

}



function doUndo() {

    if (!undoStack.length) { showToast('⚠ Geri alacak işlem yok'); return; }

    redoStack.push({ cp1: {x:cp1.x, y:cp1.y}, cp2: {x:cp2.x, y:cp2.y} });

    var state = undoStack.pop();

    cp1 = state.cp1; cp2 = state.cp2;

    drawFlow(); showToast('↩ Geri alındı');

}



function doRedo() {

    if (!redoStack.length) { showToast('⚠ İleri alacak işlem yok'); return; }

    undoStack.push({ cp1: {x:cp1.x, y:cp1.y}, cp2: {x:cp2.x, y:cp2.y} });

    var state = redoStack.pop();

    cp1 = state.cp1; cp2 = state.cp2;

    drawFlow(); showToast('↪ İleri alındı');

}



document.getElementById('btnUndo').addEventListener('click', doUndo);

document.getElementById('btnRedo').addEventListener('click', doRedo);



// Inject undo push into drag end

canvas.addEventListener('mousedown', function() { pushUndo(); }, true);





// ── 2. SYMMETRY LOCK ────────────────────────────────────────

var symLockOn = false;

var btnSymLock = document.getElementById('btnSymLock');

btnSymLock.addEventListener('click', function() {

    symLockOn = !symLockOn;

    btnSymLock.classList.toggle('active', symLockOn);

    showToast(symLockOn ? '🔗 Simetri Kilidi AÇIK' : '🔗 Simetri Kilidi KAPALI');

});



// Hook into drawFlow drag to mirror when symLock is on

var _origCanvasMove = canvas.onmousemove;

canvas.addEventListener('mousemove', function(e) {

    if (!dragging || !symLockOn || graphMode === 'speed') return;

    // cp1 and cp2 are already set by the base handler; now mirror

    requestAnimationFrame(function() {

        if (dragging === 'cp1') {

            cp2.x = 1 - cp1.x;

            cp2.y = 1 - cp1.y;

        } else {

            cp1.x = 1 - cp2.x;

            cp1.y = 1 - cp2.y;

        }

        drawFlow();

    });

});





// ── 3. SNAP / GRID MODE ─────────────────────────────────────

var snapOn = false;

var SNAP_STEP = 0.1;

var btnSnapMode = document.getElementById('btnSnapMode');

btnSnapMode.addEventListener('click', function() {

    snapOn = !snapOn;

    btnSnapMode.classList.toggle('active', snapOn);

    showToast(snapOn ? '📐 Snap Modu AÇIK (0.10 adım)' : '📐 Snap Modu KAPALI');

});



// Patch fromCanvas to snap

var _origFromCanvas = fromCanvas;

fromCanvas = function(cx, cy) {

    var pt = _origFromCanvas(cx, cy);

    if (snapOn) {

        pt.x = Math.round(pt.x / SNAP_STEP) * SNAP_STEP;

        pt.y = Math.round(pt.y / SNAP_STEP) * SNAP_STEP;

    }

    return pt;

};





// ── 4. COMPARE MODE ─────────────────────────────────────────

var compareOn = false;

var compareCp1 = null;

var compareCp2 = null;

var btnCompare = document.getElementById('btnCompare');

var compareLabel = document.getElementById('compareLabel');



btnCompare.addEventListener('click', function() {

    if (!compareOn) {

        // Save current as reference

        compareCp1 = {x:cp1.x, y:cp1.y};

        compareCp2 = {x:cp2.x, y:cp2.y};

        compareOn = true;

        btnCompare.classList.add('active');

        compareLabel.style.display = 'block';

        showToast('👁 Karşılaştırma kaydedildi — eğriyi değiştir');

    } else {

        compareOn = false;

        compareCp1 = null;

        compareCp2 = null;

        btnCompare.classList.remove('active');

        compareLabel.style.display = 'none';

        showToast('👁 Karşılaştırma Modu kapatıldı');

    }

    drawFlow();

});



// Draw ghost curve in compare mode — hook into drawFlow

var _origDrawFlow = drawFlow;

drawFlow = function() {

    _origDrawFlow();

    if (compareOn && compareCp1 && graphMode === 'value') {

        var p0g = toCanvas(0, 0);

        var p3g = toCanvas(1, 1);

        var gc1 = toCanvas(compareCp1.x, compareCp1.y);

        var gc2 = toCanvas(compareCp2.x, compareCp2.y);

        ctx.save();

        ctx.strokeStyle = 'rgba(47, 128, 237, 0.35)';

        ctx.lineWidth = 2;

        ctx.setLineDash([4, 4]);

        ctx.beginPath();

        ctx.moveTo(p0g.x, p0g.y);

        ctx.bezierCurveTo(gc1.x, gc1.y, gc2.x, gc2.y, p3g.x, p3g.y);

        ctx.stroke();

        ctx.setLineDash([]);

        ctx.restore();

    }

};





// ── 5. ANIMATED BALL PREVIEW ────────────────────────────────

var ballCanvas = document.getElementById('ballCanvas');

var ballCtx = ballCanvas ? ballCanvas.getContext('2d') : null;

var ballAnim = null;

var ballRunning = false;



function solveCubicBezierT(bx, p1x, p2x, iters) {

    // Newton's method to find t given x on a cubic bezier

    var t = bx;

    for (var i = 0; i < (iters || 8); i++) {

        var mt = 1 - t;

        var f  = 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t - bx;

        var df = 3*mt*mt*p1x + 6*mt*t*(p2x - p1x) + 3*t*t*(1 - p2x);

        if (Math.abs(df) < 1e-6) break;

        t -= f / df;

        t = Math.max(0, Math.min(1, t));

    }

    return t;

}



function evaluateBezierY(t, p1y, p2y) {

    var mt = 1 - t;

    return 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t;

}



function startBallPreview() {

    if (!ballCanvas || !ballCtx) return;

    if (ballAnim) cancelAnimationFrame(ballAnim);

    ballRunning = true;

    var startTime = null;

    var DURATION = 1200; // ms



    function frame(now) {

        if (!ballRunning) return;

        if (!startTime) startTime = now;

        var progress = (now - startTime) / DURATION;



        if (progress > 1.05) {

            // Pause then restart

            ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

            startTime = null;

            setTimeout(function() {

                if (ballRunning) ballAnim = requestAnimationFrame(frame);

            }, 400);

            return;

        }



        progress = Math.min(progress, 1);



        // Find Y using bezier for current progress (X)

        var t = solveCubicBezierT(progress, cp1.x, cp2.x);

        var by = evaluateBezierY(t, cp1.y, cp2.y);



        // Map to canvas
        var bx_screen = PAD + progress * BOX_W;
        var by_screen;
        if (flipY) {
            by_screen = PAD + by * BOX_H;
        } else {
            by_screen = PAD + (1 - by) * BOX_H;
        }



        ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);



        // Trail

        ballCtx.beginPath();

        ballCtx.arc(bx_screen, by_screen, 7, 0, Math.PI * 2);

        ballCtx.fillStyle = 'rgba(47,128,237,0.15)';

        ballCtx.fill();



        // Ball

        ballCtx.beginPath();

        ballCtx.arc(bx_screen, by_screen, 5, 0, Math.PI * 2);

        var grad = ballCtx.createRadialGradient(bx_screen-1, by_screen-1, 1, bx_screen, by_screen, 5);

        grad.addColorStop(0, '#7dd3fc');

        grad.addColorStop(1, '#2f80ed');

        ballCtx.fillStyle = grad;

        ballCtx.fill();



        ballAnim = requestAnimationFrame(frame);

    }



    ballAnim = requestAnimationFrame(frame);

}



function stopBallPreview() {

    ballRunning = false;

    if (ballAnim) cancelAnimationFrame(ballAnim);

    if (ballCtx) ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

}



// Auto-play when flow tab is active, stop otherwise

queryAll('.tab').forEach(function(tab) {

    tab.addEventListener('click', function() {

        if (tab.dataset.tab === 'graph') {

            setTimeout(startBallPreview, 300);

        } else {

            stopBallPreview();

        }

    });

});



// Restart ball on curve change

var _origDrawFlowBall = drawFlow;

drawFlow = function() {

    _origDrawFlowBall();

    if (ballRunning) {

        if (ballAnim) cancelAnimationFrame(ballAnim);

        startBallPreview();

    }

};



// Start ball when page loads if on flow tab

setTimeout(function() {

    var activeTab = document.querySelector('.tab.active');

    if (activeTab && activeTab.dataset.tab === 'graph') startBallPreview();

}, 800);





// ── 6. CATEGORY FILTER ──────────────────────────────────────

var activeCat = 'all';

queryAll('.cat-btn').forEach(function(btn) {

    btn.addEventListener('click', function() {

        activeCat = btn.getAttribute('data-cat');

        queryAll('.cat-btn').forEach(function(b) { b.classList.remove('active'); });

        btn.classList.add('active');

        renderPresets();

    });

});



// Patch renderPresets to support category filtering

var _origRenderPresets = renderPresets;

renderPresets = function() {

    var list = document.getElementById('presetList');

    var allPresets = loadPresets();

    var filtered = activeCat === 'all' ? allPresets : allPresets.filter(function(p) { return p.category === activeCat; });



    list.innerHTML = '';

    if (!filtered.length) {

        list.innerHTML = '<div class="preset-empty">Bu kategoride preset yok.</div>';

        return;

    }



    filtered.forEach(function(pr, displayIdx) {

        // Find the real index in allPresets

        var realIdx = allPresets.indexOf(pr);

        var item = document.createElement('div');

        item.className = 'preset-item';

        var catTag = pr.category ? pr.category : 'custom';

        var catColor = {ui:'#2f80ed', karakter:'#22c55e', kamera:'#f59e0b', bounce:'#a855f7'}[catTag] || '#64748b';



        item.innerHTML =

            '<canvas class="preset-mini-canvas" width="64" height="40"></canvas>' +

            '<div class="preset-item-info">' +

            '  <span class="preset-item-name">' + pr.name + '</span>' +

            '  <span class="preset-item-meta" style="color:' + catColor + ';">' + catTag + '</span>' +

            '</div>' +

            '<button class="preset-item-del" data-idx="' + realIdx + '">✕</button>';



        drawMiniPreset(item.querySelector('.preset-mini-canvas'), pr);



        item.addEventListener('click', function(e) {

            if (e.target.classList.contains('preset-item-del')) {

                var idx = parseInt(e.target.getAttribute('data-idx'));

                var arr = loadPresets();

                arr.splice(idx, 1);

                savePresetsToStorage(arr);

                renderPresets();

                showToast('🗑 Preset silindi');

                return;

            }

            pushUndo();

            cp1 = { x: pr.cp1[0], y: pr.cp1[1] };

            cp2 = { x: pr.cp2[0], y: pr.cp2[1] };

            activeFlowType = 'custom';

            drawFlow();

            showToast('✓ "' + pr.name + '" yüklendi');

        });



        list.appendChild(item);

    });

};








// ── 8. PRESET EXPORT (JSON) ─────────────────────────────────

document.getElementById('btnExportPreset').addEventListener('click', function() {
    // Export the active graph directly from the screen
    var exportData = {
        type: "single_graph",
        cp1: [cp1.x, cp1.y],
        cp2: [cp2.x, cp2.y],
        flipY: flipY,
        graphMode: graphMode
    };
    var json = JSON.stringify(exportData, null, 2);

    try {
        var os = require('os');
        var path = require('path');
        var fs = require('fs');
        var defaultPath = "";
        try {
            var docDir = path.join(os.homedir(), 'Documents');
            if (fs.existsSync(docDir)) {
                defaultPath = path.join(docDir, 'speedgraph_presets.tarikgraph');
            } else {
                defaultPath = path.join(os.homedir(), 'speedgraph_presets.tarikgraph');
            }
        } catch (ex) {
            defaultPath = os.homedir() + "\\speedgraph_presets.tarikgraph";
        }

        var result = window.cep.fs.showSaveDialogEx(
            "Presetleri Dışa Aktar",
            defaultPath,
            ["tarikgraph", "json"],
            "speedgraph_presets.tarikgraph",
            "TarikGraph Presets (*.tarikgraph)"
        );

        if (result.err === 0 && result.data && result.data.length > 0) {
            var savePath = result.data;
            if (Array.isArray(savePath)) {
                savePath = savePath[0];
            } else if (typeof savePath === 'object') {
                savePath = savePath[0];
            }
            // Ensure savePath is a string
            savePath = String(savePath);
            // Normalize path for Windows
            try {
                savePath = path.normalize(savePath);
            } catch(pn) {}

            var success = false;
            // Method 1: CEP Native writeFile
            try {
                var writeResult = window.cep.fs.writeFile(savePath, json);
                if (writeResult.err === 0) {
                    success = true;
                }
            } catch(ce) {}

            // Method 2: Node.js fs write
            if (!success) {
                try {
                    fs.writeFileSync(savePath, json, 'utf8');
                    success = true;
                } catch(ne) {
                    throw new Error(ne.message + " | Yol: " + savePath);
                }
            }

            if (success) {
                showToast('📤 Grafik başarıyla dışa aktarıldı');
            } else {
                throw new Error("Yazma hatası | Yol: " + savePath);
            }
        }
    } catch (e) {
        showToast('⚠ Hata: ' + e.message);
    }
});





// ── 9. PRESET IMPORT (JSON) ─────────────────────────────────

document.getElementById('importPresetFile').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            var imported = JSON.parse(ev.target.result);
            
            // Check if it is a single graph
            if (imported && imported.type === "single_graph" && imported.cp1 && imported.cp2) {
                cp1 = { x: imported.cp1[0], y: imported.cp1[1] };
                cp2 = { x: imported.cp2[0], y: imported.cp2[1] };
                
                if (imported.flipY !== undefined) {
                    flipY = imported.flipY;
                    var btnFlipY = document.getElementById('btnFlipY');
                    if (btnFlipY) {
                        if (flipY) {
                            btnFlipY.style.color = '#2e8ff5';
                            btnFlipY.style.borderColor = '#2e8ff5';
                        } else {
                            btnFlipY.style.color = 'var(--text-dim)';
                            btnFlipY.style.borderColor = 'var(--border)';
                        }
                    }
                    localStorage.setItem('flowease_flipY', String(flipY));
                }
                
                if (imported.graphMode !== undefined) {
                    graphMode = imported.graphMode;
                    localStorage.setItem('flowease_graphMode', graphMode);
                    var _graphModeBtns = queryAll('.graph-mode-btn');
                    _graphModeBtns.forEach(function(btn) {
                        if (btn.getAttribute('data-mode') === graphMode) {
                            btn.classList.add('active');
                            btn.style.color = 'var(--text)';
                        } else {
                            btn.classList.remove('active');
                            btn.style.color = 'var(--text-dim)';
                        }
                    });
                }
                
                activeFlowType = 'custom';
                queryAll('.fp-tab').forEach(function(b) { b.classList.remove('active'); });
                drawFlow();
                localStorage.setItem('flowease_cp1', JSON.stringify(cp1));
                localStorage.setItem('flowease_cp2', JSON.stringify(cp2));
                showToast('✓ Grafik başarıyla içe aktarıldı');
            } else if (Array.isArray(imported)) {
                // Import array as custom presets
                var arr = loadPresets();
                var added = 0;
                imported.forEach(function(p) {
                    if (p.name && p.cp1 && p.cp2) {
                        var dup = arr.some(function(x) { return x.name === p.name; });
                        if (!dup) {
                            arr.push(p);
                            added++;
                        }
                    }
                });
                if (added > 0) {
                    savePresetsToStorage(arr);
                    renderPresets();
                    showToast('📥 ' + added + ' preset içe aktarıldı!');
                } else {
                    showToast('⚠ İçe aktarılacak yeni preset bulunamadı');
                }
            } else {
                throw new Error("Geçersiz dosya formatı");
            }
        } catch(err) {
            showToast('❌ Yükleme hatası: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});





// ── 10. AUTO CURVE ANALYSIS ─────────────────────────────────

function analyzeClosestPreset() {

    var NAMED = [

        { name:'Ease',     cp1:[0.25,0.10], cp2:[0.75,0.90] },

        { name:'Ease In',  cp1:[0.42,0.00], cp2:[1.00,1.00] },

        { name:'Ease Out', cp1:[0.00,0.00], cp2:[0.58,1.00] },

        { name:'Linear',   cp1:[0.33,0.33], cp2:[0.67,0.67] },

        { name:'Snappy',   cp1:[0.10,1.00], cp2:[0.90,0.00] },

    ];

    var bestDist = Infinity;

    var bestName = '';

    NAMED.forEach(function(p) {

        var d = Math.sqrt(

            Math.pow(cp1.x - p.cp1[0], 2) + Math.pow(cp1.y - p.cp1[1], 2) +

            Math.pow(cp2.x - p.cp2[0], 2) + Math.pow(cp2.y - p.cp2[1], 2)

        );

        if (d < bestDist) { bestDist = d; bestName = p.name; }

    });

    if (bestDist < 0.25) {

        showToast('🎯 En yakın: "' + bestName + '" (fark: ' + bestDist.toFixed(2) + ')');

    }

}



// Run analysis after Auto Read

var _origBtnRead = document.getElementById('btnReadFlow');

if (_origBtnRead) {

    _origBtnRead.addEventListener('click', function() {

        setTimeout(analyzeClosestPreset, 600);

    });

}





// ── 11. BUILT-IN GALLERY PRESETS (Online Preset Gallery) ────

(function seedGalleryPresets() {

    var GALLERY = [

        { name:'✨ Smooth Ease',  category:'ui',       cp1:[0.25,0.10], cp2:[0.75,0.90] },

        { name:'⚡ Snappy',       category:'ui',       cp1:[0.10,1.00], cp2:[0.90,0.00] },

        { name:'🐢 Slow In',      category:'karakter', cp1:[0.00,0.00], cp2:[0.33,1.00] },

        { name:'🚀 Slow Out',     category:'karakter', cp1:[0.67,0.00], cp2:[1.00,1.00] },

        { name:'📷 Camera Pan',   category:'kamera',   cp1:[0.30,0.00], cp2:[0.70,1.00] },

        { name:'🏀 Bounce In',    category:'bounce',   cp1:[0.60,1.30], cp2:[0.40,1.30] },

        { name:'🌊 Overshoot',    category:'bounce',   cp1:[0.40,1.40], cp2:[0.60,0.00] },

        { name:'💥 Impact',       category:'karakter', cp1:[0.10,0.00], cp2:[0.30,1.00] },

    ];

    if (localStorage.getItem('speedflow_presets_seeded') === 'true') return;

    var existing = loadPresets();
    if (existing.length > 0) {
        localStorage.setItem('speedflow_presets_seeded', 'true');
        return;
    }

    var seeded = GALLERY.map(function(g) {

        return {

            name: g.name, type: 'custom', category: g.category,

            cp1: g.cp1, cp2: g.cp2,

            speedIn: 80, speedOut: 80, influenceIn: 75, influenceOut: 75

        };

    });

    savePresetsToStorage(seeded);
    localStorage.setItem('speedflow_presets_seeded', 'true');

    renderPresets();

})();



// ── 12. TOGGLE BALL PREVIEW ────────────────────────────────
var toggleBallOn = localStorage.getItem('flowease_ball') !== 'false';
var btnToggleBall = document.getElementById('btnToggleBall');
if (btnToggleBall) {
    btnToggleBall.classList.toggle('active', toggleBallOn);
    if(toggleBallOn) setTimeout(startBallPreview, 500);
}

if (btnToggleBall) {
    btnToggleBall.addEventListener('click', function() {
        toggleBallOn = !toggleBallOn; localStorage.setItem('flowease_ball', toggleBallOn);
        btnToggleBall.classList.toggle('active', toggleBallOn);
        if (toggleBallOn) {
            startBallPreview();
            showToast('🏀 Önizleme Topu AÇIK');
        } else {
            stopBallPreview();
            showToast('🏀 Önizleme Topu KAPALI');
        }
    });
}

// Patch startBallPreview to respect toggleBallOn
var _origStartBall = startBallPreview;
startBallPreview = function() {
    if (toggleBallOn) _origStartBall();
};

// Initialize Graph Mode UI
if(graphMode === 'speed') {
    document.getElementById('btnSpeedGraph').classList.add('active');
    document.getElementById('btnValueGraph').classList.remove('active');
}


if(document.getElementById('btnToggleKf')) {
    document.getElementById('btnToggleKf').setAttribute('data-kf', selectedKfMode);
    document.getElementById('btnToggleKf').innerText = (selectedKfMode === 'auto' ? '2' : selectedKfMode) + '-KEY';
}


window.showAlert = function(msg) {
    document.getElementById('customAlertMsg').innerText = msg;
    document.getElementById('customAlertModal').classList.add('open');
};
var _alertOkBtn = document.getElementById('customAlertOk');
if (_alertOkBtn) {
    _alertOkBtn.addEventListener('click', function() {
        var _modal = document.getElementById('customAlertModal');
        if (_modal) _modal.classList.remove('open');
    });
}


/* btnHizFX bound below with shift-click */


// FFX Folder Memory loaded via startup IIFE


var btnNullAdj = document.getElementById('btnNullAdj');
if (btnNullAdj) {
    btnNullAdj.addEventListener('click', function(e) {
        if (window.isEditLayoutMode) return;
        var isAdj = e.shiftKey;
        cs.evalScript('createNull(' + (isAdj ? 'false' : 'true') + ')', function(res){
            if (res && res.indexOf('ERROR:') === 0) {
                window.showAlert(res.substring(6));
            } else {
                showToast(isAdj ? '✓ Adjustment Layer oluşturuldu' : '✓ Null Object oluşturuldu');
            }
        });
    });
}
var btnHizFX = document.getElementById('btnHizFX');
if (btnHizFX) {
    btnHizFX.addEventListener('click', function(e) {
        if (window.isEditLayoutMode) return;
        var isShift = e.shiftKey;
        cs.evalScript('applyHizFX(' + (isShift ? 'true' : 'false') + ')', function(res){
            if (res && res.indexOf('ERROR:') === 0) {
                window.showAlert(res.substring(6));
            } else {
                showToast(isShift ? '✓ CC Motion Tile uygulandı' : '✓ Twixtor Pro uygulandı');
            }
        });
    });
}

// Logo Modal Preview Events
var logoImg = document.querySelector('.logo-img');
if (logoImg) {
    logoImg.style.cursor = 'pointer';
    logoImg.addEventListener('click', function () {
        document.getElementById('logoModalOverlay').classList.add('open');
    });
}
var logoModalOverlay = document.getElementById('logoModalOverlay');
if (logoModalOverlay) {
    logoModalOverlay.addEventListener('click', function () {
        logoModalOverlay.classList.remove('open');
    });
}

// Global button focus removal on click
document.addEventListener('click', function (e) {
    var btn = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
    if (btn) {
        btn.blur();
    }
});

// Bind btnSolid manually for Solid/Camera creation
var btnSolid = document.getElementById('btnSolid');
if (btnSolid) {
    btnSolid.addEventListener('click', function(e) {
        if (window.isEditLayoutMode) return;
        var isCamera = e.shiftKey;
        if (isCamera) {
            cs.evalScript('createSolidOrCamera(true)', function(res){
                showToast('✓ Kamera oluşturuldu');
            });
        } else {
            var hex = localStorage.getItem('flowease_solidColor') || '#1a1a1a';
            // Parse hex to RGB
            hex = hex.replace('#', '');
            if (hex.length === 3) {
                hex = hex[0]+hex[0] + hex[1]+hex[1] + hex[2]+hex[2];
            }
            var r = parseInt(hex.substring(0, 2), 16) / 255;
            var g = parseInt(hex.substring(2, 4), 16) / 255;
            var b = parseInt(hex.substring(4, 6), 16) / 255;
            cs.evalScript('createSolidOrCamera(false, ' + r + ', ' + g + ', ' + b + ')', function(res){
                showToast('✓ Solid oluşturuldu');
            });
        }
    });
}

// Bind btnAklliHizala manually for Align to Comp vs Align to First Layer
var btnAklliHizala = document.getElementById('btnAklliHizala');
if (btnAklliHizala) {
    btnAklliHizala.addEventListener('click', function(e) {
        if (window.isEditLayoutMode) return;
        var isShift = e.shiftKey;
        cs.evalScript('smartAlign(' + isShift + ')', function(res){
            if (res && res.indexOf('ERROR:') === 0) {
                window.showAlert(res.substring(6));
            } else {
                showToast(isShift ? '✓ Katmanlar ilk seçilene hizalandı' : '✓ Katmanlar kompozisyona hizalandı');
            }
        });
    });
}

// ==========================================
// DRAGGABLE REORDER LAYOUT SYSTEM
// ==========================================
window.isEditLayoutMode = false;
var btnEditLayout = document.getElementById('btnEditLayout');
var btnGrid = document.querySelector('.btn-grid');

function loadButtonOrder() {
    var savedOrder = localStorage.getItem('flowease_btn_order');
    if (savedOrder && btnGrid) {
        try {
            var ids = JSON.parse(savedOrder);
            var buttons = Array.from(btnGrid.children);
            ids.forEach(function(id) {
                var btn = buttons.find(function(b) { return b.id === id; });
                if (btn) btnGrid.appendChild(btn);
            });
        } catch(e){}
    }
}

// Load order initially
loadButtonOrder();

if (btnEditLayout && btnGrid) {
    btnEditLayout.addEventListener('click', function() {
        window.isEditLayoutMode = !window.isEditLayoutMode;
        if (window.isEditLayoutMode) {
            btnGrid.classList.add('edit-mode');
            btnEditLayout.textContent = '✓ Kaydet';
            btnEditLayout.style.borderColor = '#2f80ed';
            btnEditLayout.style.color = '#2f80ed';
            enableDragAndDrop();
        } else {
            btnGrid.classList.remove('edit-mode');
            btnEditLayout.textContent = '⚙️ Düzenle';
            btnEditLayout.style.borderColor = 'var(--border)';
            btnEditLayout.style.color = 'var(--text-dim)';
            disableDragAndDrop();
            // Save layout order
            var ids = Array.from(btnGrid.children).map(function(btn) { return btn.id; });
            localStorage.setItem('flowease_btn_order', JSON.stringify(ids));
            showToast('✓ Buton düzeni kaydedildi');
        }
    });
}

function enableDragAndDrop() {
    var buttons = btnGrid.querySelectorAll('.grid-btn');
    buttons.forEach(function(btn) {
        btn.setAttribute('draggable', 'true');
        btn.addEventListener('dragstart', handleDragStart);
        btn.addEventListener('dragover', handleDragOver);
        btn.addEventListener('dragenter', handleDragEnter);
        btn.addEventListener('dragleave', handleDragLeave);
        btn.addEventListener('drop', handleDrop);
        btn.addEventListener('dragend', handleDragEnd);
    });
}

function disableDragAndDrop() {
    var buttons = btnGrid.querySelectorAll('.grid-btn');
    buttons.forEach(function(btn) {
        btn.removeAttribute('draggable');
        btn.removeEventListener('dragstart', handleDragStart);
        btn.removeEventListener('dragover', handleDragOver);
        btn.removeEventListener('dragenter', handleDragEnter);
        btn.removeEventListener('dragleave', handleDragLeave);
        btn.removeEventListener('drop', handleDrop);
        btn.removeEventListener('dragend', handleDragEnd);
        btn.classList.remove('over', 'dragging');
    });
}

var dragSrcEl = null;
function handleDragStart(e) {
    if (!window.isEditLayoutMode) return;
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (!window.isEditLayoutMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (!window.isEditLayoutMode) return;
    var target = e.target.closest('.grid-btn');
    if (target && target !== dragSrcEl && target.parentNode === btnGrid) {
        target.classList.add('over');
    }
}

function handleDragLeave(e) {
    if (!window.isEditLayoutMode) return;
    var target = e.target.closest('.grid-btn');
    if (target) {
        target.classList.remove('over');
    }
}

function swapElements(el1, el2) {
    var parent = el1.parentNode;
    var temp = document.createElement("div");
    parent.insertBefore(temp, el1);
    parent.insertBefore(el1, el2);
    parent.insertBefore(el2, temp);
    parent.removeChild(temp);
}

function handleDrop(e) {
    if (!window.isEditLayoutMode) return;
    e.stopPropagation();
    e.preventDefault();
    
    var target = e.target.closest('.grid-btn');
    if (target && target !== dragSrcEl && target.parentNode === btnGrid) {
        swapElements(dragSrcEl, target);
    }
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    var buttons = btnGrid.querySelectorAll('.grid-btn');
    buttons.forEach(function(btn) {
        btn.classList.remove('over');
    });
}




// --- Anchor Point Logic ---
var anchorBtns = document.querySelectorAll('.anchor-btn');
for (var i = 0; i < anchorBtns.length; i++) {
    anchorBtns[i].addEventListener('click', function() {
        var pos = this.getAttribute('data-pos');
        if (cs) {
            cs.evalScript('setAnchorPoint("' + pos + '")', function(res) {

            });
        }
    });
}

// --- Anchor UI Toggle ---
var btnToggleAnchorUI = document.getElementById('btnToggleAnchorUI');
var anchorWidgetArea = document.getElementById('anchorWidgetArea');
if (btnToggleAnchorUI && anchorWidgetArea) {
    var isAnchorVisible = localStorage.getItem('tarik_anchor_visible') === 'true';
    if (isAnchorVisible) {
        anchorWidgetArea.classList.add('show');
        btnToggleAnchorUI.style.color = '#2f80ed';
        btnToggleAnchorUI.style.borderColor = '#2f80ed';
    }
    btnToggleAnchorUI.addEventListener('click', function() {
        isAnchorVisible = !isAnchorVisible;
        localStorage.setItem('tarik_anchor_visible', isAnchorVisible);
        if (isAnchorVisible) {
            anchorWidgetArea.classList.add('show');
            btnToggleAnchorUI.style.color = '#2f80ed';
            btnToggleAnchorUI.style.borderColor = '#2f80ed';
        } else {
            anchorWidgetArea.classList.remove('show');
            btnToggleAnchorUI.style.color = 'var(--text-dim)';
            btnToggleAnchorUI.style.borderColor = 'var(--border)';
        }
    });
}

// --- FX Bypass ---
var btnBypassFX = document.getElementById('btnBypassFX');
if (btnBypassFX) {
    btnBypassFX.addEventListener('click', function() { if (window.isEditLayoutMode) return;
        if (cs) {
            var mode = "layers";
            var modeEl = document.getElementById("fxBypassMode");
            if (modeEl) mode = modeEl.value;
            cs.evalScript('toggleFXBypass("' + mode + '")');
        }
    });
}


// --- Drag and Drop FFX ---
var effectListEl = document.getElementById('effectList');
if (effectListEl) {
    effectListEl.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        effectListEl.style.borderColor = '#5ba4f5';
        effectListEl.style.backgroundColor = 'rgba(91, 164, 245, 0.05)';
    });

    effectListEl.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        effectListEl.style.borderColor = 'var(--border)';
        effectListEl.style.backgroundColor = 'var(--bg-2)';
    });

    effectListEl.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        effectListEl.style.borderColor = 'var(--border)';
        effectListEl.style.backgroundColor = 'var(--bg-2)';
        
        if (!window.lastFolder) {
            alert("Lütfen önce bir FFX Klasörü Seçin!");
            return;
        }
        
        var files = e.dataTransfer.files;
        if (files && files.length > 0) {
            var fs = require('fs');
            var path = require('path');
            var addedCount = 0;
            
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.path && file.path.toLowerCase().endsWith('.ffx')) {
                    var dest = path.join(window.lastFolder, file.name);
                    try {
                        fs.copyFileSync(file.path, dest);
                        addedCount++;
                    } catch(err) {
                        console.error("Kopyalama hatası:", err);
                    }
                }
            }
            
            if (addedCount > 0) {
                if (typeof loadEffectList === 'function') {
                    loadEffectList(window.lastFolder);
                }
            }
        }
    });
}


// --- FX Bypass Polling ---
setInterval(function() {
    if (cs) {
        var mode = "layers";
        var modeEl = document.getElementById("fxBypassMode");
        if (modeEl) mode = modeEl.value;
        cs.evalScript('getFXBypassState("' + mode + '")', function(res) {
            var dot = document.getElementById('fxBypassStatus');
            if (dot) {
                if (res === "ON") {
                    dot.style.background = "#4ade80"; // Green
                    dot.style.boxShadow = "0 0 6px #4ade80";
                } else if (res === "OFF") {
                    dot.style.background = "#f87171"; // Red
                    dot.style.boxShadow = "0 0 6px #f87171";
                } else {
                    dot.style.background = "var(--text-dim)"; // Gray
                    dot.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";
                }
            }
        });
    }
}, 1000);


// --- Snapshot ---
var btnScreenshot = document.getElementById('btnScreenshot');
if (btnScreenshot) {
    btnScreenshot.addEventListener('click', function() {
        if (window.isEditLayoutMode) return;
        var folder = localStorage.getItem('snapshotFolder') || '';
        var alwaysAsk = localStorage.getItem('snapshotAlwaysAsk') !== 'false';
        var quality = localStorage.getItem('snapshotQuality') || 'auto';
        if (cs) {
            cs.evalScript('takeSnapshot(' + JSON.stringify(folder) + ', ' + alwaysAsk + ', ' + JSON.stringify(quality) + ')', function(res) {
                if (res && res.indexOf('ERROR:') === 0) {
                    if (res.indexOf('İptal edildi') === -1) {
                        window.showAlert(res.substring(6));
                    }
                } else if (res) {
                    showToast('✓ ' + res);
                }
            });
        }
    });
}


    var btnSelSnap = document.getElementById('btnSelectSnapshotFolder');
    if (btnSelSnap) {
        btnSelSnap.addEventListener('click', function() {
            if (cs) {
                cs.evalScript('selectSnapshotFolder()', function(res) {
                    if (res && res.indexOf("ERROR:") !== 0) {
                        localStorage.setItem('snapshotFolder', res);
                        var pEl = document.getElementById('snapshotFolderPath');
                        if (pEl) pEl.textContent = res;
                    }
                });
            }
        });
    }


// --- Auto Update Checker ---
function checkForUpdates() {
    var currentVersion = "2.0";
    try {
        var https = require('https');
        https.get('https://raw.githubusercontent.com/tarikeditss1/Tarik_Tools/main/update.json', function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try {
                    var json = JSON.parse(data);
                    if (json && json.latestVersion && json.latestVersion !== currentVersion) {
                        var badge = document.querySelector('.version-badge');
                        if (badge) {
                            badge.classList.add('has-update');
                            badge.innerText = 'v' + currentVersion + ' (Güncelle!)';
                            badge.title = 'Yeni sürüm mevcut (v' + json.latestVersion + ')! Güncellemek için tıklayın.';
                            badge.addEventListener('click', function() {
                                var url = json.downloadUrl || 'https://github.com/tarikeditss1/Tarik_Tools';
                                if (window.cep) {
                                    window.cep.util.openURLInDefaultBrowser(url);
                                }
                            });
                        }
                    }
                } catch(e) {}
            });
        }).on('error', function(err) {
            console.log("Update check error:", err);
        });
    } catch(e) {
        console.log("Node https not available for updates:", e);
    }
}

// Call update checker
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForUpdates);
} else {
    checkForUpdates();
}
