import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { authDirectory, googleRequest } from './google-sheets-auth.mjs';

const statePath = join(authDirectory, 'menu-sheet.json');
let saved;
try { saved = JSON.parse(await readFile(statePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!saved) {
  const sheet = await googleRequest('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', { method: 'POST', body: { name: 'La Stazione | Live menu', mimeType: 'application/vnd.google-apps.spreadsheet', description: 'Menu items, categories, prices and extras mirrored from lastazionelb.com.' } });
  saved = { spreadsheetId: sheet.id, url: sheet.webViewLink, createdAt: new Date().toISOString() };
  await writeFile(statePath, JSON.stringify(saved, null, 2));
}
if (!saved.scriptId) {
  const source = (await readFile(new URL('./menu-sheet/Code.gs', import.meta.url), 'utf8')).replace('__SPREADSHEET_ID__', saved.spreadsheetId);
  const boundary = 'lastazione_menu_script_boundary';
  const metadata = { title: 'La Stazione - Menu sheet sync', mimeType: 'application/vnd.google-apps.script' };
  const runner = await readFile(new URL('./menu-sheet/Run.gs', import.meta.url), 'utf8');
  const content = { files: [{ name: 'Code', type: 'server_js', source }, { name: 'Run', type: 'server_js', source: runner }] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/vnd.google-apps.script+json\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`;
  const script = await googleRequest('https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true', { method: 'POST', contentType: `multipart/related; boundary=${boundary}`, body });
  saved.scriptId = script.id;
  saved.scriptUrl = 'https://script.google.com/d/' + script.id + '/edit';
  await writeFile(statePath, JSON.stringify(saved, null, 2));
}
if (process.argv.includes('--repair-function-list')) {
  // Round-trip every existing file: Drive updates replace the full project.
  const content = await googleRequest(`https://www.googleapis.com/drive/v3/files/${saved.scriptId}/export?mimeType=application%2Fvnd.google-apps.script%2Bjson`);
  const runner = await readFile(new URL('./menu-sheet/Run.gs', import.meta.url), 'utf8');
  const existing = content.files.find(file => file.name === 'Run');
  if (existing) existing.source = runner;
  else content.files.push({ name: 'Run', type: 'server_js', source: runner });
  const files = content.files.map(file => ({ name: file.name, type: { server_js: 'SERVER_JS', html: 'HTML', json: 'JSON' }[file.type], source: file.source }));
  await googleRequest(`https://script.googleapis.com/v1/projects/${saved.scriptId}/content`, { method: 'PUT', body: { files } });
  const verify = await googleRequest(`https://www.googleapis.com/drive/v3/files/${saved.scriptId}/export?mimeType=application%2Fvnd.google-apps.script%2Bjson`);
  if (!verify.files.some(file => file.name === 'Run' && file.source === runner)) throw new Error('Setup entry point did not persist.');
  console.log('Setup entry point saved and read back from Google.');
}
console.log(JSON.stringify(saved, null, 2));
