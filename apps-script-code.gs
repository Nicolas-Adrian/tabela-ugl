const SHEET_NAME = "scoreboard";
const DRIVE_FOLDER_ID = "1E4oiNZtT1RaodtwFhZU32Acs_-Vn-I4m";

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
  const payload = JSON.parse(e.postData.contents || "{}");

  if (mode === "write") {
    const teams = Array.isArray(payload.teams) ? payload.teams : [];
    writeTeams_(teams);

    return jsonOutput_({
      ok: true
    });
  }

  if (mode === "uploadLogo") {
    const fileName = String(payload.fileName || "logo.png");
    const dataUrl = String(payload.dataUrl || "");
    const logoUrl = uploadLogo_(dataUrl, fileName);

    return jsonOutput_({
      ok: true,
      logoUrl: logoUrl
    });
  }

  return jsonOutput_({
    ok: false,
    error: "Unsupported mode"
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

function uploadLogo_(dataUrl, fileName) {
  if (!DRIVE_FOLDER_ID) {
    throw new Error("Configure DRIVE_FOLDER_ID before uploading logos.");
  }

  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!matches) {
    throw new Error("Invalid data URL.");
  }

  const mimeType = matches[1];
  const bytes = Utilities.base64Decode(matches[2]);
  const blob = Utilities.newBlob(bytes, mimeType, sanitizeFileName_(fileName));
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function sanitizeFileName_(fileName) {
  return String(fileName || "logo")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "logo";
}
