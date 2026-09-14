// Google-hosted menu mirror. Only the website owner page publishes menu changes.
var MENU_FEED = 'https://lastazionelb.com/api/menu-export';
var MENU_SHEET_ID = '__SPREADSHEET_ID__';

function setupMenuSheet() {
  refreshMenuSheet();
  var triggers = ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === 'refreshMenuSheet'; });
  if (!triggers.length) ScriptApp.newTrigger('refreshMenuSheet').timeBased().everyMinutes(15).create();
  console.log('Menu sheet ready: https://docs.google.com/spreadsheets/d/' + MENU_SHEET_ID + '/edit');
}

function refreshMenuSheet() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var response = UrlFetchApp.fetch(MENU_FEED, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('Published menu could not be fetched; existing sheet data was preserved.');
    var feed = JSON.parse(response.getContentText('UTF-8'));
    if (!Array.isArray(feed.tables) || !feed.tables.length) throw new Error('Invalid menu feed; existing sheet data was preserved.');
    feed.tables.forEach(function (table) {
      if (!table.id || !table.title || !Array.isArray(table.headers) || !table.headers.length || !Array.isArray(table.rows)) throw new Error('Invalid menu table.');
      table.rows.forEach(function (row) { if (!Array.isArray(row) || row.length !== table.headers.length) throw new Error('Invalid menu row.'); });
    });
    var book = SpreadsheetApp.openById(MENU_SHEET_ID);
    book.setSpreadsheetLocale('en_US');
    book.setSpreadsheetTimeZone('Asia/Beirut');
    var properties = PropertiesService.getScriptProperties();
    var mapping = JSON.parse(properties.getProperty('MENU_TABS') || '{}');
    var start = book.getSheetByName('Start here');
    if (!start) {
      var blank = book.getSheets().filter(function (sheet) { return sheet.getLastRow() === 0 && /^Sheet\d*$/.test(sheet.getName()); })[0];
      start = blank ? blank.setName('Start here') : book.insertSheet('Start here', 0);
    }
    feed.tables.forEach(function (table) {
      var sheet = book.getSheets().filter(function (candidate) { return candidate.getSheetId() === mapping[table.id]; })[0];
      if (!sheet) sheet = book.getSheetByName(table.title) || book.insertSheet(table.title);
      mapping[table.id] = sheet.getSheetId();
      var fresh = sheet.getLastRow() === 0;
      var columns = table.headers.length, totalRows = Math.max(table.rows.length + 4, 5);
      if (sheet.getMaxRows() < totalRows) sheet.insertRowsAfter(sheet.getMaxRows(), totalRows - sheet.getMaxRows());
      if (sheet.getMaxColumns() < columns) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
      // Retain formatting and sheet IDs between updates, and clear removed items.
      if (sheet.getFilter()) sheet.getFilter().remove();
      sheet.getRange(4, 1, Math.max(sheet.getLastRow() - 3, totalRows - 3), columns).clearContent();
      var safe = function (value) { return value == null ? '' : typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : value; };
      sheet.getRange(4, 1, table.rows.length + 1, columns).setValues([table.headers].concat(table.rows).map(function (row) { return row.map(safe); }));
      sheet.getRange(1, 1).setValue('La Stazione / ' + table.title);
      sheet.getRange(2, 1).setValue('Published menu mirror · Edit at lastazionelb.com/owner/ · Refreshes every 15 minutes');
      if (fresh) {
        sheet.setHiddenGridlines(true);
        sheet.setFrozenRows(4);
        sheet.setFrozenColumns(0);
        sheet.getRange(1, 1, 1, columns).merge();
        sheet.getRange(2, 1, 1, columns).merge();
        sheet.setColumnWidths(1, columns, 150);
        sheet.setRowHeight(1, 48).setRowHeight(2, 30).setRowHeight(3, 14).setRowHeight(4, 40);
        sheet.setTabColor('#AC321D');
        sheet.protect().setDescription('Live menu mirror: edit the website owner page to change published data.').setWarningOnly(true);
      }
      sheet.getRange(1, 1, totalRows, columns).setFontFamily('Arial').setFontSize(10).setFontColor('#493421').setBackground('#FFFDF8').setVerticalAlignment('top').setWrap(true);
      sheet.getRange(1, 1, 2, columns).setBackground('#F7EFE0');
      sheet.getRange(1, 1).setFontFamily('Georgia').setFontSize(20).setFontWeight('bold').setVerticalAlignment('middle');
      sheet.getRange(2, 1).setWrap(false).setFontSize(10);
      sheet.getRange(4, 1, 1, columns).setBackground('#493421').setFontColor('#FFFDF8').setFontWeight('bold').setVerticalAlignment('middle');
      if (table.rows.length) {
        sheet.getRange(5, 1, table.rows.length, columns).setBackgrounds(table.rows.map(function (_, index) { return table.headers.map(function () { return index % 2 ? '#F7EFE0' : '#FFFDF8'; }); }));
        sheet.autoResizeRows(5, table.rows.length);
      }
      table.headers.forEach(function (header, index) {
        var column = index + 1;
        if (['Description', 'Options', 'Effective subcategories', 'Specific subcategories', 'Extras sections'].indexOf(header) >= 0) sheet.setColumnWidth(column, header === 'Description' ? 330 : 270);
        if (['Item', 'Extra', 'Subcategory', 'Extras section'].indexOf(header) >= 0) sheet.setColumnWidth(column, 220);
        if (header === 'USD' || header === 'LBP') {
          sheet.setColumnWidth(column, 105);
          sheet.getRange(5, column, Math.max(table.rows.length, 1), 1).setNumberFormat(header === 'USD' ? '"$"#,##0.00;[Red]("$"#,##0.00);"$0.00"' : '#,##0;[Red](#,##0);0').setHorizontalAlignment('right');
        }
        if (/ ID$| IDs$|Item order|Price option number|Subcategory order/.test(header)) sheet.hideColumns(column);
      });
      sheet.getRange(4, 1, Math.max(table.rows.length + 1, 2), columns).createFilter();
    });
    properties.setProperty('MENU_TABS', JSON.stringify(mapping));
    var notes = [
      ['La Stazione', 'LIVE MENU DIRECTORY'],
      ['Coffee & company', 'Items, prices, descriptions and extras, linked to the published menu.'],
      ['', ''],
      ['Menu items', "=COUNTA('All items'!D5:D)"],
      ['Price options', "=COUNTA('All prices'!C5:C)"],
      ['Extras', "=COUNTA('Extras'!B5:B)"],
      ['Subcategories', "=COUNTA('Categories'!B5:B)"],
      ['Last successful refresh', new Date()],
      ['', ''],
      ['Browse the menu', 'Contents']
    ];
    feed.tables.forEach(function (table) {
      notes.push(['=HYPERLINK("#gid=' + mapping[table.id] + '","' + table.title.replace(/"/g, '""') + '")', table.id === 'items' ? 'One row per item, including descriptions, options, visibility and extras.' : table.id === 'extras' ? 'Every extra, its price, and the categories / subcategories it applies to.' : table.id === 'categories' ? 'Menu structure, ordering IDs and item counts.' : 'One row per price option, with separate USD and LBP columns.']);
    });
    notes = notes.concat([
      ['', ''],
      ['How updates work', 'The website is the source. Changes made in this sheet do not publish to the website and are replaced by the next refresh.'],
      ['Edit the menu', '=HYPERLINK("https://lastazionelb.com/owner/","Open the owner page")'],
      ['Customer menu', '=HYPERLINK("https://lastazionelb.com/menu/","Open the public menu")'],
      ['Refresh schedule', 'Every 15 minutes, including while this sheet is closed. Check the last successful refresh above.'],
      ['Prices', 'USD and LBP are the published prices. Blank means no price was supplied; zero means free. No exchange rate is inferred.'],
      ['Extras scope', 'Whole categories apply to all their subcategories. Specific subcategories apply only to those named.'],
      ['Technical columns', 'Stable IDs are retained in hidden columns. Unhide them when preparing a POS integration.'],
      ['Source', MENU_FEED]
    ]);
    start.getRange(1, 1, Math.max(start.getLastRow(), notes.length), 2).clearContent();
    start.getRange(1, 1, notes.length, 2).setValues(notes).setFontFamily('Arial').setFontSize(11).setFontColor('#493421').setBackground('#FFFDF8').setWrap(true).setVerticalAlignment('middle');
    start.setHiddenGridlines(true).setColumnWidth(1, 230).setColumnWidth(2, 680).setRowHeights(1, notes.length, 44).setTabColor('#493421');
    start.getRange(1, 1, 2, 2).setBackground('#F7EFE0');
    start.getRange(1, 1, 1, 2).setFontFamily('Georgia').setFontSize(21).setFontWeight('bold');
    start.getRange(4, 2, 4, 1).setBackground('#F7EFE0').setFontSize(22).setFontWeight('bold').setFontColor('#AC321D');
    start.getRange(8, 2).setNumberFormat('yyyy-mm-dd hh:mm');
    start.getRange(10, 1, 1, 2).setBackground('#493421').setFontColor('#FFFDF8').setFontWeight('bold');
    SpreadsheetApp.flush();
    console.log('Refreshed all ' + feed.tables.length + ' menu tables.');
  } finally { lock.releaseLock(); }
}
