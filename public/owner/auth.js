const $ = selector => document.querySelector(selector);
const workspace = $('#workspace');
const gate = $('#auth-gate');
const googleButton = $('#google-sign-in');
const accountChoice = $('#account-choice');
let selectedEmail = null;
const retryButton = $('#auth-retry');
const accessList = $('#access-list');
const accessForm = $('#grant-access-form');
let session = null;
let editorEmail = null;
let editorPromise = null;
let sessionPromise = null;
let googleScriptPromise = null;
let loginConfig = null;
let signInPromise = null;
let renderedNonce = null;
let loginInProgress = false;
let accessEtag = null;
let accessBusy = false;
let signingOut = false;

function authError(message, status = 0) {
  return Object.assign(new Error(message), { status });
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/.netlify/functions/${path}`, {
      ...options, cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw authError(data.error || data.message || 'The request could not be completed.', response.status);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw authError('The connection took too long. Please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function lockWorkspace() {
  workspace.hidden = true;
  workspace.inert = true;
  gate.hidden = false;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
}

function showGate({ title, description, message = '', busy = false, signedIn = false, retry = false, google = false }) {
  lockWorkspace();
  gate.setAttribute('aria-busy', String(busy));
  $('#auth-title').textContent = title;
  $('#auth-description').textContent = description;
  $('#auth-feedback').textContent = message;
  googleButton.hidden = !google;
  accountChoice.hidden = !google || Boolean(selectedEmail);
  $('#selected-account').hidden = !google || !selectedEmail;
  if (!selectedEmail) googleButton.hidden = true;
  googleButton.inert = busy;
  retryButton.hidden = !retry;
  retryButton.disabled = busy;
  $('#locked-sign-out').hidden = !signedIn;
  $('#locked-sign-out').disabled = busy;
}

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const fail = () => {
        clearTimeout(timeout);
        script.remove();
        googleScriptPromise = null;
        reject(new Error('Google sign-in could not load. Check your connection and try again.'));
      };
      const timeout = setTimeout(fail, 15000);
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        if (window.google?.accounts?.id) resolve(window.google.accounts.id);
        else fail();
      };
      script.onerror = fail;
      document.head.append(script);
    });
  }
  return googleScriptPromise;
}

async function showSignIn(message = '') {
  if (signInPromise) return signInPromise;
  signInPromise = (async () => {
    try {
      if (!loginConfig) loginConfig = await request('owner-login');
      if (!loginConfig.configured) {
        loginConfig = null;
        showGate({
          title: 'Your workspace is locked.',
          description: 'Google sign-in is being set up. Editing is locked until setup is complete.',
          message: message || 'You can check again in a moment.', retry: true
        });
        return;
      }
      showGate({
        title: 'Your workspace, with care.',
        description: 'Choose an account to sign in and care for your menu and photos.',
        message, google: true
      });
      if (!selectedEmail) return;
      const email = selectedEmail;
      const identity = await loadGoogle();
      if (selectedEmail !== email) return;
      $('#selected-email').textContent = email;
      if (renderedNonce !== `${loginConfig.nonce}:${email}`) {
        identity.disableAutoSelect();
        identity.initialize({ client_id: loginConfig.clientId, nonce: loginConfig.nonce, callback: handleGoogleCredential, auto_select: false, button_auto_select: false, login_hint: email });
        googleButton.replaceChildren();
        identity.renderButton(googleButton, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'en',
          width: Math.min(340, Math.max(200, gate.clientWidth - 60))
        });
        renderedNonce = `${loginConfig.nonce}:${email}`;
      }
    } catch (error) {
      loginConfig = null;
      showGate({
        title: 'We could not open sign-in.',
        description: 'Editing is locked. Check your connection and try again.',
        message: error.message || 'Google sign-in could not load.', retry: true
      });
    }
  })();
  try { return await signInPromise; }
  finally { signInPromise = null; }
}

accountChoice.addEventListener('submit', async event => {
  event.preventDefault();
  if (loginInProgress) return;
  selectedEmail = $('#sign-in-email').value.trim().toLowerCase();
  if (signInPromise) await signInPromise;
  await showSignIn();
});
$('#another-account').addEventListener('click', () => {
  $('#sign-in-email').value = '';
  $('#sign-in-email').focus();
});
$('#change-account').addEventListener('click', async () => {
  if (loginInProgress) return;
  selectedEmail = null;
  renderedNonce = null;
  googleButton.replaceChildren();
  if (signInPromise) await signInPromise;
  await showSignIn();
  $('#sign-in-email').focus();
});

async function handleGoogleCredential(response) {
  if (loginInProgress || signingOut) return;
  loginInProgress = true;
  googleButton.inert = true;
  gate.setAttribute('aria-busy', 'true');
  $('#auth-feedback').textContent = 'Checking your Google account…';
  try {
    if (!response.credential) throw authError('Google sign-in was not completed. Please try again.');
    await request('owner-login', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
    loginConfig = null;
    renderedNonce = null;
    await checkSession();
  } catch (error) {
    loginConfig = null;
    renderedNonce = null;
    selectedEmail = null;
    await showSignIn(error.status === 403
      ? 'This Google account does not have access. Ask the owner to add its email, or choose an approved account.'
      : error.status === 401 ? 'Google sign-in expired. Please sign in again.'
      : error.message || 'Sign-in could not finish. Please try again.');
  } finally {
    loginInProgress = false;
    googleButton.inert = false;
    gate.setAttribute('aria-busy', 'false');
  }
}

function loadEditor() {
  if (!editorPromise) {
    editorEmail = session.user.email.toLowerCase();
    editorPromise = Promise.resolve(window.LaStazioneContent?.ready).then(() => new Promise((resolve, reject) => {
      if (!window.LaStazioneContent) { reject(new Error('The content service did not load. Reload this page.')); return; }
      const script = document.createElement('script');
      script.src = '/owner/owner.js';
      script.onload = resolve;
      script.onerror = () => { editorPromise = null; script.remove(); reject(new Error('The editor could not load. Please try again.')); };
      document.head.append(script);
    }));
  }
  return editorPromise;
}

async function openWorkspace(verified) {
  if (editorEmail && editorEmail !== verified.user.email.toLowerCase()) {
    lockWorkspace();
    location.reload();
    throw authError('Opening the workspace for your account.');
  }
  const wasAuthorized = session?.authorized;
  session = verified;
  $('#signed-in-email').textContent = verified.user.email;
  $('#manage-access-link').hidden = !verified.canManageAccess;
  $('#access-management').hidden = !verified.canManageAccess;
  await loadEditor();
  if (signingOut) throw authError('Signing out.');
  gate.hidden = true;
  workspace.hidden = false;
  workspace.inert = false;
  if (verified.canManageAccess && (!wasAuthorized || accessEtag === null)) void loadAccess();
  return verified;
}

async function checkSession() {
  if (signingOut) throw authError('Signing out.');
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    try {
      const verified = await request('owner-session');
      if (!verified.authenticated || !verified.authorized || !verified.user?.email) throw authError('Sign in to open the workspace.', 401);
      return await openWorkspace(verified);
    } catch (error) {
      session = null;
      if (signingOut) throw error;
      lockWorkspace();
      if (error.status === 401) await showSignIn(editorEmail ? 'Your session ended. Sign in again to continue with your draft.' : '');
      else if (error.status === 403) showGate({
        title: 'This account does not have access.',
        description: 'Ask the owner to add the email you use for Google, or sign out and choose an approved account.',
        message: editorEmail ? 'Your unpublished draft has been kept on this device.' : '', signedIn: true, retry: true
      });
      else if (error.status === 503) showGate({
        title: 'Your workspace is locked.',
        description: 'The sign-in service is temporarily unavailable. Please try again.',
        message: 'You can check again in a moment.', retry: true, signedIn: Boolean(editorEmail)
      });
      else showGate({
        title: 'We could not check your sign-in.',
        description: 'Editing is locked until we can verify your access. Check your connection and try again.',
        message: error.message || 'The connection failed.', retry: true, signedIn: Boolean(editorEmail)
      });
      throw error;
    } finally { sessionPromise = null; }
  })();
  return sessionPromise;
}

window.LaStazioneAuth = {
  ensureSession: checkSession,
  get user() { return session?.user ?? null; }
};

function accessFeedback(message, error = false) {
  $('#access-feedback').textContent = message;
  $('#access-feedback').classList.toggle('error', error);
}

function setAccessBusy(value) {
  accessBusy = value;
  $('#grant-access').disabled = value || accessEtag === null;
  $('#grant-access').textContent = value ? 'Saving…' : 'Give access';
  $('#access-email').disabled = value;
  accessList.querySelectorAll('button').forEach(button => { button.disabled = value; });
}

function renderAccess(data) {
  accessEtag = data.etag;
  $('#primary-owner-email').textContent = data.ownerEmail;
  accessList.replaceChildren();
  for (const editor of data.editors) {
    const row = document.createElement('li');
    const account = document.createElement('div');
    const email = document.createElement('strong');
    email.textContent = editor.email;
    const role = document.createElement('span');
    role.textContent = 'Editor';
    account.append(email, role);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button small danger';
    remove.textContent = 'Remove access';
    remove.setAttribute('aria-label', `Remove access for ${editor.email}`);
    remove.addEventListener('click', () => updateAccess('DELETE', editor.email));
    row.append(account, remove);
    accessList.append(row);
  }
  $('#reload-access').hidden = true;
  setAccessBusy(false);
}

async function loadAccess({ keepMessage = false } = {}) {
  if (!session?.canManageAccess || accessBusy) return;
  setAccessBusy(true);
  if (!keepMessage) accessFeedback('Loading access…');
  try {
    const data = await request('owner-access');
    renderAccess(data);
    if (!keepMessage) accessFeedback(data.editors.length ? '' : 'Only you have editing access. Add an email above to share the workspace.');
  } catch (error) {
    accessEtag = null;
    accessFeedback('The access list could not load. Try again before changing access.', true);
    $('#reload-access').hidden = false;
    if ([401, 403].includes(error.status)) void checkSession().catch(() => {});
  } finally { setAccessBusy(false); }
}

async function updateAccess(method, email) {
  if (accessBusy || accessEtag === null || !session?.canManageAccess) return;
  setAccessBusy(true);
  accessFeedback(method === 'POST' ? 'Giving access…' : 'Removing access…');
  try {
    const verified = await checkSession();
    if (!verified.canManageAccess) throw authError('Only the owner can manage access.', 403);
    const data = await request('owner-access', { method, body: JSON.stringify({ email, etag: accessEtag }) });
    renderAccess(data);
    accessFeedback(method === 'POST' ? `${email} can now sign in and edit. Share this page with them.` : `Access removed for ${email}.`);
    if (method === 'POST') $('#access-email').value = '';
  } catch (error) {
    accessFeedback(error.status === 409 ? 'Access changed in another session. The list is being refreshed; review it before trying again.' : error.message || 'Access could not be changed. Try again.', true);
    if ([401, 403].includes(error.status)) void checkSession().catch(() => {});
    setAccessBusy(false);
    if (error.status === 409) await loadAccess({ keepMessage: true });
  } finally { setAccessBusy(false); }
}

async function signOut() {
  if (signingOut) return;
  signingOut = true;
  window.LaStazioneOwner?.persistDraft();
  showGate({ title: 'Signing out…', description: 'Closing your workspace on this device.', busy: true });
  try {
    await request('owner-login', { method: 'DELETE' });
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* The server session has already ended. */ }
    window.LaStazioneOwner?.clearDraft();
    session = null;
    location.replace('/owner/');
  } catch {
    signingOut = false;
    showGate({ title: 'Sign-out could not finish.', description: 'Your workspace is locked, but this device may still be signed in. Check your connection and try signing out again.', message: 'Your unpublished draft has been kept.', signedIn: true });
  }
}

function requestSignOut() {
  if (window.LaStazioneOwner?.hasUnpublishedWork) {
    $('#sign-out-dialog').returnValue = '';
    $('#sign-out-dialog').showModal();
  }
  else void signOut();
}

retryButton.addEventListener('click', () => {
  retryButton.disabled = true;
  $('#auth-feedback').textContent = 'Checking your access…';
  void checkSession().catch(() => {});
});
$('#sign-out').addEventListener('click', requestSignOut);
$('#locked-sign-out').addEventListener('click', requestSignOut);
$('#sign-out-dialog').addEventListener('close', () => {
  if ($('#sign-out-dialog').returnValue === 'sign-out') void signOut();
});
$('#sign-out-backup').addEventListener('click', () => window.LaStazioneOwner?.downloadBackup());
$('#manage-access-link').addEventListener('click', () => void loadAccess());
$('#reload-access').addEventListener('click', () => void loadAccess());
accessForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!accessForm.reportValidity()) return;
  void updateAccess('POST', $('#access-email').value.trim().toLowerCase());
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !signingOut && !loginInProgress) {
    workspace.inert = true;
    void checkSession().catch(() => {});
  }
});
window.addEventListener('pageshow', event => {
  if (event.persisted && !signingOut) {
    lockWorkspace();
    void checkSession().catch(() => {});
  }
});
void checkSession().catch(() => {});
