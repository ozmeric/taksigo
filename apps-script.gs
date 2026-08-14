// ═══════════════════════════════════════════════════════════════════
// TAKSİ YÖNETİM — Apps Script Backend
// Deploy as Web App: Execute as "Me", Access "Anyone"
// ═══════════════════════════════════════════════════════════════════

var SHEET_ID   = "YOUR_GOOGLE_SHEET_ID_HERE";
var ADMIN_PIN  = "2025";   // Owner/admin PIN — change this before going live

var TAXIS_TAB    = "Taxis";
var DRIVERS_TAB  = "Drivers";
var SHIFTS_TAB   = "Shifts";
var EXPENSES_TAB = "Expenses";
var VENDORS_TAB  = "Vendors";

function getss() { return SpreadsheetApp.openById(SHEET_ID); }

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status:"ok"})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = (e.postData && e.postData.contents)
      ? e.postData.contents
      : (e.parameter && e.parameter.body ? e.parameter.body : "{}");
    var body = JSON.parse(raw);
    var ss = getss();

    // ── Auth: resolve role from PIN ──
    var auth = resolvePin(ss, body.pin);
    if (!auth) return out({error:"Unauthorized"});

    var a = body.action;

    if (a === "whoAmI") return out(whoAmI(ss, auth));

    // Actions any authed user (admin or driver) can call
    if (a === "getTaxis")   return out(getTaxis(ss));
    if (a === "getDrivers") return out(getDrivers(ss, auth));
    if (a === "getShifts")  return out(getShifts(ss, auth, body.driverId));
    if (a === "addShift")   return out(addShift(ss, auth, body.shift));
    if (a === "updateOwnNote") return out(updateOwnNote(ss, auth, body.note));

    // Admin-only actions
    if (auth.role !== "admin") return out({error:"Forbidden — admin only"});

    if (a === "addTaxi")     return out(addTaxi(ss, body.taxi));
    if (a === "updateTaxi")  return out(updateTaxi(ss, body.taxi));
    if (a === "deleteTaxi")  return out(deleteTaxi(ss, body.taxiId));

    if (a === "addDriver")    return out(addDriver(ss, body.driver));
    if (a === "updateDriver") return out(updateDriver(ss, body.driver));
    if (a === "deleteDriver") return out(deleteDriver(ss, body.driverId));
    if (a === "updateAdminNote") return out(updateAdminNote(ss, body.driverId, body.note));

    if (a === "updateShift") return out(updateShift(ss, body.shift));
    if (a === "deleteShift") return out(deleteShift(ss, body.shiftId));

    if (a === "getExpenses") return out(getExpenses(ss, body.taxiId));
    if (a === "addExpense")  return out(addExpense(ss, body.expense));
    if (a === "updateExpense") return out(updateExpense(ss, body.expense));
    if (a === "deleteExpense") return out(deleteExpense(ss, body.expenseId));

    if (a === "getVendors")  return out(getVendors(ss));
    if (a === "saveVendors") return out(saveVendors(ss, body.vendors, body.categories));

    return out({error:"Unknown action"});
  } catch (err) {
    return out({error: err.toString()});
  }
}

function out(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ── AUTH ─────────────────────────────────────────────────────────
// Returns {role:"admin"} or {role:"driver", driverId, taxiId} or null
function resolvePin(ss, pin) {
  if (!pin) return null;
  if (String(pin) === String(ADMIN_PIN)) return {role:"admin"};
  var s = ss.getSheetByName(DRIVERS_TAB);
  if (!s) return null;
  var d = s.getDataRange().getValues();
  var h = d[0];
  var pinIdx = h.indexOf("pin");
  var idIdx = h.indexOf("id");
  var taxiIdx = h.indexOf("taxiId");
  var statusIdx = h.indexOf("status");
  for (var i = 1; i < d.length; i++) {
    if (String(d[i][pinIdx]) === String(pin) && String(d[i][statusIdx]) !== "Inactive") {
      return {role:"driver", driverId:String(d[i][idIdx]), taxiId:String(d[i][taxiIdx])};
    }
  }
  return null;
}

function whoAmI(ss, auth) {
  if (auth.role === "admin") return {role:"admin"};
  var s = getDriverTab(ss);
  var d = s.getDataRange().getValues();
  var h = d[0];
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(auth.driverId)) {
      var o = {}; h.forEach(function(k,idx){o[k]=d[i][idx];});
      delete o.pin;
      return {role:"driver", driver:o};
    }
  }
  return {role:"driver", driver:null};
}

// ── TAXIS ────────────────────────────────────────────────────────
function getTaxiTab(ss) {
  var s = ss.getSheetByName(TAXIS_TAB);
  if (!s) {
    s = ss.insertSheet(TAXIS_TAB, 0);
    s.getRange(1,1,1,5).setValues([["id","plate","label","notes","status"]]);
  }
  return s;
}

function getTaxis(ss) {
  var s = getTaxiTab(ss);
  var d = s.getDataRange().getValues();
  if (d.length <= 1) return {taxis:[]};
  var h = d[0];
  return {taxis: d.slice(1).map(function(r){ var o={}; h.forEach(function(k,i){o[k]=r[i];}); return o; })};
}

function addTaxi(ss, t) {
  getTaxiTab(ss).appendRow([t.id, t.plate||"", t.label||"", t.notes||"", t.status||"Active"]);
  return {success:true};
}

function updateTaxi(ss, t) {
  var s = getTaxiTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(t.id)) {
      s.getRange(i+1,1,1,5).setValues([[t.id, t.plate||"", t.label||"", t.notes||"", t.status||"Active"]]);
      return {success:true};
    }
  }
  return {error:"Not found"};
}

function deleteTaxi(ss, tid) {
  var s = getTaxiTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(tid)) { s.deleteRow(i+1); break; }
  }
  return {success:true};
}

// ── DRIVERS ──────────────────────────────────────────────────────
function getDriverTab(ss) {
  var s = ss.getSheetByName(DRIVERS_TAB);
  if (!s) {
    s = ss.insertSheet(DRIVERS_TAB);
    s.getRange(1,1,1,11).setValues([["id","taxiId","firstName","lastName","phone","pin","startDate","endDate","status","adminNotes","driverNotes"]]);
  }
  return s;
}

function getDrivers(ss, auth) {
  var s = getDriverTab(ss);
  var d = s.getDataRange().getValues();
  if (d.length <= 1) return {drivers:[]};
  var h = d[0];
  var rows = d.slice(1).map(function(r){ var o={}; h.forEach(function(k,i){o[k]=r[i];}); return o; });
  // Drivers only see their own record (hide PIN); admin sees all
  if (auth.role === "driver") {
    rows = rows.filter(function(r){ return String(r.id) === String(auth.driverId); });
  }
  rows.forEach(function(r){ if (auth.role === "driver") delete r.pin; });
  return {drivers: rows};
}

function addDriver(ss, dr) {
  var s = getDriverTab(ss);
  s.appendRow([dr.id, dr.taxiId, dr.firstName||"", dr.lastName||"", dr.phone||"",
    dr.pin || String(Math.floor(1000+Math.random()*9000)),
    dr.startDate||"", dr.endDate||"", dr.status||"Active", dr.adminNotes||"", dr.driverNotes||""]);
  return {success:true};
}

function updateDriver(ss, dr) {
  var s = getDriverTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(dr.id)) {
      s.getRange(i+1,1,1,11).setValues([[dr.id, dr.taxiId, dr.firstName||"", dr.lastName||"", dr.phone||"",
        dr.pin||d[i][5], dr.startDate||"", dr.endDate||"", dr.status||"Active",
        (dr.adminNotes!==undefined?dr.adminNotes:d[i][9]), (dr.driverNotes!==undefined?dr.driverNotes:d[i][10])]]);
      return {success:true};
    }
  }
  return {error:"Not found"};
}

function deleteDriver(ss, did) {
  var s = getDriverTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(did)) { s.deleteRow(i+1); break; }
  }
  return {success:true};
}

function updateAdminNote(ss, did, note) {
  var s = getDriverTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(did)) { s.getRange(i+1,10).setValue(note||""); return {success:true}; }
  }
  return {error:"Not found"};
}

function updateOwnNote(ss, auth, note) {
  if (auth.role !== "driver") return {error:"Drivers only"};
  var s = getDriverTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(auth.driverId)) { s.getRange(i+1,11).setValue(note||""); return {success:true}; }
  }
  return {error:"Not found"};
}

// ── SHIFTS (vardiya / sefer kaydı) ──────────────────────────────
function getShiftTab(ss) {
  var s = ss.getSheetByName(SHIFTS_TAB);
  if (!s) {
    s = ss.insertSheet(SHIFTS_TAB);
    s.getRange(1,1,1,12).setValues([["id","driverId","taxiId","date","timeStart","timeEnd","kmStart","kmEnd","earnings","fuelCost","fuelLiters","notes"]]);
  }
  return s;
}

function getShifts(ss, auth, driverId) {
  var s = getShiftTab(ss);
  var d = s.getDataRange().getValues();
  if (d.length <= 1) return {shifts:[]};
  var h = d[0];
  var rows = d.slice(1).map(function(r){ var o={}; h.forEach(function(k,i){o[k]=r[i];}); return o; });
  if (auth.role === "driver") {
    rows = rows.filter(function(r){ return String(r.driverId) === String(auth.driverId); });
  } else if (driverId) {
    rows = rows.filter(function(r){ return String(r.driverId) === String(driverId); });
  }
  rows.forEach(function(r){
    r.kmStart=parseFloat(r.kmStart)||0; r.kmEnd=parseFloat(r.kmEnd)||0;
    r.earnings=parseFloat(r.earnings)||0; r.fuelCost=parseFloat(r.fuelCost)||0; r.fuelLiters=parseFloat(r.fuelLiters)||0;
  });
  return {shifts: rows};
}

function addShift(ss, auth, sh) {
  var driverId = auth.role === "driver" ? auth.driverId : sh.driverId;
  var taxiId = auth.role === "driver" ? auth.taxiId : sh.taxiId;
  getShiftTab(ss).appendRow([sh.id, driverId, taxiId, sh.date||"", sh.timeStart||"", sh.timeEnd||"",
    sh.kmStart||0, sh.kmEnd||0, sh.earnings||0, sh.fuelCost||0, sh.fuelLiters||0, sh.notes||""]);
  return {success:true};
}

function updateShift(ss, sh) {
  var s = getShiftTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(sh.id)) {
      s.getRange(i+1,1,1,12).setValues([[sh.id, sh.driverId, sh.taxiId, sh.date||"", sh.timeStart||"", sh.timeEnd||"",
        sh.kmStart||0, sh.kmEnd||0, sh.earnings||0, sh.fuelCost||0, sh.fuelLiters||0, sh.notes||""]]);
      return {success:true};
    }
  }
  return {error:"Not found"};
}

function deleteShift(ss, sid) {
  var s = getShiftTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(sid)) { s.deleteRow(i+1); break; }
  }
  return {success:true};
}

// ── EXPENSES (vehicle-level: maintenance, insurance, etc.) ─────
function getExpTab(ss) {
  var s = ss.getSheetByName(EXPENSES_TAB);
  if (!s) {
    s = ss.insertSheet(EXPENSES_TAB);
    s.getRange(1,1,1,7).setValues([["id","taxiId","date","amount","category","vendor","notes"]]);
  }
  return s;
}

function getExpenses(ss, taxiId) {
  var s = getExpTab(ss);
  var d = s.getDataRange().getValues();
  if (d.length <= 1) return {expenses:[]};
  var h = d[0];
  var rows = d.slice(1).map(function(r){ var o={}; h.forEach(function(k,i){o[k]=r[i];}); o.amount=parseFloat(o.amount)||0; return o; });
  if (taxiId) rows = rows.filter(function(r){ return String(r.taxiId) === String(taxiId); });
  return {expenses: rows};
}

function addExpense(ss, ex) {
  getExpTab(ss).appendRow([ex.id, ex.taxiId, ex.date||"", ex.amount||0, ex.category||"", ex.vendor||"", ex.notes||""]);
  return {success:true};
}

function updateExpense(ss, ex) {
  var s = getExpTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(ex.id)) {
      s.getRange(i+1,1,1,7).setValues([[ex.id, ex.taxiId, ex.date||"", ex.amount||0, ex.category||"", ex.vendor||"", ex.notes||""]]);
      return {success:true};
    }
  }
  return {error:"Not found"};
}

function deleteExpense(ss, eid) {
  var s = getExpTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(eid)) { s.deleteRow(i+1); break; }
  }
  return {success:true};
}

// ── VENDORS (tedarikçiler) ──────────────────────────────────────
function getVendorsTab(ss) {
  var s = ss.getSheetByName(VENDORS_TAB);
  if (!s) {
    s = ss.insertSheet(VENDORS_TAB);
    s.getRange(1,1,1,2).setValues([["key","json"]]);
  }
  return s;
}

function getVendors(ss) {
  var s = getVendorsTab(ss);
  var rows = s.getDataRange().getValues().slice(1);
  var vendors = {}, categories = null;
  rows.forEach(function(r) {
    if (r[0] === "__categories__") { try { categories = JSON.parse(r[1]); } catch(e) {} }
    else if (r[0]) { try { vendors[r[0]] = JSON.parse(r[1]||"[]"); } catch(e) { vendors[r[0]] = []; } }
  });
  return {vendors: vendors, categories: categories};
}

function saveVendors(ss, vendors, categories) {
  var s = getVendorsTab(ss);
  var lastRow = s.getLastRow();
  if (lastRow > 1) s.getRange(2,1,lastRow-1,2).clearContent();
  var rows = [];
  if (categories) rows.push(["__categories__", JSON.stringify(categories)]);
  Object.keys(vendors).forEach(function(cat){ rows.push([cat, JSON.stringify(vendors[cat])]); });
  if (rows.length > 0) s.getRange(2,1,rows.length,2).setValues(rows);
  return {success:true};
}
