/**
 * =====================================================
 *  GOOGLE APPS SCRIPT — Lead Capture & Dashboard API
 *  IncomePro Lead Generation System
 * =====================================================
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this entire code
 * 4. Save the project (Ctrl+S)
 * 5. Click "Deploy" → "New Deployment"
 * 6. Type: "Web App"
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone"
 * 9. Click "Deploy" and copy the Web App URL
 * 10. Paste the URL in:
 *     - index.html → CONFIG.APPS_SCRIPT_URL
 *     - dashboard.html → config panel
 * =====================================================
 */

// ── SHEET CONFIGURATION ──
const SHEET_NAME = 'Leads';
const SPREADSHEET_ID = ''; // Optional: if blank, uses the bound spreadsheet

// ── GET SPREADSHEET ──
function getSheet() {
  let ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    // Auto-create if bound
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch(e) {
      // Create new spreadsheet if not bound
      ss = SpreadsheetApp.create('IncomePro Leads');
    }
  }

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    const headers = ['Name', 'Mobile', 'City', 'Date', 'Time', 'Timestamp'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Style headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#050810');
    headerRange.setFontColor('#00ff88');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(11);
    sheet.setFrozenRows(1);
    // Set column widths
    sheet.setColumnWidth(1, 180); // Name
    sheet.setColumnWidth(2, 140); // Mobile
    sheet.setColumnWidth(3, 140); // City
    sheet.setColumnWidth(4, 120); // Date
    sheet.setColumnWidth(5, 100); // Time
    sheet.setColumnWidth(6, 180); // Timestamp
  }
  return sheet;
}

// ── HANDLE HTTP REQUESTS ──
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return handlePost(data);
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  const action = e.parameter.action || 'getLeads';
  if (action === 'getLeads') {
    return handleGetLeads();
  } else if (action === 'getStats') {
    return handleGetStats();
  }
  return jsonResponse({ status: 'error', message: 'Unknown action' });
}

// ── SAVE LEAD ──
function handlePost(data) {
  const sheet = getSheet();
  const now = new Date();

  const name    = (data.name   || '').toString().trim();
  const mobile  = (data.mobile || '').toString().trim();
  const city    = (data.city   || '').toString().trim();
  const date    = data.date || now.toLocaleDateString('en-IN');
  const time    = data.time || now.toLocaleTimeString('en-IN');
  const timestamp = now.toISOString();

  // Validation
  if (!name || !mobile || !city) {
    return jsonResponse({ status: 'error', message: 'Missing required fields' });
  }

  // Duplicate check (same mobile within 24 hours)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const mobileCol = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    const dateCol   = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
    for (let i = 0; i < mobileCol.length; i++) {
      if (String(mobileCol[i][0]) === mobile && String(dateCol[i][0]) === date) {
        return jsonResponse({
          status: 'duplicate',
          message: 'Already registered today',
        });
      }
    }
  }

  // Append row
  sheet.appendRow([name, mobile, city, date, time, timestamp]);

  // Optional: Send email notification
  // MailApp.sendEmail('your-email@gmail.com', 'New Lead: ' + name, `Name: ${name}\nMobile: ${mobile}\nCity: ${city}`);

  return jsonResponse({
    status: 'success',
    message: 'Lead saved successfully',
    id: sheet.getLastRow(),
  });
}

// ── GET ALL LEADS ──
function handleGetLeads() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return jsonResponse({ status: 'success', leads: [], total: 0 });
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  const leads = data
    .filter(row => row[0] || row[1]) // Skip empty rows
    .map(row => ({
      name:   String(row[0] || ''),
      mobile: String(row[1] || ''),
      city:   String(row[2] || ''),
      date:   String(row[3] || ''),
      time:   String(row[4] || ''),
    }))
    .reverse(); // Most recent first

  return jsonResponse({
    status: 'success',
    leads: leads,
    total: leads.length,
  });
}

// ── GET STATS ──
function handleGetStats() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return jsonResponse({
      status: 'success',
      total: 0,
      today: 0,
      thisWeek: 0,
      cities: 0,
    });
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const today = new Date().toLocaleDateString('en-IN');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let todayCount = 0;
  let weekCount = 0;
  const citySet = new Set();

  data.forEach(row => {
    if (!row[0]) return;
    const dateStr = String(row[3]);
    if (dateStr === today) todayCount++;
    citySet.add(String(row[2]));
    // Week count approximation
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      if (d >= weekAgo) weekCount++;
    }
  });

  return jsonResponse({
    status: 'success',
    total: data.filter(r => r[0]).length,
    today: todayCount,
    thisWeek: weekCount,
    cities: citySet.size,
  });
}

// ── HELPER: JSON Response with CORS ──
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── TEST FUNCTION (run in Apps Script editor) ──
function testSaveLead() {
  const testData = {
    name: 'Test User',
    mobile: '9876543210',
    city: 'Indore',
  };
  const result = handlePost(testData);
  Logger.log(result.getContent());
}

function testGetLeads() {
  const result = handleGetLeads();
  Logger.log(result.getContent());
}
