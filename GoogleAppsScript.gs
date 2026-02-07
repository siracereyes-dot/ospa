
/**
 * OSPA SCORER BACKEND SCRIPT
 * For Google Sheets ID: 1B4cEi_jta_LQhV7mewsul2GhCLNnV1HqrPKjjJKPrgk
 * For Google Drive Folder ID: 1UMS2R97ts71nHZQmi6dN1u-3LJknkndt
 */

const SHEET_ID = "1B4cEi_jta_LQhV7mewsul2GhCLNnV1HqrPKjjJKPrgk";
const FOLDER_ID = "1UMS2R97ts71nHZQmi6dN1u-3LJknkndt";
const SHEET_NAME = "ospa";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === "submit_ospa") {
      return handleSubmission(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleSubmission(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp", 
      "Category", 
      "Candidate Name", 
      "Division", 
      "School", 
      "Grand Total", 
      "Academic/Mean", 
      "Journalism", 
      "Leadership", 
      "Excellence", 
      "Interview", 
      "MOV Link"
    ]);
    sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#f3f3f3");
  }

  // 1. Handle File Upload to Drive
  let driveUrl = "No file uploaded";
  if (data.fileData && data.fileName) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const contentType = data.mimeType || "application/pdf";
    const decodedFile = Utilities.base64Decode(data.fileData);
    const blob = Utilities.newBlob(decodedFile, contentType, data.fileName);
    const file = folder.createFile(blob);
    driveUrl = file.getUrl();
  }

  // 2. Append Data to Sheet
  const timestamp = new Date();
  sheet.appendRow([
    timestamp,
    data.type,
    data.candidateName,
    data.division,
    data.schoolName,
    data.grandTotal,
    data.academic,
    data.journalism,
    data.leadership,
    data.excellence,
    data.interview,
    driveUrl
  ]);

  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    message: "Data and file synced successfully",
    driveUrl: driveUrl
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper to test folder/sheet access
 */
function testSetup() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getName();
    const folder = DriveApp.getFolderById(FOLDER_ID).getName();
    Logger.log("Access Verified: " + sheet + " | " + folder);
  } catch (e) {
    Logger.log("Access Denied: " + e.toString());
  }
}
