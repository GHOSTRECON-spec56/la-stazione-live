import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { authDirectory, googleRequest } from './google-sheets-auth.mjs';

const state = JSON.parse(await readFile(join(authDirectory, 'menu-sheet.json'), 'utf8'));
const content = await googleRequest(`https://www.googleapis.com/drive/v3/files/${state.scriptId}/export?mimeType=application%2Fvnd.google-apps.script%2Bjson`);
const code = content.files.find(file => file.name === 'Code' && file.type === 'server_js');
if (!code) throw new Error('Expected Code.gs was not found; no files were changed.');
await mkdir('.migration-backups/menu-script', { recursive: true });
await writeFile(`.migration-backups/menu-script/before-method-fix-${Date.now()}.json`, JSON.stringify(content, null, 2));
const replacements = [
  ["book.setSpreadsheetLocale('en_US').setSpreadsheetTimeZone('Asia/Beirut');", "book.setSpreadsheetLocale('en_US');\n    book.setSpreadsheetTimeZone('Asia/Beirut');"],
  ["sheet.setHiddenGridlines(true).setFrozenRows(4).setFrozenColumns(table.id === 'items' ? 4 : 2);", "sheet.setHiddenGridlines(true);\n        sheet.setFrozenRows(4);\n        sheet.setFrozenColumns(0);"]
];
for (const [before, after] of replacements) {
  if (code.source.includes(before)) code.source = code.source.replace(before, after);
  else if (!code.source.includes(after)) throw new Error('The uploaded source differs from the expected repair; stopped before writing.');
}
new vm.Script(code.source);
const files = content.files.map(file => ({ name: file.name, type: { server_js: 'SERVER_JS', html: 'HTML', json: 'JSON' }[file.type], source: file.source }));
if (files.some(file => !file.type)) throw new Error('Unrecognized file type; stopped before writing.');
await googleRequest(`https://script.googleapis.com/v1/projects/${state.scriptId}/content`, { method: 'PUT', body: { files } });
const verified = await googleRequest(`https://www.googleapis.com/drive/v3/files/${state.scriptId}/export?mimeType=application%2Fvnd.google-apps.script%2Bjson`);
const updated = verified.files.find(file => file.name === 'Code');
if (updated?.source !== code.source) throw new Error('Google read-back did not match the repair.');
console.log(JSON.stringify({ repaired: true, functions: updated.functionSet?.values?.map(value => value.name), scriptUrl: state.scriptUrl }));
