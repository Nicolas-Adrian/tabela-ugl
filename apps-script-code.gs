const SHEET_NAME = "scoreboard";

function doGet(e) {
  const mode = getParam_(e, "mode", "read");

  if (mode === "read") {
    return jsonOutput_({
      ok: true,
      teams: readTeams_()
    });
  }

  return jsonOutput_({
    ok: false,
    error: "Unsupported mode"
  });
}

function doPost(e) {
  const mode = getParam_(e, "mode", "write");

  if (mode !== "write") {
    return jsonOutput_({
      ok: false,
      error: "Unsupported mode"
    });
  }

  const payload = JSON.parse(e.postData.contents || "{}");
  const teams = Array.isArray(payload.teams) ? payload.teams : [];

  writeTeams_(teams);

  return jsonOutput_({
    ok: true
  });
}

function getParam_(e, key, fallback) {
  if (!e || !e.parameter || !(key in e.parameter)) {
    return fallback;
  }

  return e.parameter[key];
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.getRange("A1").setValue("teams_json");
    sheet.getRange("A2").setValue("[]");
  }

  return sheet;
}

function readTeams_() {
  const sheet = getSheet_();
  const value = sheet.getRange("A2").getValue();

  try {
    return JSON.parse(value || "[]");
  } catch (error) {
    return [];
  }
}

function writeTeams_(teams) {
  const sheet = getSheet_();
  sheet.getRange("A2").setValue(JSON.stringify(teams));
  sheet.getRange("B1").setValue("updated_at");
  sheet.getRange("B2").setValue(new Date());
}
