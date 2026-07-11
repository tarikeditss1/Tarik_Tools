if (typeof JSON !== 'object') {
 JSON = {};
}
if (!JSON.stringify) {
 JSON.stringify = function (obj) {
 var t = typeof (obj);
 if (t != "object" || obj === null) {
 if (t == "string") obj = '"'+obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"')+'"';
 return String(obj);
 } else {
 var n, v, json = [], arr = (obj && obj.constructor == Array);
 for (n in obj) {
 if (obj.hasOwnProperty(n)) {
 v = obj[n]; t = typeof(v);
 if (t == "string") v = '"'+v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')+'"';
 else if (t == "object" && v !== null) v = JSON.stringify(v);
 json.push((arr ? "" : '"' + n + '":') + String(v));
 }
 }
 return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
 }
 };
}
if (!JSON.parse) {
 JSON.parse = function (str) {
 return eval('(' + str + ')');
 };
}
function getComp() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) {
 return "ERROR:" + "Lütfen önce bir kompozisyon seçin.";
 return null;
 }
 return comp;
}
function getSelectedLayers(comp) {
 var layers = [];
 for (var i = 1; i <= comp.numLayers; i++) {
 if (comp.layer(i).selected) layers.push(comp.layer(i));
 }
 return layers;
}
function createNull(isNull) {
 var comp = getComp(); if (!comp) return;
 app.beginUndoGroup("SpeedFlow: Layer");
 var makeNull = (isNull === "true" || isNull === true || isNull === undefined);
 var sel = getSelectedLayers(comp);
 var activeL = (sel.length > 0) ? sel[0] : null;
 var w = comp.width;
 var h = comp.height;
 if (activeL) {
 if (activeL.source && activeL.source.width && activeL.source.height) {
 w = activeL.source.width;
 h = activeL.source.height;
 } else if (activeL.width && activeL.height) {
 w = activeL.width;
 h = activeL.height;
 }
 }
 var newLayer;
 if (makeNull) {
 newLayer = comp.layers.addNull();
 newLayer.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2, comp.height/2]);
 try { newLayer.startTime = 0; newLayer.inPoint = 0; newLayer.outPoint = comp.duration; } catch(e){}
 } else {
 newLayer = comp.layers.addSolid([1, 1, 1], "Adjustment Layer", w, h, 1, comp.duration);
 newLayer.adjustmentLayer = true;
 try { newLayer.label = 11; } catch(e){}
 try { newLayer.startTime = 0; newLayer.inPoint = 0; newLayer.outPoint = comp.duration; } catch(e){}
 }
 if (activeL) {
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Anchor Point").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Anchor Point").value
 );
 } catch(e){}
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Position").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Position").value
 );
 } catch(e){}
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Scale").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Scale").value
 );
 } catch(e){}
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Rotate Z").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Rotate Z").value
 );
 } catch(e){}
 try {
 newLayer.startTime = activeL.startTime;
 newLayer.inPoint = activeL.inPoint;
 newLayer.outPoint = activeL.outPoint;
 } catch(e){}
 try {
 newLayer.moveBefore(activeL);
 } catch(e){}
 } else {
 try {
 newLayer.startTime = 0;
 newLayer.inPoint = 0;
 newLayer.outPoint = comp.duration;
 } catch(e){}
 }
 app.endUndoGroup();
}
function createSolidOrCamera(isCamera, r, g, b) {
 var comp = getComp(); if (!comp) return;
 app.beginUndoGroup("SpeedFlow: Solid/Camera");
 var makeCamera = (isCamera === "true" || isCamera === true);
 var sel = getSelectedLayers(comp);
 var activeL = (sel.length > 0) ? sel[0] : null;
 var w = comp.width;
 var h = comp.height;
 if (activeL) {
 if (activeL.source && activeL.source.width && activeL.source.height) {
 w = activeL.source.width;
 h = activeL.source.height;
 } else if (activeL.width && activeL.height) {
 w = activeL.width;
 h = activeL.height;
 }
 }
 var newLayer;
 if (makeCamera) {
 var center = [comp.width/2, comp.height/2];
 newLayer = comp.layers.addCamera("Camera 1", center);
 try { newLayer.startTime = 0; newLayer.inPoint = 0; newLayer.outPoint = comp.duration; } catch(e){}
 } else {
 var red = parseFloat(r);
 var green = parseFloat(g);
 var blue = parseFloat(b);
 if (isNaN(red)) red = 0.1;
 if (isNaN(green)) green = 0.1;
 if (isNaN(blue)) blue = 0.1;
 newLayer = comp.layers.addSolid([red, green, blue], "Solid", w, h, 1, comp.duration);
 try { newLayer.startTime = 0; newLayer.inPoint = 0; newLayer.outPoint = comp.duration; } catch(e){}
 }
 if (activeL) {
 if (!makeCamera) {
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Anchor Point").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Anchor Point").value
 );
 } catch(e){}
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Position").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Position").value
 );
 } catch(e){}
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Scale").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Scale").value
 );
 } catch(e){}
 try {
 newLayer.property("ADBE Transform Group").property("ADBE Rotate Z").setValue(
 activeL.property("ADBE Transform Group").property("ADBE Rotate Z").value
 );
 } catch(e){}
 }
 try {
 newLayer.startTime = activeL.startTime;
 newLayer.inPoint = activeL.inPoint;
 newLayer.outPoint = activeL.outPoint;
 } catch(e){}
 try {
 newLayer.moveBefore(activeL);
 } catch(e){}
 } else {
 try {
 newLayer.startTime = 0;
 newLayer.inPoint = 0;
 newLayer.outPoint = comp.duration;
 } catch(e){}
 }
 app.endUndoGroup();
}
function doPrecomp() {
 var comp = getComp(); if (!comp) return;
 var sel = getSelectedLayers(comp);
 if (sel.length === 0) { return "ERROR:" + "Pre-comp için katman seçin."; return; }
 app.beginUndoGroup("SpeedFlow: Pre-Comp");
 var idxArr = [];
 for (var i = 0; i < sel.length; i++) idxArr.push(sel[i].index);
 comp.layers.precompose(idxArr, "Pre-Comp", true);
 app.endUndoGroup();
}
function smartAlign(alignToFirst) {
 var comp = getComp(); if (!comp) return;
 var sel = getSelectedLayers(comp);
 if (sel.length < 2) { return "ERROR:" + "Hizalamak için en az 2 katman seçin."; }
 var toFirst = (alignToFirst === "true" || alignToFirst === true);
 app.beginUndoGroup("SpeedFlow: Hizala");
 if (toFirst) {
 var targetPos = sel[0].property("ADBE Transform Group").property("ADBE Position").value;
 for (var i = 1; i < sel.length; i++) {
 try {
 sel[i].property("ADBE Transform Group").property("ADBE Position").setValue(targetPos);
 } catch(e){}
 }
 } else {
 var cx = comp.width / 2, cy = comp.height / 2;
 for (var i = 0; i < sel.length; i++) {
 try {
 sel[i].property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);
 } catch(e){}
 }
 }
 app.endUndoGroup();
}
function duplicateCompHierarchy(compItem, duplicatedCompsMap) {
 if (duplicatedCompsMap[compItem.id]) {
 return duplicatedCompsMap[compItem.id];
 }
 var newComp = compItem.duplicate();
 duplicatedCompsMap[compItem.id] = newComp;
 for (var i = 1; i <= newComp.numLayers; i++) {
 var layer = newComp.layer(i);
 if (layer.source && layer.source instanceof CompItem) {
 var newSource = duplicateCompHierarchy(layer.source, duplicatedCompsMap);
 layer.replaceSource(newSource, false);
 }
 }
 return newComp;
}
function trueDuplicate() {
 try {
 var comp = getComp(); if (!comp) return;
 var sel = getSelectedLayers(comp);
 if (!sel.length) { return "ERROR:" + "Kopyalamak için katman seçin."; }
 for (var i = 0; i < sel.length; i++) {
 if (!sel[i].source || !(sel[i].source instanceof CompItem)) {
 return "ERROR:" + "Yalnızca Pre-Comp katmanlarında bağımsız kopyalama yapılabilir.";
 }
 }
 app.beginUndoGroup("SpeedFlow: True Duplicate");
 var duplicatedCompsMap = {};
 var playheadTime = comp.time;
 for (var i = 0; i < sel.length; i++) {
 var layer = sel[i];
 var newLayer = layer.duplicate();
 newLayer.moveBefore(layer);
 var startOffset = layer.inPoint - layer.startTime;
 newLayer.startTime = playheadTime - startOffset;
 var visibleDuration = layer.outPoint - layer.inPoint;
 newLayer.inPoint = playheadTime;
 newLayer.outPoint = playheadTime + visibleDuration;
 if (layer.source && layer.source instanceof CompItem) {
 var newSource = duplicateCompHierarchy(layer.source, duplicatedCompsMap);
 newLayer.replaceSource(newSource, false);
 }
 layer.selected = false;
 newLayer.selected = true;
 }
 app.endUndoGroup();
 } catch (e) {
 return "ERROR:" + e.toString();
 }
}
function removeKeysRecursively(propParent) {
 for (var i = 1; i <= propParent.numProperties; i++) {
 var prop = propParent.property(i);
 if (prop.propertyType === PropertyType.PROPERTY) {
 if (prop.numKeys > 0) {
 for (var k = prop.numKeys; k >= 1; k--) prop.removeKey(k);
 }
 } else {
 removeKeysRecursively(prop);
 }
 }
}
function removeExpressionsRecursively(propParent) {
 for (var i = 1; i <= propParent.numProperties; i++) {
 var prop = propParent.property(i);
 if (prop.propertyType === PropertyType.PROPERTY) {
 if (prop.canSetExpression && prop.expressionEnabled) {
 prop.expression = "";
 }
 } else {
 removeExpressionsRecursively(prop);
 }
 }
}
function resetTransformProperties(layer) {
 var trans = layer.property("ADBE Transform Group");
 if (trans) {
 var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
 for (var i = 0; i < props.length; i++) {
 var p = trans.property(props[i]);
 if (p) {
 try {
 while (p.numKeys > 0) p.removeKey(1);
 if (p.canSetExpression) {
 p.expression = "";
 p.expressionEnabled = false;
 }
 } catch(e){}
 }
 }
 var ap = [0, 0, 0];
 if (layer.nullObject) {
 ap = [50, 50, 0];
 } else if (layer.width && layer.height) {
 ap = [layer.width / 2, layer.height / 2, 0];
 }
 try { trans.property("ADBE Anchor Point").setValue(ap); } catch(e){}
 var pos = [layer.containingComp.width / 2, layer.containingComp.height / 2, 0];
 try { trans.property("ADBE Position").setValue(pos); } catch(e){}
 try { trans.property("ADBE Scale").setValue([100, 100, 100]); } catch(e){}
 try { trans.property("ADBE Rotate Z").setValue(0); } catch(e){}
 try { trans.property("ADBE Opacity").setValue(100); } catch(e){}
 }
}
function cleanLayers(cEffects, cMasks, cKeys, cExpr, cTrans) {
 var comp = getComp(); if (!comp) return;
 var sel = getSelectedLayers(comp);
 if (!sel.length) { return "ERROR:" + "Temizlemek için katman seçin."; }
 var delEffects = (cEffects === "true" || cEffects === true);
 var delMasks = (cMasks === "true" || cMasks === true);
 var delKeys = (cKeys === "true" || cKeys === true);
 var delExpr = (cExpr === "true" || cExpr === true);
 var resetTrans = (cTrans === "true" || cTrans === true);
 app.beginUndoGroup("SpeedFlow: Temizle");
 for (var i = 0; i < sel.length; i++) {
 var layer = sel[i];
 if (delEffects) {
 try { 
 var fxParade = layer.property("ADBE Effect Parade");
 while (fxParade && fxParade.numProperties > 0) fxParade.property(1).remove(); 
 } catch(e){}
 }
 if (delMasks) {
 try { 
 var maskParade = layer.property("ADBE Mask Parade");
 while (maskParade && maskParade.numProperties > 0) maskParade.property(1).remove(); 
 } catch(e){}
 }
 if (delKeys) {
 try { removeKeysRecursively(layer); } catch(e){}
 }
 if (delExpr) {
 try { removeExpressionsRecursively(layer); } catch(e){}
 }
 if (resetTrans) {
 try { resetTransformProperties(layer); } catch(e){}
 }
 }
 app.endUndoGroup();
}
function reverseLayerOrder() {
 var comp = getComp(); if (!comp) return;
 var sel = getSelectedLayers(comp);
 if (sel.length < 2) { return "ERROR:" + "En az 2 katman seçin."; return; }
 app.beginUndoGroup("SpeedFlow: Ters");
 var indices = [];
 for (var i = 0; i < sel.length; i++) indices.push(sel[i].index);
 indices.sort(function(a,b){return a-b;});
 var total = indices.length;
 for (var j = 0; j < Math.floor(total/2); j++) {
 comp.layer(indices[j]).moveAfter(comp.layer(indices[total-1-j]));
 }
 app.endUndoGroup();
}
function applyFlow(opts) {
 var comp = getComp(); if (!comp) return;
 var sel = getSelectedLayers(comp);
 if (!sel.length) return "ERROR:Flow icin katman secin.";
 app.beginUndoGroup("SpeedFlow: Flow");
 var cp1x = opts.cp1x !== undefined ? opts.cp1x : 0.25;
 var cp1y = opts.cp1y !== undefined ? opts.cp1y : 0.25;
 var cp2x = opts.cp2x !== undefined ? opts.cp2x : 0.75;
 var cp2y = opts.cp2y !== undefined ? opts.cp2y : 0.75;
 var outInfluence = Math.min(99, Math.max(1, cp1x * 100));
 var inInfluence = Math.min(99, Math.max(1, (1 - cp2x) * 100));
 var outSlope = cp1y / (outInfluence / 100);
 var inSlope = (1 - cp2y) / (inInfluence / 100);
 var isLinear = (opts.type === "linear");
 var kfMode = opts.kfMode || "auto";
 for (var i = 0; i < sel.length; i++) {
 applyToPropertiesRecursive(sel[i], isLinear, outSlope, outInfluence, inSlope, inInfluence, kfMode);
 }
 app.endUndoGroup();
}
function applyToPropertiesRecursive(parent, isLinear, outSlope, outInf, inSlope, inInf, kfMode) {
 for (var p = 1; p <= parent.numProperties; p++) {
 var prop = parent.property(p);
 if (prop.propertyType === PropertyType.PROPERTY) {
 if (prop.numKeys >= 2) {
 applyEaseToProp(prop, isLinear, outSlope, outInf, inSlope, inInf, kfMode);
 }
 } else {
 applyToPropertiesRecursive(prop, isLinear, outSlope, outInf, inSlope, inInf, kfMode);
 }
 }
}
function getValueSpeed(prop, k1, k2) {
 try {
 var t1 = prop.keyTime(k1);
 var t2 = prop.keyTime(k2);
 var dt = t2 - t1;
 if (dt <= 0) return null;
 var v1 = prop.keyValue(k1);
 var v2 = prop.keyValue(k2);
 var ptype = prop.propertyValueType;
 if (ptype === PropertyValueType.OneD) {
 return (v2 - v1) / dt;
 } else if (ptype === PropertyValueType.TwoD_SPATIAL || ptype === PropertyValueType.ThreeD_SPATIAL) {
 var dx = v2[0]-v1[0], dy = v2[1]-v1[1], dz = (v2.length > 2 ? v2[2]-v1[2] : 0);
 return Math.sqrt(dx*dx + dy*dy + dz*dz) / dt;
 } else if (ptype === PropertyValueType.TwoD || ptype === PropertyValueType.ThreeD || ptype === PropertyValueType.COLOR) {
 var arr = [];
 for (var i = 0; i < v2.length; i++) {
 arr.push((v2[i] - v1[i]) / dt);
 }
 return arr;
 }
 } catch(e) {}
 return null;
}
function applyEaseToProp(prop, isLinear, outSlope, outInf, inSlope, inInf, kfMode) {
 var keysToApply = [];
 if (kfMode === "auto") {
 var selKeys = prop.selectedKeys;
 if (selKeys && selKeys.length > 0) {
 keysToApply = selKeys;
 } else {
 for (var k = 1; k <= prop.numKeys; k++) keysToApply.push(k);
 }
 } else {
 var count = parseInt(kfMode) || 2;
 var startKey = (prop.selectedKeys && prop.selectedKeys.length > 0) ? prop.selectedKeys[0] : 1;
 for (var k = startKey; k < startKey + count && k <= prop.numKeys; k++) {
 keysToApply.push(k);
 }
 }
 if (keysToApply.length < 2) return;
 var firstKey = keysToApply[0];
 var lastKey = keysToApply[keysToApply.length - 1];
 var ptype = prop.propertyValueType;
 var isSpatial = (ptype === PropertyValueType.TwoD_SPATIAL || ptype === PropertyValueType.ThreeD_SPATIAL);
 var dimCount = 1;
 if (!isSpatial && (ptype === PropertyValueType.TwoD || ptype === PropertyValueType.ThreeD || ptype === PropertyValueType.COLOR)) {
 dimCount = prop.keyValue(firstKey).length;
 }
 for (var idx = 0; idx < keysToApply.length; idx++) {
 var ki = keysToApply[idx];
 try {
 var isFirstKey = (ki === firstKey);
 var isLastKey = (ki === lastKey);
 var segSpdOut = null, segSpdIn = null;
 if (!isLastKey && idx+1 < keysToApply.length) segSpdOut = getValueSpeed(prop, ki, keysToApply[idx+1]);
 if (!isFirstKey && idx-1 >= 0) segSpdIn = getValueSpeed(prop, keysToApply[idx-1], ki);
 var easeInArr = [];
 var easeOutArr = [];
 for (var d = 0; d < dimCount; d++) {
 var linearOut = 0, linearIn = 0;
 if (segSpdOut !== null) {
 linearOut = (segSpdOut instanceof Array) ? segSpdOut[d] : segSpdOut;
 }
 if (segSpdIn !== null) {
 linearIn = (segSpdIn instanceof Array) ? segSpdIn[d] : segSpdIn;
 }
 var aeSpeedOut = outSlope * linearOut;
 var aeSpeedIn = inSlope * linearIn;
 if (isSpatial) {
 aeSpeedOut = Math.abs(aeSpeedOut);
 aeSpeedIn = Math.abs(aeSpeedIn);
 }
 if (isLinear) {
 easeInArr.push( new KeyframeEase(0, 33.33));
 easeOutArr.push(new KeyframeEase(0, 33.33));
 } else if (isFirstKey) {
 easeInArr.push( new KeyframeEase(0, 33.33));
 easeOutArr.push(new KeyframeEase(aeSpeedOut, outInf));
 } else if (isLastKey) {
 easeInArr.push( new KeyframeEase(aeSpeedIn, inInf));
 easeOutArr.push(new KeyframeEase(0, 33.33));
 } else {
 easeInArr.push( new KeyframeEase(aeSpeedIn, inInf));
 easeOutArr.push(new KeyframeEase(aeSpeedOut, outInf));
 }
 }
 var interpType = isLinear ? KeyframeInterpolationType.LINEAR : KeyframeInterpolationType.BEZIER;
 try { prop.setInterpolationTypeAtKey(ki, interpType, interpType); } catch(e) {}
 prop.setTemporalEaseAtKey(ki, easeInArr, easeOutArr);
 if (!isFirstKey && !isLastKey) {
 try { prop.setTemporalContinuousAtKey(ki, true); } catch(e) {}
 try {
 if (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
 prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {
 prop.setRovingAtKey(ki, true);
 }
 } catch(e) {}
 }
 } catch(e) {}
 }
}
function readFlowFromSelected() {
 var comp = getComp(); if (!comp) return JSON.stringify(null);
 var prop = null;
 var selProps = comp.selectedProperties;
 if (selProps && selProps.length > 0) {
 for (var i = 0; i < selProps.length; i++) {
 if (selProps[i].propertyType === PropertyType.PROPERTY && selProps[i].numKeys >= 2) {
 prop = selProps[i]; break;
 }
 }
 }
 if (!prop) {
 var selLayers = getSelectedLayers(comp);
 if (selLayers.length > 0) prop = findFirstKeyframedProp(selLayers[0]);
 }
 if (!prop) return JSON.stringify(null);
 try {
 var selKeys = prop.selectedKeys || [];
 if (selKeys.length < 1) return JSON.stringify(null);
 var firstKey = selKeys[0];
 var lastKey = selKeys.length > 1 ? selKeys[selKeys.length - 1] : selKeys[0];
 var easeOut = prop.keyOutTemporalEase(firstKey); 
 var easeIn = prop.keyInTemporalEase(lastKey); 
 var outSpeed = easeOut[0].speed;
 var outInfluence = easeOut[0].influence;
 var inSpeed = easeIn[0].speed;
 var inInfluence = easeIn[0].influence;
 var segSpeedRaw = getValueSpeed(prop, firstKey, lastKey);
 var segSpeed = (segSpeedRaw instanceof Array) ? segSpeedRaw[0] : segSpeedRaw;
 var outSlope = 0;
 var inSlope = 0;
 if (Math.abs(segSpeed) > 0.0001) {
 outSlope = outSpeed / Math.abs(segSpeed);
 inSlope = inSpeed / Math.abs(segSpeed);
 } else {
 outSlope = (Math.abs(outSpeed) > 0 ? 1 : 0);
 inSlope = (Math.abs(inSpeed) > 0 ? 1 : 0);
 }
 return JSON.stringify({
 propertyName: prop.name,
 selectedKeysCount: selKeys.length,
 totalKeys: prop.numKeys,
 outInfluence: outInfluence,
 inInfluence: inInfluence,
 outSlope: outSlope,
 inSlope: inSlope,
 outSpeed: outSpeed,
 inSpeed: inSpeed
 });
 } catch(e) {
 return JSON.stringify({ error: e.toString() });
 }
}
function findFirstKeyframedProp(parent) {
 for (var p = 1; p <= parent.numProperties; p++) {
 var prop = parent.property(p);
 if (prop.propertyType === PropertyType.PROPERTY) {
 if (prop.numKeys >= 2) return prop;
 } else {
 var res = findFirstKeyframedProp(prop);
 if (res) return res;
 }
 }
 return null;
}
function selectFFXFolder() {
 try {
 var folder = Folder.selectDialog("FFX klasörünü seçin");
 if (!folder) return JSON.stringify(null);
 var raw = folder.getFiles("*.ffx");
 var files = [];
 for (var i = 0; i < raw.length; i++) {
 var safePath = raw[i].fsName.split('\\').join('/');
 files.push({
 name: raw[i].name,
 path: safePath
 });
 }
 var safeFolderPath = folder.fsName.split('\\').join('/');
 return JSON.stringify({ path: safeFolderPath, files: files });
 } catch(e) {
 return JSON.stringify({ error: e.toString() });
 }
}
function getFFXFiles(folderPath) {
 try {
 var folder = new Folder(folderPath);
 if (!folder.exists) return JSON.stringify({ error: "Klasör bulunamadı." });
 var raw = folder.getFiles("*.ffx");
 var files = [];
 for (var i = 0; i < raw.length; i++) {
 var safePath = raw[i].fsName.split('\\').join('/');
 files.push({
 name: raw[i].name,
 path: safePath
 });
 }
 var safeFolderPath = folder.fsName.split('\\').join('/');
 return JSON.stringify({ path: safeFolderPath, files: files });
 } catch(e) {
 return JSON.stringify({ error: e.toString() });
 }
}
function stretchKeyframesToLayer(layer) {
 var startT = layer.inPoint;
 var endT = layer.outPoint;
 var targetDur = endT - startT;
 if (targetDur <= 0) return;
 function traverse(prop) {
 if (prop.propertyType === PropertyType.PROPERTY) {
 if (prop.numKeys > 1) {
 var firstK = prop.keyTime(1);
 var lastK = prop.keyTime(prop.numKeys);
 var sourceDur = lastK - firstK;
 if (sourceDur > 0) {
 var keys = [];
 for (var k = 1; k <= prop.numKeys; k++) {
 keys.push({
 time: prop.keyTime(k),
 value: prop.keyValue(k),
 inEase: prop.keyInTemporalEase(k),
 outEase: prop.keyOutTemporalEase(k),
 inInterp: prop.keyInInterpolationType(k),
 outInterp: prop.keyOutInterpolationType(k)
 });
 }
 while (prop.numKeys > 0) prop.removeKey(1);
 var S = targetDur / sourceDur;
 for (var j = 0; j < keys.length; j++) {
 var ratio = (keys[j].time - firstK) / sourceDur;
 var newT = startT + (ratio * targetDur);
 var newIdx = prop.addKey(newT);
 prop.setValueAtKey(newIdx, keys[j].value);
 var newInEase = [];
 for (var ei = 0; ei < keys[j].inEase.length; ei++) {
 var oldE = keys[j].inEase[ei];
 try { newInEase.push(new KeyTemporalEase(oldE.speed / S, oldE.influence)); } catch (e) { newInEase.push(oldE); }
 }
 var newOutEase = [];
 for (var eo = 0; eo < keys[j].outEase.length; eo++) {
 var oldEO = keys[j].outEase[eo];
 try { newOutEase.push(new KeyTemporalEase(oldEO.speed / S, oldEO.influence)); } catch (e) { newOutEase.push(oldEO); }
 }
 try { prop.setTemporalEaseAtKey(newIdx, newInEase, newOutEase); } catch (e) {
 try { prop.setTemporalEaseAtKey(newIdx, keys[j].inEase, keys[j].outEase); } catch (e2) { }
 }
 prop.setInterpolationTypeAtKey(newIdx, keys[j].inInterp, keys[j].outInterp);
 }
 }
 }
 } else {
 for (var i = 1; i <= prop.numProperties; i++) {
 traverse(prop.property(i));
 }
 }
 }
 traverse(layer);
}
function applyFFX(ffxPath, applyAtInPoint, stretchPresets) {
 var comp = getComp(); if (!comp) return "No comp";
 var sel = getSelectedLayers(comp);
 if (!sel.length) { return "Error: Katman seçin."; }
 var preset = new File(ffxPath);
 if (!preset.exists) { return "Error: Dosya yok."; }
 app.beginUndoGroup("SpeedFlow: FFX Uygula");
 try {
 var originalSelection = [];
 for (var m = 0; m < sel.length; m++) originalSelection.push(sel[m]);
 var savedTime = comp.time;
 for (var i = 0; i < originalSelection.length; i++) {
 var layer = originalSelection[i];
 for (var j = 1; j <= comp.numLayers; j++) comp.layer(j).selected = false;
 layer.selected = true;
 if (applyAtInPoint === "true" || applyAtInPoint === true) {
 comp.time = layer.inPoint;
 }
 layer.applyPreset(preset);
 if (stretchPresets === "true" || stretchPresets === true) {
 stretchKeyframesToLayer(layer);
 }
 }
 for (var k = 1; k <= comp.numLayers; k++) comp.layer(k).selected = false;
 for (var m = 0; m < originalSelection.length; m++) originalSelection[m].selected = true;
 if (applyAtInPoint === "true" || applyAtInPoint === true) {
 comp.time = savedTime;
 }
 app.endUndoGroup();
 return "Success";
 } catch(e) {
 app.endUndoGroup();
 return "Error: " + e.toString();
 }
}
function httpPost(url, apiKey, bodyStr) {
 var parsed = parseUrl(url);
 var host = parsed.host;
 var path = parsed.path;
 var port = parsed.port || (parsed.protocol === 'https' ? 443 : 80);
 var useSSL = parsed.protocol === 'https';
 var conn = new Socket();
 conn.encoding = 'UTF-8';
 conn.timeout = 60; 
 var connected = useSSL ? conn.open(host + ':' + port, 'SSL') : conn.open(host + ':' + port);
 if (!connected) return JSON.stringify({ error: 'Sunucuya bağlanılamadı: ' + host });
 var req = 'POST ' + path + ' HTTP/1.1\r\n' +
 'Host: ' + host + '\r\n' +
 'Authorization: ApiKey ' + apiKey + '\r\n' +
 'Content-Type: application/json\r\n' +
 'Content-Length: ' + bodyStr.length + '\r\n' +
 'Connection: close\r\n\r\n' +
 bodyStr;
 conn.write(req);
 var resp = '';
 while (!conn.eof) { resp += conn.read(4096); }
 conn.close();
 var parts = resp.split('\r\n\r\n');
 var body = parts.length > 1 ? parts.slice(1).join('\r\n\r\n') : '';
 if (resp.indexOf('Transfer-Encoding: chunked') !== -1) {
 body = dechunkHttp(body);
 }
 return body || JSON.stringify({ error: 'Boş yanıt' });
}
function httpGet(url, apiKey) {
 var parsed = parseUrl(url);
 var host = parsed.host;
 var path = parsed.path;
 var port = parsed.port || (parsed.protocol === 'https' ? 443 : 80);
 var useSSL = parsed.protocol === 'https';
 var conn = new Socket();
 conn.encoding = 'UTF-8';
 conn.timeout = 20;
 var connected = useSSL ? conn.open(host + ':' + port, 'SSL') : conn.open(host + ':' + port);
 if (!connected) return JSON.stringify({ error: 'Sunucuya bağlanılamadı' });
 var reqHeaders = 'GET ' + path + ' HTTP/1.1\r\n' +
 'Host: ' + host + '\r\n' +
 (apiKey ? 'Authorization: ApiKey ' + apiKey + '\r\n' : '') +
 'Connection: close\r\n\r\n';
 conn.write(reqHeaders);
 var resp = '';
 while (!conn.eof) { resp += conn.read(4096); }
 conn.close();
 var parts = resp.split('\r\n\r\n');
 var body = parts.length > 1 ? parts.slice(1).join('\r\n\r\n') : '';
 if (resp.indexOf('Transfer-Encoding: chunked') !== -1) {
 body = dechunkHttp(body);
 }
 return body || JSON.stringify({ error: 'Boş yanıt' });
}
function parseUrl(url) {
 var protocol = "https";
 var host = "tariktools.com";
 var path = "/";
 var port = 443;
 if (url.indexOf("http:
 protocol = "http";
 url = url.substring(7);
 port = 80;
 } else if (url.indexOf("https:
 protocol = "https";
 url = url.substring(8);
 port = 443;
 }
 var slashIdx = url.indexOf("/");
 if (slashIdx !== -1) {
 path = url.substring(slashIdx);
 host = url.substring(0, slashIdx);
 } else {
 host = url;
 }
 var colonIdx = host.indexOf(":");
 if (colonIdx !== -1) {
 port = parseInt(host.substring(colonIdx + 1), 10);
 host = host.substring(0, colonIdx);
 }
 return { protocol: protocol, host: host, port: port, path: path };
}
function dechunkHttp(chunked) {
 var result = '';
 var pos = 0;
 while (pos < chunked.length) {
 var end = chunked.indexOf('\r\n', pos);
 if (end === -1) break;
 var size = parseInt(chunked.substring(pos, end), 16);
 if (isNaN(size) || size === 0) break;
 pos = end + 2;
 result += chunked.substring(pos, pos + size);
 pos += size + 2;
 }
 return result;
}
function fetchApiKeyFromSite(baseUrl) {
 return httpGet(baseUrl + '/api/external/api-key', null);
}
function getCreditsFromSite(baseUrl, apiKey) {
 var raw = httpGet(baseUrl + '/api/external/api-key', apiKey);
 try {
 var data = JSON.parse(raw);
 if (data && data.error) {
 return JSON.stringify({ error: data.error });
 }
 if (data && data.credits !== undefined) {
 return JSON.stringify({ credits: data.credits });
 }
 return JSON.stringify({ error: "Bilinmeyen sunucu yanıtı" });
 } catch(e) {
 return JSON.stringify({ error: "Bağlantı hatası: " + e.message });
 }
}
function callTranscribeAPI(baseUrl, apiKey, payloadStr) {
 return httpPost(baseUrl + '/api/external/transcribe', apiKey, payloadStr);
}
function saveSRTFile(srtContent) {
 var f = File.saveDialog("SRT Dosyasını Kaydet", "SRT Files:*.srt");
 if (!f) return;
 f.encoding = 'UTF-8';
 f.open('w');
 f.write(srtContent);
 f.close();
}
function importSubtitleToAE(segmentsJson, timeOffset) {
 var comp = getComp(); if (!comp) return;
 var segments;
 try { segments = JSON.parse(segmentsJson); } catch(e) { return "ERROR:" + "Segment verisi geçersiz."; return; }
 if (!segments || !segments.length) { return "ERROR:" + "Segment bulunamadı."; return; }
 var offset = parseFloat(timeOffset) || 0;
 app.beginUndoGroup("SpeedFlow: Altyazı Aktar");
 for (var i = segments.length - 1; i >= 0; i--) {
 try {
 var seg = segments[i];
 var textVal = String(seg.text || "");
 if (!textVal.trim()) continue; 
 var layer = comp.layers.addText(textVal);
 layer.name = "Sub " + (i + 1) + " - " + textVal.substring(0, 20);
 var startT = parseFloat(seg.start);
 var endT = parseFloat(seg.end);
 if (isNaN(startT)) startT = 0;
 if (isNaN(endT)) endT = 1;
 layer.inPoint = startT + offset;
 layer.outPoint = endT + offset;
 var src = layer.property("Source Text");
 var td = src.value;
 td.font = "Arial Bold";
 td.fontSize = 60;
 td.justification = ParagraphJustification.CENTER_JUSTIFY;
 src.setValue(td);
 layer.property("Transform").property("Position").setValue([comp.width / 2, comp.height * 0.85]);
 } catch(err) {
 }
 }
 app.endUndoGroup();
}
function importSubtitleToAE_FromFile(jsonFilePath, timeOffset) {
 var comp = getComp(); if (!comp) return "HATA: Kompozisyon yok";
 var f = new File(jsonFilePath);
 if (!f.exists) { return "HATA: JSON dosyası bulunamadı: " + jsonFilePath; }
 f.encoding = 'UTF-8';
 f.open('r');
 var segmentsJson = f.read();
 f.close();
 try { f.remove(); } catch(e){}
 var segments;
 try { segments = JSON.parse(segmentsJson); } catch(e) { return "HATA: JSON parse hatası"; }
 if (!segments || !segments.length) { return "HATA: Segment dizisi boş"; }
 var offset = parseFloat(timeOffset) || 0;
 app.beginUndoGroup("SpeedFlow: Altyazı Aktar");
 var createdCount = 0;
 for (var i = 0; i < segments.length; i++) {
 try {
 var seg = segments[i];
 var textVal = String(seg.text || "");
 if (textVal.replace(/^\s+|\s+$/g, '') === '') continue;
 var layer = comp.layers.addText(textVal);
 layer.name = "Sub " + (i + 1) + " - " + textVal.substring(0, 20);
 var startT = parseFloat(seg.start);
 var endT = parseFloat(seg.end);
 if (isNaN(startT)) startT = 0;
 if (isNaN(endT)) endT = 1;
 layer.inPoint = startT + offset;
 layer.outPoint = endT + offset;
 var src = layer.property("Source Text");
 var td = src.value;
 td.font = "Arial Bold";
 td.fontSize = 60;
 td.justification = ParagraphJustification.CENTER_JUSTIFY;
 src.setValue(td);
 layer.property("Transform").property("Position").setValue([comp.width / 2, comp.height * 0.85]);
 createdCount++;
 } catch(err) {
 }
 }
 app.endUndoGroup();
 return "BAŞARILI: " + createdCount + " katman oluşturuldu";
}
function getActiveCompName() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) return "";
 return comp.name;
}
function getSelectedLayerName() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) return "";
 var sel = comp.selectedLayers;
 if (sel.length === 0) return "";
 return sel[0].name;
}
function getSelectedLayerInPoint() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) return 0;
 var sel = comp.selectedLayers;
 if (sel.length === 0) return 0;
 return sel[0].inPoint;
}
function getSelectedLayerSourcePath() {
 try {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) {
 return '{"error": "Lütfen önce bir kompozisyon seçin."}';
 }
 var sel = comp.selectedLayers;
 if (sel.length === 0) {
 return '{"error": "Lütfen altyazı oluşturulacak katmanı seçin."}';
 }
 var selectedLayer = sel[0];
 function getFileFromLayer(lyr) {
 if (lyr.source && lyr.source instanceof CompItem) {
 for (var i = 1; i <= lyr.source.numLayers; i++) {
 var childLyr = lyr.source.layer(i);
 var f = getFileFromLayer(childLyr);
 if (f) return f;
 }
 } else if (lyr.source && lyr.source.file && lyr.source.file.exists) {
 return lyr.source.file;
 }
 return null;
 }
 var sourceFile = getFileFromLayer(selectedLayer);
 if (sourceFile) {
 var st = selectedLayer.startTime || 0;
 var ip = selectedLayer.inPoint || 0;
 var op = selectedLayer.outPoint || 0;
 return '{"success":true,"hasSourceFile":true,"path":"' + encodeURIComponent(sourceFile.fsName) + '","startTime":' + st + ',"inPoint":' + ip + ',"outPoint":' + op + '}';
 }
 return '{"success":true,"hasSourceFile":false}';
 } catch(e) {
 return '{"error":"' + encodeURIComponent(e.toString()) + '"}';
 }
}
function exportSelectedLayerAudio() {
 try {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) {
 return JSON.stringify({ error: "Lütfen önce bir kompozisyon seçin." });
 }
 var sel = comp.selectedLayers;
 if (sel.length === 0) {
 return JSON.stringify({ error: "Lütfen altyazı oluşturulacak ses katmanını seçin." });
 }
 var selectedLayer = sel[0];
 if (!selectedLayer.hasAudio) {
 return JSON.stringify({ error: "Seçili katman ses barındırmıyor." });
 }
 var tempDir = Folder.temp;
 var wavFile = new File(tempDir.fsName + "/ae_temp_audio_" + new Date().getTime() + ".wav");
 app.beginUndoGroup("SpeedFlow: Altyazı Render");
 var originalQueueStates = [];
 try {
 var numItems = app.project.renderQueue.numItems;
 for (var qIdx = 1; qIdx <= numItems; qIdx++) {
 var item = app.project.renderQueue.item(qIdx);
 if (item) {
 originalQueueStates.push({
 item: item,
 render: item.render
 });
 item.render = false;
 }
 }
 } catch(queueErr) {
 }
 var oldSoloStates = [];
 var oldAudioStates = [];
 for (var i = 1; i <= comp.numLayers; i++) {
 var lyr = comp.layer(i);
 try {
 oldSoloStates.push(lyr.solo);
 } catch(e) {
 oldSoloStates.push(false);
 }
 try {
 oldAudioStates.push(lyr.audioEnabled);
 } catch (e) {
 oldAudioStates.push(true);
 }
 try {
 lyr.solo = false;
 } catch(e) {}
 }
 try {
 selectedLayer.solo = true;
 } catch(e) {}
 try {
 selectedLayer.audioEnabled = true;
 } catch(e) {}
 var oldStart = comp.workAreaStart;
 var oldDuration = comp.workAreaDuration;
 var newStart = selectedLayer.inPoint;
 var newDuration = selectedLayer.outPoint - selectedLayer.inPoint;
 if (newStart < 0) newStart = 0;
 if (newStart + newDuration > comp.duration) newDuration = comp.duration - newStart;
 comp.workAreaDuration = comp.frameDuration; 
 comp.workAreaStart = newStart;
 comp.workAreaDuration = newDuration;
 var tempDir = Folder.temp;
 var wavFile = new File(tempDir.fsName + "/ae_temp_audio_" + new Date().getTime() + ".wav");
 var rqItem;
 try {
 rqItem = app.project.renderQueue.items.add(comp);
 } catch(err) {
 for (var qIdx = 0; qIdx < originalQueueStates.length; qIdx++) {
 try { originalQueueStates[qIdx].item.render = originalQueueStates[qIdx].render; } catch(e){}
 }
 for (var i = 1; i <= comp.numLayers; i++) {
 try { comp.layer(i).solo = oldSoloStates[i-1]; } catch(e){}
 try { comp.layer(i).audioEnabled = oldAudioStates[i-1]; } catch(e){}
 }
 comp.workAreaDuration = comp.frameDuration;
 comp.workAreaStart = oldStart;
 comp.workAreaDuration = oldDuration;
 app.endUndoGroup();
 return JSON.stringify({ error: "Render kuyruğuna eklenemedi: " + err.toString() });
 }
 var outputModule = rqItem.outputModule(1);
 var templateApplied = false;
 try {
 var allTemplates = outputModule.templates;
 for (var i = 0; i < allTemplates.length; i++) {
 var tName = allTemplates[i].toLowerCase();
 if (tName.indexOf("wav") !== -1 || tName.indexOf("ses") !== -1 || tName.indexOf("audio") !== -1 || tName.indexOf("kayıpsız") !== -1 || tName.indexOf("lossless") !== -1) {
 try {
 outputModule.applyTemplate(allTemplates[i]);
 templateApplied = true;
 break;
 } catch(e) {}
 }
 }
 } catch(tempErr) {}
 outputModule.file = wavFile;
 try {
 outputModule.setSettings({
 "Video Output": false,
 "Audio Output": true
 });
 } catch(omSetErr) {}
 rqItem.render = true; 
 for (var qIdx = 0; qIdx < originalQueueStates.length; qIdx++) {
 try { originalQueueStates[qIdx].item.render = originalQueueStates[qIdx].render; } catch(e){}
 }
 for (var i = 1; i <= comp.numLayers; i++) {
 try { comp.layer(i).solo = oldSoloStates[i-1]; } catch(e){}
 try { comp.layer(i).audioEnabled = oldAudioStates[i-1]; } catch(e){}
 }
 comp.workAreaDuration = comp.frameDuration;
 comp.workAreaStart = oldStart;
 comp.workAreaDuration = oldDuration;
 app.endUndoGroup();
 try {
 app.project.renderQueue.render();
 } catch(renderErr) {
 rqItem.remove();
 return '{"error": "Ses renderı başarısız oldu. Lütfen seçili katmanın ses barındırdığından ve açık olduğundan emin olun."}';
 }
 rqItem.remove();
 try {
 if (app.activeViewer) {
 app.activeViewer.setActive();
 }
 comp.openInViewer();
 } catch(viewerErr) {}
 if (!wavFile.exists) {
 var baseNameWithoutExt = wavFile.name.substring(0, wavFile.name.lastIndexOf("."));
 var tempFolder = Folder.temp;
 var listFiles = tempFolder.getFiles();
 var matchedFile = null;
 for (var fIdx = 0; fIdx < listFiles.length; fIdx++) {
 var curr = listFiles[fIdx];
 if (curr.name.indexOf(baseNameWithoutExt) === 0) {
 matchedFile = curr;
 break;
 }
 }
 if (matchedFile && matchedFile.exists) {
 wavFile = matchedFile;
 } else {
 return '{"error": "Render tamamlandı fakat ses dosyası bulunamadı."}';
 }
 }
 var st = selectedLayer.startTime || 0;
 var ip = selectedLayer.inPoint || 0;
 var op = selectedLayer.outPoint || 0;
 return '{"success":true,"path":"' + encodeURIComponent(wavFile.fsName) + '","startTime":' + st + ',"inPoint":' + ip + ',"outPoint":' + op + '}';
} catch(globalErr) {
 try { app.endUndoGroup(); } catch(undoErr) {}
 return '{"error":"Kritik Hata: ' + encodeURIComponent(globalErr.toString()) + '"}';
}
}
function importIsolatedAudioToAE(filePath, startTimeVal, inPointVal, outPointVal, muteOriginal, stemName) {
 var comp = getComp();
 if (!comp) return "HATA: Kompozisyon bulunamadı.";
 var f = new File(filePath);
 if (!f.exists) { return "HATA: İzole vokal dosyası bulunamadı: " + filePath; }
 app.beginUndoGroup("SpeedFlow: Vokal Aktar");
 try {
 var importOptions = new ImportOptions(f);
 var projItem = app.project.importFile(importOptions);
 var originalSelected = [];
 for (var i = 0; i < comp.selectedLayers.length; i++) {
 originalSelected.push(comp.selectedLayers[i]);
 }
 var newLayer = comp.layers.add(projItem);
 var layerNameMap = {
 "vocals": "🎙 Ana Vokal",
 "backing": "🗣 Ara Vokal",
 "drums": "🥁 Davul",
 "bass": "🎸 Bas Gitar",
 "instrumental": "🎵 Müzik",
 "other": "🎹 Diğer"
 };
 newLayer.name = (stemName && layerNameMap[stemName]) ? layerNameMap[stemName] : ("🎙 " + (stemName || "Vokal"));
 var st = parseFloat(startTimeVal) || 0;
 newLayer.startTime = st;
 if (inPointVal !== undefined && inPointVal !== null) {
 newLayer.inPoint = parseFloat(inPointVal);
 }
 if (outPointVal !== undefined && outPointVal !== null) {
 newLayer.outPoint = parseFloat(outPointVal);
 }
 newLayer.name = "🎙 İzole Vokal";
 if (muteOriginal) {
 for (var i = 0; i < originalSelected.length; i++) {
 originalSelected[i].audioEnabled = false;
 originalSelected[i].selected = false; 
 }
 }
 newLayer.selected = true; 
 app.endUndoGroup();
 return "BAŞARILI";
 } catch(err) {
 app.endUndoGroup();
 return "HATA: Vokal eklenirken hata oluştu: " + err.toString();
 }
}
function generateDefaultLayerName(comp, baseName) {
 var counter = 1;
 var newName = baseName + " " + counter;
 while (true) {
 var nameExists = false;
 for (var i = 1; i <= comp.numLayers; i++) {
 if (comp.layer(i).name === newName) {
 nameExists = true;
 break;
 }
 }
 if (!nameExists) {
 return newName;
 }
 counter++;
 newName = baseName + " " + counter;
 }
}
function getSelectedLayersDuration() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) {
 return null;
 }
 var layers = comp.selectedLayers;
 if (layers.length === 0) {
 return null;
 }
 var minInPoint = layers[0].inPoint;
 var maxOutPoint = layers[0].outPoint;
 for (var i = 1; i < layers.length; i++) {
 if (layers[i].inPoint < minInPoint) minInPoint = layers[i].inPoint;
 if (layers[i].outPoint > maxOutPoint) maxOutPoint = layers[i].outPoint;
 }
 return { start: minInPoint, duration: maxOutPoint - minInPoint, end: maxOutPoint };
}
function createNull(shiftPressed) {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { return "ERROR:" + "Lütfen bir kompozisyon seçin!"; }
 var layers = [];
 for (var i = 0; i < comp.selectedLayers.length; i++) {
 layers.push(comp.selectedLayers[i]);
 }
 layers.sort(function(a, b) { return a.index - b.index; });
 var selDuration = getSelectedLayersDuration();
 var durationData = selDuration ? selDuration : { start: 0, duration: comp.duration };
 var w = comp.width;
 var h = comp.height;
 var layerPosition = null;
 var isThreeD = false;
 if (layers.length > 0) {
 var firstL = layers[0];
 try {
 if (firstL.source && firstL.source.width && firstL.source.height) {
 w = firstL.source.width;
 h = firstL.source.height;
 } else if (firstL.width && firstL.height) {
 w = firstL.width;
 h = firstL.height;
 } else if (firstL.rectAtTime) {
 var rect = firstL.rectAtTime(comp.time, false);
 if (rect.width > 0 && rect.height > 0) {
 w = rect.width;
 h = rect.height;
 }
 }
 } catch(e) {}
 try {
 if (firstL.property("Position")) {
 layerPosition = firstL.property("Position").value;
 }
 if (firstL.threeDLayer) {
 isThreeD = true;
 }
 } catch(e) {}
 }
 app.beginUndoGroup("Adj / Null");
 var newLayer;
 if (shiftPressed === "true" || shiftPressed === true) {
 newLayer = comp.layers.addNull();
 newLayer.name = generateDefaultLayerName(comp, "Null");
 newLayer.startTime = durationData.start;
 try { newLayer.inPoint = durationData.start; } catch(e) {}
 try { newLayer.outPoint = durationData.start + durationData.duration; } catch(e) {}
 newLayer.label = 1; 
 try {
 newLayer.source.width = w;
 newLayer.source.height = h;
 } catch(e) {}
 if (layerPosition !== null) {
 try {
 if (isThreeD) {
 newLayer.threeDLayer = true;
 }
 newLayer.property("Position").setValue(layerPosition);
 } catch(e) {}
 }
 if (layers.length > 0) {
 newLayer.moveBefore(layers[0]);
 }
 for (var i = 0; i < layers.length; i++) {
 try {
 layers[i].parent = newLayer;
 } catch(pErr) {}
 }
 } else {
 var newAdj = comp.layers.addSolid([1, 1, 1], generateDefaultLayerName(comp, "Adjustment"), w, h, comp.pixelAspect, durationData.duration);
 newAdj.adjustmentLayer = true;
 newAdj.startTime = durationData.start;
 try { newAdj.inPoint = durationData.start; } catch(e) {}
 try { newAdj.outPoint = durationData.start + durationData.duration; } catch(e) {}
 if (layerPosition !== null) {
 try {
 if (isThreeD) {
 newAdj.threeDLayer = true;
 }
 newAdj.property("Position").setValue(layerPosition);
 } catch(e) {}
 }
 if (layers.length > 0) {
 newAdj.moveBefore(layers[0]);
 }
 }
 app.endUndoGroup();
 return "OK";
}
function createAdjustment(shiftPressed) {
 createNull(shiftPressed); 
}
function createSolid(shiftPressed) {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { alert("Lütfen bir kompozisyon seçin!"); return; }
 var layers = comp.selectedLayers;
 var selDuration;
 if (layers.length > 0) {
 selDuration = getSelectedLayersDuration();
 if (!selDuration) { return; }
 } else {
 selDuration = { start: comp.time, duration: comp.duration - comp.time };
 }
 app.beginUndoGroup("Solid / Kamera");
 var newLayer;
 if (shiftPressed === "true" || shiftPressed === true) {
 newLayer = comp.layers.addCamera(generateDefaultLayerName(comp, "Camera"), [comp.width / 2, comp.height / 2]);
 } else {
 newLayer = comp.layers.addSolid([1,1,1], generateDefaultLayerName(comp, "Solid"), comp.width, comp.height, comp.pixelAspect, selDuration.duration);
 }
 newLayer.startTime = selDuration.start;
 newLayer.outPoint = selDuration.start + selDuration.duration;
 if (layers.length > 0) {
 newLayer.moveBefore(layers[0]);
 }
 app.endUndoGroup();
}
function reverseLayerOrder() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { alert("Lütfen bir kompozisyon seçin!"); return; }
 var layers = comp.selectedLayers;
 if (layers.length < 2) {
 alert("Lütfen ters çevirmek için en az 2 katman seçin!"); return;
 }
 app.beginUndoGroup("Sırayı Ters Çevir");
 var selectedLayers = [];
 for (var i = 0; i < layers.length; i++) {
 selectedLayers.push(layers[i]);
 layers[i].selected = false;
 }
 selectedLayers.sort(function (a, b) {
 return a.index - b.index;
 });
 var n = selectedLayers.length;
 var referenceLayer = selectedLayers[0];
 var anchorLayer = (referenceLayer.index > 1) ? comp.layer(referenceLayer.index - 1) : null;
 for (var i = n - 1; i >= 0; i--) {
 var layerToMove = selectedLayers[i];
 if (anchorLayer) {
 layerToMove.moveAfter(anchorLayer);
 } else {
 layerToMove.moveToBeginning();
 }
 anchorLayer = layerToMove;
 }
 for (var i = 0; i < n; i++) {
 selectedLayers[i].selected = true;
 }
 app.endUndoGroup();
}
function smartAlign(shiftPressed) {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { alert("Lütfen bir kompozisyon seçin!"); return; }
 var layers = comp.selectedLayers;
 if (layers.length === 0) { alert("En az bir katman seçin!"); return; }
 var currentTime = comp.time;
 app.beginUndoGroup("Akıllı Hizala");
 if (shiftPressed !== "true" && shiftPressed !== true) {
 for (var i = 0; i < layers.length; i++) {
 layers[i].startTime = currentTime - (layers[i].inPoint - layers[i].startTime);
 }
 } else {
 var minStartTime = layers[0].startTime;
 for (var i = 1; i < layers.length; i++) {
 if (layers[i].startTime < minStartTime) {
 minStartTime = layers[i].startTime;
 }
 }
 var timeOffset = currentTime - minStartTime;
 for (var i = 0; i < layers.length; i++) {
 layers[i].startTime += timeOffset;
 }
 }
 app.endUndoGroup();
}
function smartDuplicate() {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { alert("Lütfen bir kompozisyon seçin!"); return; }
 var layers = comp.selectedLayers;
 if (layers.length === 0) { alert("En az bir katman seçin!"); return; }
 var time = comp.time;
 app.beginUndoGroup("Akıllı Kopyala");
 var layersToCopy = []; 
 for (var i = 0; i < layers.length; i++) {
 layersToCopy.push(layers[i]);
 }
 layersToCopy.sort(function (a, b) { return a.startTime - b.startTime; });
 var firstStart = layersToCopy[0].startTime;
 for (var i = 0; i < layers.length; i++) {
 var dup = layersToCopy[i].duplicate();
 dup.startTime = time + (layersToCopy[i].startTime - firstStart);
 }
 app.endUndoGroup();
}
function cleanLayers(settingsStr) {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { alert("Lütfen bir kompozisyon seçin!"); return; }
 var layers = comp.selectedLayers;
 if (layers.length === 0) { alert("En az bir katman seçin!"); return; }
 var s = { deleteEffects: true, deleteMasks: true, deleteKeyframes: true, deleteExpressions: false, resetTransformOnClean: false };
 if (settingsStr) {
 try { s = JSON.parse(settingsStr); } catch(e){}
 }
 app.beginUndoGroup("Gelişmiş Temizle");
 for (var i = 0; i < layers.length; i++) {
 var layer = layers[i];
 if (s.deleteEffects) {
 try {
 while (layer.property("ADBE Effect Parade") && layer.property("ADBE Effect Parade").numProperties > 0) {
 layer.property("ADBE Effect Parade").property(1).remove();
 }
 } catch (e) { }
 }
 if (s.deleteMasks) {
 try {
 while (layer.property("ADBE Mask Parade") && layer.property("ADBE Mask Parade").numProperties > 0) {
 layer.property("ADBE Mask Parade").property(1).remove();
 }
 } catch (e) { }
 }
 if (s.deleteExpressions) {
 try { clearExpressions(layer); } catch (e) { }
 }
 var trans = layer.property("ADBE Transform Group");
 if (trans && s.deleteKeyframes) {
 try { clearKeyframes(trans); } catch (e) { }
 }
 if (s.resetTransformOnClean) {
 try { performResetTransform(layer, comp); } catch (e) { }
 }
 }
 app.endUndoGroup();
}
function processPreComp(comp, selectedLayers, preCompName, originalFPS) {
 var layerIndices = [];
 var minIn = selectedLayers[0].inPoint;
 var maxOut = selectedLayers[0].outPoint;
 for (var i = 0; i < selectedLayers.length; i++) {
 layerIndices.push(selectedLayers[i].index);
 if (selectedLayers[i].inPoint < minIn) minIn = selectedLayers[i].inPoint;
 if (selectedLayers[i].outPoint > maxOut) maxOut = selectedLayers[i].outPoint;
 }
 var preCompDuration = maxOut - minIn;
 if (preCompDuration <= 0) preCompDuration = 1 / comp.frameRate;
 var preComp = comp.layers.precompose(layerIndices, preCompName, true);
 if (!preComp && comp.selectedLayers.length > 0) {
 if (comp.selectedLayers[0].source instanceof CompItem) { preComp = comp.selectedLayers[0].source; }
 }
 if (!preComp) return;
 var newPreCompLayer = comp.selectedLayers[0];
 preComp.frameRate = 60; 
 preComp.duration = preCompDuration;
 preComp.displayStartTime = minIn;
 for (var k = 1; k <= preComp.numLayers; k++) {
 var l = preComp.layer(k);
 if (l) {
 l.startTime -= minIn;
 if (l.inPoint < -0.001) l.inPoint = 0;
 if (l.outPoint > preCompDuration + 0.001) l.outPoint = preCompDuration;
 }
 }
 newPreCompLayer.startTime = minIn;
 newPreCompLayer.inPoint = minIn;
 newPreCompLayer.outPoint = maxOut;
 for (var j = 1; j <= preComp.numLayers; j++) {
 var layerInside = preComp.layer(j);
 if (layerInside.hasVideo) {
 layerInside.frameBlended = true;
 layerInside.frameBlendType = 1014;
 var fxGroup = layerInside.property("ADBE Effect Group");
 if (fxGroup && fxGroup.canAddProperty("ADBE Timewarp")) {
 var tw = fxGroup.addProperty("ADBE Timewarp");
 if (tw) {
 if (tw.property("Method")) tw.property("Method").setValue(3);
 if (tw.property("Source Frame Rate")) tw.property("Source Frame Rate").setValue(originalFPS);
 if (tw.property("Speed")) tw.property("Speed").setValue(100);
 }
 }
 }
 }
}
function doPrecomp(shiftPressed) {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { alert("Lütfen bir kompozisyon seçin!"); return; }
 var layers = comp.selectedLayers;
 if (!layers || layers.length === 0) { alert("En az bir katman seçin!"); return; }
 app.beginUndoGroup("PRE COMP");
 try {
 var originalFPS = comp.frameRate;
 comp.frameRate = 60; 
 if (shiftPressed === "true" || shiftPressed === true) {
 processPreComp(comp, layers, layers[0].name, originalFPS);
 } else {
 var originalSelection = [];
 for (var i = 0; i < layers.length; i++) originalSelection.push(layers[i]);
 for (var i = 0; i < originalSelection.length; i++) {
 for (var s = 0; s < comp.layers.length; s++) comp.layer(s + 1).selected = false;
 originalSelection[i].selected = true;
 processPreComp(comp, [originalSelection[i]], originalSelection[i].name, originalFPS);
 }
 }
 } catch (err) {
 alert("PRE COMP sırasında bir hata oluştu: " + err.toString());
 }
 app.endUndoGroup();
}
function setAnchorPoint(pos) {
 app.beginUndoGroup("Merkez Noktası Değiştir");
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { app.endUndoGroup(); return "ERROR: Kompozisyon seçili değil"; }
 var layers = comp.selectedLayers;
 if (layers.length === 0) { app.endUndoGroup(); return "ERROR: Katman seçili değil"; }
 for (var i = 0; i < layers.length; i++) {
 var layer = layers[i];
 if (layer.locked) continue;
 if (!layer.property("Anchor Point") || !layer.property("Position")) continue;
 var rect;
 try { rect = layer.sourceRectAtTime(comp.time, false); } catch(e) { continue; }
 var w = rect.width;
 var h = rect.height;
 var l = rect.left;
 var t = rect.top;
 var newApx = l;
 var newApy = t;
 if (pos.indexOf("left") !== -1) newApx = l;
 else if (pos.indexOf("right") !== -1) newApx = l + w;
 else if (pos.indexOf("center") !== -1) newApx = l + (w / 2);
 if (pos.indexOf("top") !== -1) newApy = t;
 else if (pos.indexOf("bot") !== -1) newApy = t + h;
 else if (pos.indexOf("mid") !== -1) newApy = t + (h / 2);
 try {
 var apProp = layer.property("Anchor Point");
 var oldAp = apProp.value;
 var is3D = layer.threeDLayer;
 var z = (is3D && oldAp.length > 2) ? oldAp[2] : 0;
 var newAp = [newApx, newApy, z];
 var dX = newApx - oldAp[0];
 var dY = newApy - oldAp[1];
 var scale = layer.property("Scale").value;
 var sX = scale[0] / 100.0;
 var sY = scale[1] / 100.0;
 var dX_scaled = dX * sX;
 var dY_scaled = dY * sY;
 var rotation = 0;
 if (layer.property("Rotation")) {
 rotation = layer.property("Rotation").value;
 } else if (layer.property("Z Rotation")) {
 rotation = layer.property("Z Rotation").value;
 }
 var rad = rotation * (Math.PI / 180.0);
 var rx = dX_scaled * Math.cos(rad) - dY_scaled * Math.sin(rad);
 var ry = dX_scaled * Math.sin(rad) + dY_scaled * Math.cos(rad);
 apProp.setValue(newAp);
 var posProp = layer.property("Position");
 var p = posProp.value;
 if (posProp.dimensionsSeparated) {
 layer.property("X Position").setValue(p[0] + rx);
 layer.property("Y Position").setValue(p[1] + ry);
 } else {
 if (is3D) {
 posProp.setValue([p[0] + rx, p[1] + ry, p[2]]);
 } else {
 posProp.setValue([p[0] + rx, p[1] + ry]);
 }
 }
 } catch(e) {}
 }
 app.endUndoGroup();
 return "OK";
}
function toggleFXBypass(mode) {
 app.beginUndoGroup("FX Bypass Toggle");
 try {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) { app.endUndoGroup(); return; }
 var layers = comp.selectedLayers;
 if (mode === "comp") {
 layers = [];
 for (var i = 1; i <= comp.numLayers; i++) {
 layers.push(comp.layer(i));
 }
 } else {
 if (layers.length === 0) { app.endUndoGroup(); return; }
 }
 var targetState = true;
 var foundEffect = false;
 for (var i = 0; i < layers.length; i++) {
 var fxGroup = layers[i].property("ADBE Effect Parade");
 if (fxGroup && fxGroup.numProperties > 0) {
 if (!foundEffect) {
 try {
 targetState = !fxGroup.property(1).enabled;
 foundEffect = true;
 } catch(e) {}
 }
 for (var j = 1; j <= fxGroup.numProperties; j++) {
 try { fxGroup.property(j).enabled = targetState; } catch(e) {}
 }
 }
 }
 } catch(err) {}
 app.endUndoGroup();
}
function getFXBypassState(mode) {
 try {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) return "NONE";
 var layers = comp.selectedLayers;
 if (mode === "comp") {
 layers = [];
 for (var i = 1; i <= comp.numLayers; i++) {
 layers.push(comp.layer(i));
 }
 } else {
 if (layers.length === 0) return "NONE";
 }
 if (layers.length === 0) return "NONE";
 var hasEffects = false;
 var allEnabled = true;
 var allDisabled = true;
 for (var i = 0; i < layers.length; i++) {
 var fxGroup = layers[i].property("ADBE Effect Parade");
 if (fxGroup && fxGroup.numProperties > 0) {
 hasEffects = true;
 for (var j = 1; j <= fxGroup.numProperties; j++) {
 try {
 if (fxGroup.property(j).enabled) {
 allDisabled = false;
 } else {
 allEnabled = false;
 }
 } catch(e) {}
 }
 }
 }
 if (!hasEffects) return "NONE";
 if (allEnabled) return "ON";
 if (allDisabled) return "OFF";
 return "MIXED";
 } catch(err) {
 return "NONE";
 }
}
function takeSnapshot(defaultPath, alwaysAsk, quality) {
 app.beginUndoGroup("Snapshot Al");
 try {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) {
 app.endUndoGroup();
 return "ERROR: Kompozisyon seçili değil";
 }
 var compName = comp.name.replace(/[\/\:\*\?\"<>\|]/g, "_");
 var timeStr = comp.time.toFixed(2).replace(".", "_");
 var filename = compName + "_Snapshot_" + timeStr + ".png";
 var file;
 var savePath = defaultPath ? defaultPath : Folder.desktop.fsName;
 if (alwaysAsk === "true" || alwaysAsk === true || !defaultPath) {
 var initialFile = new File(savePath + "/" + filename);
 file = initialFile.saveDlg("Ekran Görüntüsünü Kaydet", "PNG Files:*.png;All Files:*");
 if (!file) {
 app.endUndoGroup();
 return "ERROR: İptal edildi";
 }
 } else {
 file = new File(savePath + "/" + filename);
 var counter = 1;
 while (file.exists) {
 file = new File(savePath + "/" + filename.replace(".png", "_" + counter + ".png"));
 counter++;
 }
 }
 var originalRes = comp.resolutionFactor;
 try {
 if (quality === "full") comp.resolutionFactor = [1, 1];
 else if (quality === "half") comp.resolutionFactor = [2, 2];
 else if (quality === "third") comp.resolutionFactor = [3, 3];
 else if (quality === "quarter") comp.resolutionFactor = [4, 4];
 } catch(e) {}
 comp.saveFrameToPng(comp.time, file);
 try { comp.resolutionFactor = originalRes; } catch(e) {}
 app.endUndoGroup();
 return "Kaydedildi: " + file.displayName;
 } catch(err) {
 app.endUndoGroup();
 return "ERROR: " + err.toString();
 }
}
function selectSnapshotFolder() {
 var folder = Folder.selectDialog("Ekran Görüntülerinin Kaydedileceği Klasörü Seçin");
 if (folder) {
 return folder.fsName;
 }
 return "ERROR: İptal edildi";
}
function applyHizFX(isShift) {
 app.beginUndoGroup("Hız FX");
 try {
 var comp = app.project.activeItem;
 if (!comp || !(comp instanceof CompItem)) return "ERROR: Lütfen bir kompozisyon seçin.";
 var layers = comp.selectedLayers;
 if (layers.length === 0) return "ERROR: Lütfen bir katman seçin.";
 for (var i = 0; i < layers.length; i++) {
 var layer = layers[i];
 var fxParade = layer.property("ADBE Effect Parade");
 if (!fxParade) continue;
 if (isShift === "true" || isShift === true) {
 var fx = null;
 try { fx = fxParade.addProperty("ADBE Tile"); } catch(e){}
 if (!fx) try { fx = fxParade.addProperty("Motion Tile"); } catch(e){}
 if (!fx) try { fx = fxParade.addProperty("CC Motion Tile"); } catch(e){}
 if (!fx) return "ERROR: Motion Tile eklentisi bulunamadı!";
 if (fx) {
 try { fx.property("Output Width").setValue(300); } catch(e){}
 try { fx.property("Output Height").setValue(300); } catch(e){}
 try { fx.property("Mirror Edges").setValue(1); } catch(e){}
 }
 } else {
 var fx = null;
 try { fx = fxParade.addProperty("Twixtor Pro"); } catch(e){}
 if (!fx) try { fx = fxParade.addProperty("Twixtor7 Pro"); } catch(e){}
 if (!fx) try { fx = fxParade.addProperty("Twixtor6 Pro"); } catch(e){}
 if (!fx) try { fx = fxParade.addProperty("Twixtor"); } catch(e){}
 if (!fx) try { fx = fxParade.addProperty("REVisionEffects TwixtorPro"); } catch(e){}
 if (!fx) return "ERROR: Twixtor Pro eklentisi bulunamadı!";
 }
 }
 app.endUndoGroup();
 return "OK";
 } catch (err) {
 app.endUndoGroup();
 return "ERROR: " + err.toString();
 }
}