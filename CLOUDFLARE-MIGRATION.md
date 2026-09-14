# Move La Stazione to Cloudflare Free

**Completed domain cutover on 14 September 2026:** `lastazionelb.com` and `www.lastazionelb.com` now use Cloudflare Worker Custom Domains, with the final V6 website and imported menu. The zone is Active. Keep this guide for maintenance and recovery; do not repeat the initial import or nameserver setup. See [production verification](cloudflare/VERIFICATION.md) for evidence and the remaining Google authorized-origin setting. The previous Netlify project remains available as a backup, and code is on `migration/cloudflare`.

The destination is **Cloudflare Workers with Static Assets, D1 and Workers KV**, all on Workers Free. This preserves the final design, animations, `/menu/` QR address, photo galleries and Google owner workspace. There is no R2 activation, paid plan or paid image-transformation service in this setup.

## Why this fits the coffee shop

| Resource | Free allowance | What La Stazione uses it for |
| --- | --- | --- |
| Static assets | Free unlimited requests; no bandwidth charge | HTML, CSS, JavaScript, fonts and the existing photos |
| Worker execution | 100,000 requests/day, shared across the account; 10 ms CPU/request | Reading the current menu, owner actions and uploaded-photo requests |
| D1 | 5 million rows read/day; 100,000 rows written/day; 5 GB/account, 500 MB per database | Menu content, editor permissions, sessions and recovery history |
| KV | 1 GB storage; 100,000 reads/day; 1,000 writes/day | Photos subsequently uploaded by the owner |

The current static package is about 6 MB. A normal fresh homepage or menu visit requests the content API once; the existing photos are static assets. At 1,000 such visits/day, those menu reads use roughly 1% of the Worker request allowance, before owner activity, uploaded photos, bots and any other applications in the account. Future uploaded photos add a Worker request and potentially a KV read when the browser needs to download them. This is an estimate, not a traffic guarantee.

Ordinary static pages do not run the Worker. If a dynamic daily quota is exhausted, API requests can fail until the daily reset. Public pages can still load their bundled menu snapshot, which may be older than the latest owner edits. Login, publishing and uncached uploaded photos can be unavailable. Free-tier CPU or storage limits can also reject individual operations. The free plan is not unlimited and has no paid uptime guarantee.

Keep Workers on **Free**; no paid subscription is required. The domain's existing annual registration charge is separate and continues. Monitor Workers requests/CPU, D1 storage and KV usage in Cloudflare. At 250 KB per optimized uploaded image, 1 GB is approximately 4,000 photos; at 1 MB each, approximately 1,000. Removed gallery photos remain in KV for recovery and still count until a maintainer deletes unused objects. Current bundled photos do not consume KV space. KV replication may delay a newly uploaded photo appearing in another location by 60 seconds or more.

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/). Limits can change; check the account dashboard before launch.

## 1. Sign in and create free storage

Create or use a coffee-shop-controlled account at [Cloudflare](https://dash.cloudflare.com/sign-up). Select the Free plan. In PowerShell, from the `la-stazione-live` folder on branch `migration/cloudflare`, run:

```powershell
npm.cmd ci
npx.cmd wrangler login
npx.cmd wrangler whoami
npx.cmd wrangler d1 create la-stazione
npx.cmd wrangler kv namespace create PHOTOS
Copy-Item -LiteralPath wrangler.jsonc -Destination wrangler.production.json
```

Wrangler opens a browser to authorize your account. Save the account ID, D1 database ID and KV namespace ID from the results. If multiple accounts are available, use the same account for both storage resources and the Worker. If those resources already exist, reuse their IDs instead of creating duplicates.

Open `wrangler.production.json` and:

1. Add a top-level `"account_id": "YOUR_32_CHARACTER_ACCOUNT_ID"`.
2. Replace `d1_databases[0].database_id` with the real D1 UUID.
3. Replace `kv_namespaces[0].id` with the real KV namespace ID.
4. Keep `assets`, binding names, migrations and the rest of the configuration as supplied.
5. Leave `vars.GOOGLE_CLIENT_ID` empty until the Google setup below is ready.

This account-specific file is excluded from Git. An account ID is not a password, but OAuth tokens and API tokens must never be committed or put in public files. `npm run deploy:cloudflare` refuses placeholder IDs.

## 2. Copy the live menu, then deploy to a preview address

Avoid owner edits between the final export and domain cutover. Run:

```powershell
npm.cmd run export:netlify
npx.cmd wrangler d1 migrations apply DB --remote --config wrangler.production.json
npm.cmd run import:cloudflare -- --remote
npm.cmd run deploy:cloudflare
```

The export reads the published menu twice to detect simultaneous editing, validates the content and verifies the hashes of any uploaded photos. It stores a timestamped local backup in `.migration-backups/` and updates the public fallback menu. The prepared snapshot contains 103 menu items and no owner-uploaded photos; all existing stock/gallery photos are included in the static deployment.

The import inserts menu content only if the destination does not already contain a menu. It **never replaces existing Cloudflare edits**. If re-running the exact same import after interruption, its chunks can be safely resumed. Always verify the result before changing DNS; if you have already edited the destination, resolve any differences through the owner's import/publish interface rather than overwriting its database. Never switch with an incomplete or mismatched import.

This exports public content and referenced uploaded photos. It does not export private Netlify session/access records or historical/unreferenced photos. Google login has not yet been activated, and no editor access is assumed migrated. The primary owner remains `lastazione10@gmail.com`; re-add any approved editors after activation. Keep the Netlify source available for any further recovery.

Wrangler prints a URL such as `https://la-stazione.YOUR-SUBDOMAIN.workers.dev`. Open it on a phone and check the homepage, menu, photos and `/owner/`. Compare its `/api/content` JSON with the backup, including prices and photo URLs. Old version paths should redirect home; `/.netlify/functions/content` remains a compatibility alias.

To compare the menu automatically:

```powershell
node tools/verify-cloudflare.mjs https://la-stazione.YOUR-SUBDOMAIN.workers.dev
```

## 3. Activate Google owner sign-in

Follow [OWNER-ACCESS.md](OWNER-ACCESS.md). Create a Google OAuth **Web application** client with an External audience and the authorized JavaScript origin `https://lastazionelb.com`. Add `https://www.lastazionelb.com` if that hostname will serve the site. Add the exact `workers.dev` preview origin temporarily if testing login there.

Set `vars.GOOGLE_CLIENT_ID` in `wrangler.production.json` to the client ID ending in `.apps.googleusercontent.com`, then redeploy. No client secret or redirect URI is required for this JavaScript callback flow.

Sign in as `lastazione10@gmail.com`. Test a price edit and photo upload on the preview, restore any test content, then use **Who can edit** to approve other Google emails. Confirm an editor cannot manage access and is denied after revocation. Each origin uses separate secure session cookies, so sign in again after switching to the main domain.

## 4. Move the domain after preview verification

Workers Custom Domains require an active Cloudflare DNS zone. This step needs access to the account where `lastazionelb.com` is registered; it does not require transferring or purchasing the domain.

1. Add `lastazionelb.com` to Cloudflare and choose **Free**.
2. Export or record the current DNS configuration. Review Cloudflare's imported DNS records, including MX and email-related TXT records (SPF/DKIM/DMARC), verification records and subdomains. Keep the current Netlify website targets during nameserver propagation. Do not guess or remove mail records.
3. Follow Cloudflare's nameserver instructions at the registrar. If DNSSEC is already enabled, follow the provider's DNSSEC migration instructions so the old DS record does not invalidate the new DNS zone. Wait until Cloudflare shows the zone as Active and verify the existing site/email DNS still resolve.
4. In **Workers & Pages → la-stazione → Settings → Domains & Routes → Add → Custom Domain**, attach `lastazionelb.com`. Attach `www.lastazionelb.com` too if used. Resolve only conflicting website A/AAAA/CNAME records; Cloudflare cannot attach a Custom Domain over an existing CNAME. Keep the recorded Netlify values for rollback. Cloudflare provisions the website DNS and HTTPS certificate.
5. Add the same custom domains to `wrangler.production.json` so later CLI deployments preserve them:

```json
"routes": [
  {"pattern": "lastazionelb.com", "custom_domain": true},
  {"pattern": "www.lastazionelb.com", "custom_domain": true}
]
```

6. Run the verifier against `https://lastazionelb.com`, open `/menu/` from a printed QR code and test real owner Google sign-in. Keep the Netlify site available until the new host and DNS are verified on multiple networks. Then disable its automatic Git deployments to stop using Netlify for future releases.

Official guidance: [Cloudflare full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/), [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Future updates and recovery

Owner menu/photo changes go directly to Cloudflare storage and need no code deployment. For website code updates, run `npm run deploy:cloudflare` after tests. Initially deploy manually; do not connect a Git deployment with the default Netlify `npm run build` settings. A later Cloudflare Git integration should use the Cloudflare build and deploy commands with its configured bindings.

D1 keeps the current menu and a 30-day recovery history. Hourly cleanup removes up to 500 expired records, including expired sessions and consumed login nonces, with their chunks. The owner can also export a menu backup. D1's Free Time Travel window is seven days; recovery history is not a substitute for independent backups. KV photos require their own backup if needed.

To roll back immediately, detach the Worker Custom Domains and restore the recorded Netlify website DNS targets. Do not change nameservers again unnecessarily or delete Cloudflare storage. If the owner edited content on Cloudflare after cutover, export those changes and reconcile them before returning editing to Netlify; the two stores do not synchronize automatically.

## Local verification

```powershell
npm.cmd run build:cloudflare
npx.cmd wrangler d1 migrations apply DB --local
npm.cmd run import:cloudflare
npm.cmd run dev:cloudflare
```

Open `http://localhost:8787/`. Local storage is isolated under `.wrangler/`; these commands do not publish online. Run `npm test` for the content/auth tests plus Cloudflare D1/KV/runtime integration tests. Google verification tests use local signing keys and isolated fixtures; production has no test-login endpoint. A real Google login and Cloudflare production CPU/traffic behavior require verification after account activation.
