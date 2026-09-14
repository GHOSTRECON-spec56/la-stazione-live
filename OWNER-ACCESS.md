# Owner access

The owner workspace is https://lastazionelb.com/owner/. Google sign-in is required for editing, publishing and photo uploads. `lastazione10@gmail.com` is the primary owner. Only that account can add or remove editors in **Who can edit**. An added email must belong to a Google account; it does not have to end in `gmail.com`. Adding access does not send an email.

## Google configuration

The owner's Google Client ID is deployed to Cloudflare as of 14 September 2026. Production checks found that Google accepts `https://www.lastazionelb.com` but rejects `https://lastazionelb.com`; add the latter to the existing client's Authorized JavaScript origins. The website enforces Google authentication and the primary-owner/editor access list. Real owner sign-in and publishing should be verified interactively. The instructions below document the configuration for maintenance; do not create a second OAuth client unnecessarily. See [CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md).

1. In [Google Cloud's authentication console](https://console.cloud.google.com/auth/overview), use a project controlled by the coffee shop. Complete Google's required branding and consent information for La Stazione. Choose an External audience so the owner can later approve other Google accounts.
2. Create an OAuth client with application type **Web application**. Add `https://lastazionelb.com` to **Authorized JavaScript origins**, without a path. If you use the `www` domain directly, also add `https://www.lastazionelb.com`. This button uses a JavaScript callback, so no redirect URI or client secret is needed. [Google's setup instructions](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
3. For Cloudflare, set **`vars.GOOGLE_CLIENT_ID`** in `wrangler.production.json` to the generated value ending in `.apps.googleusercontent.com`, then run `npm run deploy:cloudflare`. If still deploying on Netlify, set the same environment variable for production Functions there. The client ID is public configuration; do not put a client secret into source files.
4. This implementation requests only basic Google sign-in information (openid/email/profile). Google exempts that scope set from the Testing-mode test-user restriction; approved editors do not each need to be registered as Google Cloud test users. Complete the required Google branding configuration. [Google audience guidance](https://support.google.com/cloud/answer/15549945?hl=en)
5. Open `/owner/`, sign in as `lastazione10@gmail.com`, and use **Who can edit** to grant access. Confirm a second approved Google account can edit but cannot manage access; remove it and confirm its next edit is rejected.

No Netlify Identity account or email/password provider is used. No new hosting subscription is required by this implementation.

## Behavior and security

- Google ID tokens are verified on the server using `jose` and Google's published signing keys, including the signature, client audience, issuer and expiry. Email must be verified. A nonce tied to the browser's secure cookie prevents sign-in substitution and repeated use. [Google verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- Sessions last eight hours and use random, opaque `Secure`, `HttpOnly`, `SameSite=Lax` cookies. Only hashed session tokens are stored. Signing out invalidates the server session.
- Every protected request checks the current access list. An editor cannot grant access; the primary owner cannot be removed. Concurrent access changes produce a conflict instead of silently overwriting one another.
- Drafts are separate for each signed-in email. Expired or revoked sessions hide the editor and retain the draft locally. Signing out with a draft offers download or discard before clearing it.
- Until cutover, Netlify uses its existing content and access Blob stores. On Cloudflare, D1 stores menu, permissions and sessions; KV stores uploaded photos. Deploys do not reset these stores. Expired sessions cannot authenticate. Cloudflare runs hourly bounded cleanup of expired sessions/nonces and menu history older than 30 days.
- Public menu reads and existing photo URLs remain available without signing in. Direct unauthorized content writes and image uploads are rejected independently of the login screen.

Automated tests cover forged/unapproved sign-ins, nonce checks, session expiry/logout, owner/editor privileges, revocation, write protection and concurrent access changes. Browser fixtures cover the login and access screens. A real Google-account sign-in cannot be verified until the real client ID is configured.
