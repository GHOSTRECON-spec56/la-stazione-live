# Migration verification — 14 September 2026

Status: implemented and tested locally; Cloudflare account provisioning, real Google sign-in and DNS cutover remain pending.

- `npm test`: **22 passing tests**, including real workerd/D1/KV integration. Checks cover concurrent menu writes, large Unicode records, transaction rollback, repeatable initial import, owner/editor permissions and revocation, image storage/delivery, expiry cleanup and cryptographic Google token validation.
- `wrangler deploy --dry-run`: succeeds; Worker bundle approximately **21 KiB gzipped**. Dry-run does not create a deployment or verify production CPU consumption.
- `tools/verify-cloudflare.mjs`: local published content exactly matches the exported live snapshot. All **103 items**, prices and photo selections are preserved. Public pages, QR SVG, owner security headers, anonymous access rejection and retired-version redirects pass.
- Browser smoke checks: **9 page/viewport checks** across Chrome mobile/desktop and WebKit mobile. Homepage, menu and locked owner page load without JavaScript exceptions or horizontal overflow. Visible hero photographs load. Screenshots are retained in the local workspace's `docs/qa/` directory.
- Final homepage HTML, design styles/scripts, owner UI and QR menu assets have no source changes. The Cloudflare build substitutes host-neutral API URLs in generated JavaScript and retains the legacy API aliases.
- A read-only, timestamped content export is stored locally in `.migration-backups/`; no owner-uploaded photos were referenced by the live snapshot. The existing gallery photos are bundled static assets.
- The live GitHub `main` branch remains at the Netlify launch commit `954611a`; migration work is isolated on `migration/cloudflare`.
- Wrangler reports **not authenticated**. The domain still uses `dns1.registrar-servers.com` / `dns2.registrar-servers.com`. No hosting account, nameserver, domain record or production data was changed by this preparation.

Use [CLOUDFLARE-MIGRATION.md](../CLOUDFLARE-MIGRATION.md) for the remaining account-controlled steps. Production deployment, external Google authentication, email/DNS continuity and the custom domain must be verified after account activation; local tests do not establish those outcomes.
