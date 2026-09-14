import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { menuTables } from '../lib/menu-tables.mjs';
import seed from '../public/site-content/default.json' with { type: 'json' };

const source = await readFile(new URL('../tools/menu-sheet/Code.gs', import.meta.url), 'utf8');
function environment() {
  const sheets = [], properties = {}, triggers = [];
  let code = 200;
  const feed = { tables: menuTables(structuredClone(seed)) };
  function newSheet(name) {
    const data = new Map();
    const object = {
      name, data, getName() { return this.name; }, setName(value) { this.name = value; return sheet; }, getSheetId() { return sheets.indexOf(sheet) + 1; },
      setFrozenRows() { return null; }, setFrozenColumns() { return null; },
      getLastRow() { return Math.max(0, ...[...data.keys()].map(key => Number(key.split(',')[0]))); }, getMaxRows: () => 1000, getMaxColumns: () => 26, getFilter: () => null,
      getRange(r, c, height = 1, width = 1) {
        const object = {
          setValues(values) { assert.equal(values.length, height); values.forEach((row, y) => { assert.equal(row.length, width); row.forEach((value, x) => data.set(`${r + y},${c + x}`, value)); }); return range; },
          setValue(value) { data.set(`${r},${c}`, value); return range; },
          clearContent() { for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.delete(`${r + y},${c + x}`); return range; }
        };
        const range = new Proxy(object, { get(target, key) { return key in target ? target[key] : () => range; } });
        return range;
      },
      protect() { const p = { setDescription: () => p, setWarningOnly: () => p }; return p; }
    };
    const sheet = new Proxy(object, { get(target, key) { return key in target ? target[key] : () => sheet; } });
    sheets.push(sheet); return sheet;
  }
  const book = { getSheets: () => sheets, getSheetByName: name => sheets.find(sheet => sheet.name === name), insertSheet: newSheet, setSpreadsheetLocale: () => null, setSpreadsheetTimeZone: () => null };
  const script = vm.createContext({ console: { log() {} }, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(feed) }) }, SpreadsheetApp: { openById: () => book, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key], setProperty: (key, value) => { properties[key] = value; } }) },
    ScriptApp: { getProjectTriggers: () => triggers, newTrigger: name => { const trigger = { timeBased: () => trigger, everyMinutes: minutes => { assert.equal(minutes, 15); return trigger; }, create: () => triggers.push({ getHandlerFunction: () => name }) }; return trigger; } }
  });
  vm.runInContext(source, script);
  return { script, sheets, triggers, feed, failFetch() { code = 503; } };
}

test('menu sheet preserves every value and scope, updates removed rows, and schedules once', () => {
  const env = environment();
  env.script.setupMenuSheet();
  assert.equal(env.sheets.length, 9);
  for (const table of env.feed.tables) {
    const sheet = env.sheets.find(sheet => sheet.name === table.title);
    [table.headers, ...table.rows].forEach((row, y) => row.forEach((value, x) => assert.equal(sheet.data.get(`${y + 4},${x + 1}`), value ?? '')));
  }
  const table = env.feed.tables[0], sheet = env.sheets.find(sheet => sheet.name === table.title);
  const previousCount = table.rows.length;
  table.rows.pop();
  table.rows[0][3] = '=HYPERLINK("https://example.com")';
  env.script.setupMenuSheet();
  assert.equal(env.sheets.length, 9);
  assert.equal(env.triggers.length, 1);
  assert.equal(sheet.data.get('5,4'), '\'=HYPERLINK("https://example.com")');
  assert.equal(sheet.data.get(`${previousCount + 4},1`), undefined);
});

test('failed source fetch preserves last successful menu data', () => {
  const env = environment();
  env.script.setupMenuSheet();
  const before = JSON.stringify(env.sheets.map(sheet => [...sheet.data]));
  env.failFetch();
  assert.throws(() => env.script.refreshMenuSheet(), /existing sheet data was preserved/);
  assert.equal(JSON.stringify(env.sheets.map(sheet => [...sheet.data])), before);
});
