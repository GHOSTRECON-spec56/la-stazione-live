// Local, narrowly scoped authorization for the cafe's menu spreadsheet.
// Credentials stay outside the repository and are never printed.
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export const authDirectory = join(homedir(), '.la-stazione-google');
const credentialPath = join(authDirectory, 'credentials.json');
export async function googleRequest(url, { method = 'GET', body, contentType = 'application/json', rawResponse = false } = {}) {
  const saved = JSON.parse(await readFile(credentialPath, 'utf8'));
  if (!saved.access_token || Date.now() > saved.expires_at - 60000) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ client_id: saved.client_id,
        client_secret: saved.client_secret, refresh_token: saved.refresh_token, grant_type: 'refresh_token' })
    });
    const tokens = await response.json();
    if (!response.ok) throw new Error('Google authorization expired. Run the local sign-in again.');
    Object.assign(saved, tokens, { expires_at: Date.now() + tokens.expires_in * 1000 });
    await writeFile(credentialPath, JSON.stringify(saved), { mode: 0o600 });
  }
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${saved.access_token}`, 'Content-Type': contentType }, body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body });
  if (rawResponse && response.ok) return Buffer.from(await response.arrayBuffer());
  const data = await response.json();
  if (!response.ok) throw new Error(`Google API ${response.status}: ${data.error?.message || 'Request failed'}`);
  return data;
}

if (process.argv.includes('--login')) {
  const clientModule = process.env.LA_STAZIONE_CLASP_CLIENT_MODULE;
  if (!clientModule) throw new Error('Set LA_STAZIONE_CLASP_CLIENT_MODULE to the installed official clasp auth/oauth_client.js module.');
  const { DEFAULT_CLASP_OAUTH_CLIENT_ID: clientId, DEFAULT_CLASP_OAUTH_CLIENT_SECRET: clientSecret } = await import(pathToFileURL(clientModule).href);
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  const redirect = 'http://localhost:48971/callback';
  const scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'];
  if (process.argv.includes('--manage-scripts')) scopes.push('https://www.googleapis.com/auth/script.projects');
  const parameters = new URLSearchParams({ client_id: clientId, redirect_uri: redirect,
    response_type: 'code', scope: scopes.join(' '),
    access_type: 'offline', prompt: 'consent select_account', state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost:48971');
    if (url.pathname === '/start') { response.writeHead(302, { Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + parameters }); response.end(); return; }
    if (url.pathname !== '/callback' || url.searchParams.get('state') !== state) { response.writeHead(400); response.end('Invalid authorization response.'); return; }
    if (url.searchParams.has('error')) { response.writeHead(400); response.end('Google access was not granted. Return to Codex to continue.'); return; }
    try {
      const result = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret, code: url.searchParams.get('code') || '',
        redirect_uri: redirect, code_verifier: verifier, grant_type: 'authorization_code'
      }) });
      const tokens = await result.json();
      if (!result.ok || !tokens.refresh_token) throw new Error('Google did not complete authorization.');
      if (!scopes.every(scope => tokens.scope?.split(' ').includes(scope))) {
        response.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>One permission is still needed</h1><p>Google sign-in worked, but a requested permission was not selected.</p><p><a href="/start">Try again</a>, select the requested file and Apps Script permissions, and continue.</p>');
        console.log('Sign-in succeeded, but file access was not selected. Waiting for retry.');
        return;
      }
      await mkdir(authDirectory, { recursive: true });
      await writeFile(credentialPath, JSON.stringify({ ...tokens, client_id: clientId, client_secret: clientSecret, expires_at: Date.now() + tokens.expires_in * 1000 }), { mode: 0o600 });
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<h1>La Stazione: Google connected</h1><p>You can close this tab and return to Codex. The menu sheet connection is authorized.</p>');
      console.log('Google authorization saved securely. Ready to create the menu sheet.');
      server.close();
    } catch (error) { response.writeHead(500); response.end('Authorization could not finish. Return to Codex.'); console.error(error.message); }
  });
  server.listen(48971, 'localhost', () => {
    console.log('Sign in here: http://localhost:48971/start');
    if (!process.argv.includes('--no-open')) spawn('powershell.exe', ['-NoProfile', '-Command', "Start-Process -FilePath 'http://localhost:48971/start'"], { stdio: 'ignore', windowsHide: true });
  });
}
