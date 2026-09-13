# Owner access

The owner workspace is https://lastazionelb.com/owner/. Google sign-in is required for editing, publishing and photo uploads. `lastazione10@gmail.com` is the primary owner. Only that account can add or remove editors in **Who can edit**. An added email must belong to a Google account; it does not have to end in `gmail.com`. Adding access does not send an email.

## One-time activation still needed

The implementation is complete, but no Google OAuth client ID or access to the site's Google/Netlify account settings was available in this workspace. Until the following account configuration is completed, the workspace shows a setup message and all writes are blocked. There is no temporary open-access bypass.

1. In [Google Cloud's authentication console](https://console.cloud.google.com/auth/overview), use a project controlled by the coffee shop. Complete Google's required branding and consent information for La Stazione. Choose an External audience so the owner can later approve other Google accounts.
2. Create an OAuth client with application type **Web application**. Add `https://lastazionelb.com` to **Authorized JavaScript origins**, without a path. If you use the `www` domain directly, also add `https://www.lastazionelb.com`. This button uses a JavaScript callback, so no redirect URI or client secret is needed. [Google's setup instructions](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
3. In the Netlify project for `lastazionelb.com`, add the environment variable **`GOOGLE_CLIENT_ID`** with the generated value ending in `.apps.googleusercontent.com`. Make it available to **Functions** in production, then deploy the site again. The client ID is public configuration; do not paste a client secret into source files. [Netlify environment-variable guidance](https://docs.netlify.com/build/configure-builds/environment-variables/)
4. If the Google app is in Testing, add `lastazione10@gmail.com` as a test user. Before allowing other editors freely, complete Google's production publishing requirements; otherwise every added editor also needs to be added to Google's test-user list.
5. Open `/owner/`, sign in as `lastazione10@gmail.com`, and use **Who can edit** to grant access. Confirm a second approved Google account can edit but cannot manage access; remove it and confirm its next edit is rejected.

No Netlify Identity account or email/password provider is used. No new hosting subscription is required by this implementation.

## Behavior and security

- Google ID tokens are verified on the server with Google's official library, including the signature, client audience, issuer and expiry. Email must be verified. A nonce tied to the browser's secure cookie prevents sign-in substitution and repeated use. [Google verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- Sessions last eight hours and use random, opaque `Secure`, `HttpOnly`, `SameSite=Lax` cookies. Only hashed session tokens are stored. Signing out invalidates the server session.
- Every protected request checks the current access list. An editor cannot grant access; the primary owner cannot be removed. Concurrent access changes produce a conflict instead of silently overwriting one another.
- Drafts are separate for each signed-in email. Expired or revoked sessions hide the editor and retain the draft locally. Signing out with a draft offers download or discard before clearing it.
- Menu/photo content remains in the existing `la-stazione-v4` Blob store. Sessions and permissions use the separate `la-stazione-access` store. Git deploys do not reset either store. Expired session records cannot authenticate; they remain small stored records until maintenance cleanup.
- Public menu reads and existing photo URLs remain available without signing in. Direct unauthorized content writes and image uploads are rejected independently of the login screen.

Automated tests cover forged/unapproved sign-ins, nonce checks, session expiry/logout, owner/editor privileges, revocation, write protection and concurrent access changes. Browser fixtures cover the login and access screens. A real Google-account sign-in cannot be verified until the real client ID is configured.
