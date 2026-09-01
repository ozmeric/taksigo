// ═══════════════════════════════════════════════════════════════════
// TAKSİ YÖNETİM — Apps Script Backend
// Deploy as Web App: Execute as "Me", Access "Anyone"
// ═══════════════════════════════════════════════════════════════════

var SHEET_ID   = "1WkZwLsf4dShU65cC5bL4Ocaa4CNEPxUTHZ5yiQV8qfs";
var ADMIN_PIN_DEFAULT = "1782";   // Fallback if no PIN has been set yet in Script Properties

function getAdminPin() {
  var p = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");
  return p || ADMIN_PIN_DEFAULT;
}

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

    // "Forgot PIN" must work WITHOUT a valid PIN — that's the entire point.
    // It only succeeds if the provided email matches the one on file.
    if (body.action === "forgotAdminPin") return out(forgotAdminPin(ss, body.email));

    // ── Auth: resolve role from PIN ──
    var auth = resolvePin(ss, body.pin);
    if (!auth) return out({error:"Unauthorized"});

    var a = body.action;

    if (a === "whoAmI") return out(whoAmI(ss, auth));

    if (a === "bootstrap") return out(bootstrap(ss, auth));

    // Actions any authed user (admin or driver) can call
    if (a === "getTaxis")   return out(getTaxis(ss));
    if (a === "getDrivers") return out(getDrivers(ss, auth));
    if (a === "getShifts")  return out(getShifts(ss, auth, body.driverId));
    if (a === "startShift") return out(startShift(ss, auth, body));
    if (a === "addRide")    return out(addRide(ss, auth, body));
    if (a === "addFuel")    return out(addFuel(ss, auth, body));
    if (a === "endShift")   return out(endShift(ss, auth, body));
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
    if (a === "resetDriverPin") return out(resetDriverPin(ss, body.driverId));
    if (a === "updateAdminPin") return out(updateAdminPin(ss, body.currentPin, body.newPin));
    if (a === "setAdminEmail") return out(setAdminEmail(ss, body.email));

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
  if (String(pin) === String(getAdminPin())) return {role:"admin"};
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

function updateAdminPin(ss, currentPin, newPin) {
  if (String(currentPin) !== String(getAdminPin())) return {error:"Mevcut PIN yanlış"};
  if (!newPin || String(newPin).length < 4) return {error:"Yeni PIN en az 4 haneli olmalı"};
  if (pinConflict(ss, newPin, null)) return {error:"Bu PIN bir şoförde kullanılıyor"};
  PropertiesService.getScriptProperties().setProperty("ADMIN_PIN", String(newPin));
  return {success:true};
}

function getAdminEmail() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL") || "";
}

function setAdminEmail(ss, email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {error:"Geçersiz e-posta adresi"};
  PropertiesService.getScriptProperties().setProperty("ADMIN_EMAIL", String(email).trim());
  return {success:true};
}

// Self-service recovery: only succeeds if the given email matches the one on
// file, in which case it generates a fresh PIN and emails it — no PIN needed
// to call this, since the whole scenario is the admin being locked out.
function forgotAdminPin(ss, email) {
  var onFile = getAdminEmail();
  if (!onFile || !email || String(email).trim().toLowerCase() !== onFile.toLowerCase()) {
    // Same response either way — don't reveal whether an email is on file
    return {success:true};
  }
  var newPin = String(Math.floor(1000+Math.random()*9000));
  var tries = 0;
  while (pinConflict(ss, newPin, null) && tries < 20) { newPin = String(Math.floor(1000+Math.random()*9000)); tries++; }
  PropertiesService.getScriptProperties().setProperty("ADMIN_PIN", newPin);
  try {
    MailApp.sendEmail({
      to: onFile,
      subject: "TaksiGo — Yönetici PIN Sıfırlama",
      body: "Yeni yönetici PIN'iniz: " + newPin + "\n\nBu isteği siz yapmadıysanız, lütfen uygulamanızın güvenliğini kontrol edin."
    });
  } catch (err) {
    return {error: "E-posta gönderilemedi: " + err.message};
  }
  return {success:true};
}

// Bundles the entire post-login load (role + taxis + drivers + shifts) into
// ONE Apps Script call instead of four separate ones. Apps Script pays real
// fixed overhead per request (opening the spreadsheet, cold start) regardless
// of how much work happens inside — bundling cuts that overhead from 2
// sequential round trips down to 1, which is most of what "Yükleniyor" delay
// actually was.
function bootstrap(ss, auth) {
  var who = whoAmI(ss, auth);
  return {
    role: who.role,
    driver: who.driver,
    email: who.email,
    taxis: getTaxis(ss).taxis,
    drivers: getDrivers(ss, auth).drivers,
    shifts: getShifts(ss, auth).shifts
  };
}

function whoAmI(ss, auth) {
  if (auth.role === "admin") return {role:"admin", email:getAdminEmail()};
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

// ── Shared: self-heal a sheet's header row if older rows are missing
// newer columns (avoids silent misreads when the schema grows over time) ──
function ensureHeaders(sheet, headers, defaultsMap) {
  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0 ? sheet.getRange(1,1,1,lastCol).getValues()[0] : [];
  var missing = headers.filter(function(h){ return existing.indexOf(h) === -1; });
  if (missing.length > 0) {
    var startCol = existing.length + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      missing.forEach(function(h, idx){
        var col = startCol + idx;
        var def = (defaultsMap && defaultsMap[h] !== undefined) ? defaultsMap[h] : "";
        var defaults = [];
        for (var i=0;i<lastRow-1;i++) defaults.push([def]);
        sheet.getRange(2, col, lastRow-1, 1).setValues(defaults);
      });
    }
  }
}

// ── DRIVERS ──────────────────────────────────────────────────────
var DRIVER_HEADERS = ["id","taxiId","firstName","lastName","phone","pin","startDate","endDate","status","adminNotes","driverNotes","salaryType","salaryValue"];
var DRIVER_DEFAULTS = {salaryType:"percentage", salaryValue:50};

function getDriverTab(ss) {
  var s = ss.getSheetByName(DRIVERS_TAB);
  if (!s) {
    s = ss.insertSheet(DRIVERS_TAB);
    s.getRange(1,1,1,DRIVER_HEADERS.length).setValues([DRIVER_HEADERS]);
    return s;
  }
  ensureHeaders(s, DRIVER_HEADERS, DRIVER_DEFAULTS);
  return s;
}

// Prevents two drivers (or a driver + the admin) from sharing a login PIN,
// which would make login ambiguous (first match wins).
function pinConflict(ss, pin, excludeDriverId) {
  if (String(pin) === String(getAdminPin())) return true;
  var s = getDriverTab(ss), d = s.getDataRange().getValues(), h = d[0];
  var pinIdx = h.indexOf("pin"), idIdx = h.indexOf("id");
  for (var i=1;i<d.length;i++) {
    if (String(d[i][idIdx]) === String(excludeDriverId)) continue;
    if (String(d[i][pinIdx]) === String(pin)) return true;
  }
  return false;
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
  var pin = dr.pin || String(Math.floor(1000+Math.random()*9000));
  var tries = 0;
  while (pinConflict(ss, pin, null) && tries < 20) { pin = String(Math.floor(1000+Math.random()*9000)); tries++; }
  if (pinConflict(ss, pin, null)) return {error:"PIN çakışması — lütfen başka bir PIN deneyin"};
  var s = getDriverTab(ss);
  var header = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  var row = buildRow(header, {
    id:dr.id, taxiId:dr.taxiId, firstName:dr.firstName||"", lastName:dr.lastName||"", phone:dr.phone||"", pin:pin,
    startDate:dr.startDate||"", endDate:dr.endDate||"", status:dr.status||"Active",
    adminNotes:dr.adminNotes||"", driverNotes:dr.driverNotes||"",
    salaryType:dr.salaryType||"percentage", salaryValue: dr.salaryValue!==undefined?dr.salaryValue:50
  });
  s.appendRow(row);
  return {success:true, pin:pin};
}

function updateDriver(ss, dr) {
  var s = getDriverTab(ss), d = s.getDataRange().getValues(), header = d[0];
  var pinIdx = header.indexOf("pin");
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(dr.id)) {
      if (dr.pin && String(dr.pin) !== String(d[i][pinIdx]) && pinConflict(ss, dr.pin, dr.id)) {
        return {error:"PIN çakışması — bu PIN başka bir şoförde kullanılıyor"};
      }
      var existing = {}; header.forEach(function(h,idx){ existing[h] = d[i][idx]; });
      var row = buildRow(header, {
        id:dr.id, taxiId:dr.taxiId, firstName:dr.firstName||"", lastName:dr.lastName||"", phone:dr.phone||"",
        pin: dr.pin || existing.pin,
        startDate:dr.startDate||"", endDate:dr.endDate||"", status:dr.status||"Active",
        adminNotes: dr.adminNotes!==undefined ? dr.adminNotes : existing.adminNotes,
        driverNotes: dr.driverNotes!==undefined ? dr.driverNotes : existing.driverNotes,
        salaryType: dr.salaryType || existing.salaryType || "percentage",
        salaryValue: dr.salaryValue!==undefined ? dr.salaryValue : (existing.salaryValue!==""?existing.salaryValue:50)
      });
      s.getRange(i+1,1,1,header.length).setValues([row]);
      return {success:true};
    }
  }
  return {error:"Not found"};
}

function resetDriverPin(ss, did) {
  var s = getDriverTab(ss), d = s.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (String(d[i][0]) === String(did)) {
      var pin = String(Math.floor(1000+Math.random()*9000));
      var tries = 0;
      while (pinConflict(ss, pin, did) && tries < 20) { pin = String(Math.floor(1000+Math.random()*9000)); tries++; }
      s.getRange(i+1, 6).setValue(pin);
      return {success:true, pin:pin};
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
// A shift is "open" while a driver is actively working (status="open"),
// and gets rides appended live throughout the day, then "closed" when
// the driver ends the shift (enters km bitiş + fuel info).
// All timestamps are generated server-side in Istanbul time so they're
// consistent regardless of the driver's phone clock/timezone.

function nowIstanbul(fmt) {
  return Utilities.formatDate(new Date(), "Europe/Istanbul", fmt);
}

// Google Sheets auto-converts strings that look like times/dates into real
// Date objects when read back — normalize those back to plain HH:mm / yyyy-MM-dd
// strings so the frontend always gets consistent text, not epoch-1899 Dates.
function asTimeStr(val) {
  if (val instanceof Date) return Utilities.formatDate(val, "Europe/Istanbul", "HH:mm");
  return val || "";
}
function asDateStr(val) {
  if (val instanceof Date) return Utilities.formatDate(val, "Europe/Istanbul", "yyyy-MM-dd");
  return val || "";
}

var SHIFT_HEADERS = ["id","driverId","taxiId","date","timeStart","timeEnd","kmStart","kmEnd","earnings","fuelCost","fuelLiters","notes","ridesJson","fuelJson","status"];
var SHIFT_DEFAULTS = {status:"closed", ridesJson:"[]", fuelJson:"[]"};

function getShiftTab(ss) {
  var s = ss.getSheetByName(SHIFTS_TAB);
  if (!s) {
    s = ss.insertSheet(SHIFTS_TAB);
    s.getRange(1,1,1,SHIFT_HEADERS.length).setValues([SHIFT_HEADERS]);
    return s;
  }
  ensureHeaders(s, SHIFT_HEADERS, SHIFT_DEFAULTS);
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
    r.date = asDateStr(r.date);
    r.timeStart = asTimeStr(r.timeStart);
    r.timeEnd = asTimeStr(r.timeEnd);
    r.kmStart=parseFloat(r.kmStart)||0; r.kmEnd=parseFloat(r.kmEnd)||0;
    r.earnings=parseFloat(r.earnings)||0; r.fuelCost=parseFloat(r.fuelCost)||0; r.fuelLiters=parseFloat(r.fuelLiters)||0;
    try { r.rides = JSON.parse(r.ridesJson||"[]"); } catch(e) { r.rides = []; }
    try { r.fuel = JSON.parse(r.fuelJson||"[]"); } catch(e) { r.fuel = []; }
    delete r.ridesJson; delete r.fuelJson;
  });
  return {shifts: rows};
}

function hasOpenShift(ss, driverId) {
  var s = getShiftTab(ss), d = s.getDataRange().getValues(), h = d[0];
  var driverIdx=h.indexOf("driverId"), statusIdx=h.indexOf("status");
  for (var i=1;i<d.length;i++) {
    if (String(d[i][driverIdx]) === String(driverId) && d[i][statusIdx] === "open") return true;
  }
  return false;
}

// Builds a row array matched to the sheet's ACTUAL header order (by name),
// not an assumed fixed position — safe even if columns were appended out of
// the order listed in a *_HEADERS constant by an earlier migration.
function buildRow(header, valuesObj) {
  return header.map(function(h){ return valuesObj.hasOwnProperty(h) ? valuesObj[h] : ""; });
}

function startShift(ss, auth, body) {
  var driverId = auth.role === "driver" ? auth.driverId : body.driverId;
  var taxiId = auth.role === "driver" ? auth.taxiId : body.taxiId;
  if (!driverId) return {error:"driverId required"};
  if (hasOpenShift(ss, driverId)) return {error:"Zaten açık bir vardiya var — önce onu bitirin"};
  var s = getShiftTab(ss);
  var header = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  var id = Utilities.getUuid();
  var date = nowIstanbul("yyyy-MM-dd");
  var timeStart = nowIstanbul("HH:mm");
  var row = buildRow(header, {
    id:id, driverId:driverId, taxiId:taxiId, date:date, timeStart:timeStart, timeEnd:"",
    kmStart: body.kmStart||0, kmEnd:0, earnings:0, fuelCost:0, fuelLiters:0, notes:"",
    ridesJson:"[]", fuelJson:"[]", status:"open"
  });
  s.appendRow(row);
  return {success:true, shiftId:id, date:date, timeStart:timeStart};
}

function addRide(ss, auth, body) {
  var s = getShiftTab(ss), d = s.getDataRange().getValues();
  var h = d[0];
  var idIdx=h.indexOf("id"), driverIdx=h.indexOf("driverId"), ridesIdx=h.indexOf("ridesJson"),
      earnIdx=h.indexOf("earnings"), statusIdx=h.indexOf("status");
  for (var i=1;i<d.length;i++) {
    if (String(d[i][idIdx]) === String(body.shiftId)) {
      if (auth.role === "driver" && String(d[i][driverIdx]) !== String(auth.driverId)) return {error:"Forbidden"};
      if (d[i][statusIdx] !== "open") return {error:"Vardiya kapalı"};
      var rides = [];
      try { rides = JSON.parse(d[i][ridesIdx]||"[]"); } catch(e) {}
      rides.push({amount: Number(body.amount)||0, time: nowIstanbul("HH:mm")});
      var total = rides.reduce(function(sum,r){ return sum + (r.amount||0); }, 0);
      s.getRange(i+1, ridesIdx+1).setValue(JSON.stringify(rides));
      s.getRange(i+1, earnIdx+1).setValue(total);
      return {success:true, rides:rides, earnings:total};
    }
  }
  return {error:"Not found"};
}

function addFuel(ss, auth, body) {
  var s = getShiftTab(ss), d = s.getDataRange().getValues();
  var h = d[0];
  var idIdx=h.indexOf("id"), driverIdx=h.indexOf("driverId"), fuelIdx=h.indexOf("fuelJson"),
      costIdx=h.indexOf("fuelCost"), litersIdx=h.indexOf("fuelLiters"), statusIdx=h.indexOf("status");
  for (var i=1;i<d.length;i++) {
    if (String(d[i][idIdx]) === String(body.shiftId)) {
      if (auth.role === "driver" && String(d[i][driverIdx]) !== String(auth.driverId)) return {error:"Forbidden"};
      if (d[i][statusIdx] !== "open") return {error:"Vardiya kapalı"};
      var fuel = [];
      try { fuel = JSON.parse(d[i][fuelIdx]||"[]"); } catch(e) {}
      fuel.push({km: Number(body.km)||0, amount: Number(body.amount)||0, liters: Number(body.liters)||0, time: nowIstanbul("HH:mm")});
      var totalCost = fuel.reduce(function(sum,f){ return sum + (f.amount||0); }, 0);
      var totalLiters = fuel.reduce(function(sum,f){ return sum + (f.liters||0); }, 0);
      s.getRange(i+1, fuelIdx+1).setValue(JSON.stringify(fuel));
      s.getRange(i+1, costIdx+1).setValue(totalCost);
      s.getRange(i+1, litersIdx+1).setValue(totalLiters);
      return {success:true, fuel:fuel, fuelCost:totalCost, fuelLiters:totalLiters};
    }
  }
  return {error:"Not found"};
}

function endShift(ss, auth, body) {
  var s = getShiftTab(ss), d = s.getDataRange().getValues();
  var h = d[0];
  var idIdx=h.indexOf("id"), driverIdx=h.indexOf("driverId"),
      timeEndIdx=h.indexOf("timeEnd"), kmEndIdx=h.indexOf("kmEnd"),
      notesIdx=h.indexOf("notes"), statusIdx=h.indexOf("status");
  for (var i=1;i<d.length;i++) {
    if (String(d[i][idIdx]) === String(body.shiftId)) {
      if (auth.role === "driver" && String(d[i][driverIdx]) !== String(auth.driverId)) return {error:"Forbidden"};
      s.getRange(i+1, timeEndIdx+1).setValue(nowIstanbul("HH:mm"));
      s.getRange(i+1, kmEndIdx+1).setValue(body.kmEnd||0);
      s.getRange(i+1, notesIdx+1).setValue(body.notes||"");
      s.getRange(i+1, statusIdx+1).setValue("closed");
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
