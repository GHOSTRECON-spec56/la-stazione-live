# Migration verification — 14 September 2026

Status: deployed to Cloudflare Free on 14 September 2026. Both `lastazionelb.com` and `www.lastazionelb.com` are attached as Worker Custom Domains. Cloudflare reports the DNS zone Active. Deployment version: `1086da33-74f6-4332-8905-56fdffcffb63`.

Production checks passed against both domains using the new public Cloudflare IP while the local DNS cache still pointed to Netlify. HTTPS certificate validation remained enabled. The verifier confirmed the exact exported menu, all 103 items and photo selections, QR asset, owner security headers, anonymous access rejection and retired-version redirects. Chrome mobile loaded the homepage, menu and owner page on both domains from Cloudflare with connected storage.

Google Client ID is configured in the account-specific deployment file. The Google button loads on both domains, but Google's client-origin check currently rejects `https://lastazionelb.com` and accepts `https://www.lastazionelb.com`. Add the bare origin to the Google client's Authorized JavaScript origins. A real owner-account login and publishing session still require an interactive Google sign-in; no successful user login is claimed by these checks.

- `npm test`: **22 passing tests**, including real workerd/D1/KV integration. Checks cover concurrent menu writes, large Unicode records, transaction rollback, repeatable initial import, owner/editor permissions and revocation, image storage/delivery, expiry cleanup and cryptographic Google token validation.
- `wrangler deploy --dry-run`: succeeds; Worker bundle approximately **21 KiB gzipped**. Dry-run does not create a deployment or verify production CPU consumption.
- `tools/verify-cloudflare.mjs`: local published content exactly matches the exported live snapshot. All **103 items**, prices and photo selections are preserved. Public pages, QR SVG, owner security headers, anonymous access rejection and retired-version redirects pass.
- Browser smoke checks: **9 page/viewport checks** across Chrome mobile/desktop and WebKit mobile. Homepage, menu and locked owner page load without JavaScript exceptions or horizontal overflow. Visible hero photographs load. Screenshots are retained in the local workspace's `docs/qa/` directory.
- Final homepage HTML, design styles/scripts, owner UI and QR menu assets have no source changes. The Cloudflare build substitutes host-neutral API URLs in generated JavaScript and retains the legacy API aliases.
- A read-only, timestamped content export is stored locally in `.migration-backups/`; no owner-uploaded photos were referenced by the live snapshot. The existing gallery photos are bundled static assets.
- The live GitHub `main` branch remains at the Netlify launch commit `954611a`; migration work is isolated on `migration/cloudflare`.
- Wrangler is authenticated to the coffee shop's Cloudflare account. The registry uses `jermaine.ns.cloudflare.com` and `jessica.ns.cloudflare.com`. The owner replaced the Namecheap nameservers and removed the old website A/CNAME records; Wrangler then attached both Custom Domains. The Netlify project remains available as a backup.

Use [CLOUDFLARE-MIGRATION.md](../CLOUDFLARE-MIGRATION.md) for deployment and recovery instructions. Email forwarding has not been tested; the existing MX/TXT records were retained by the owner. Real Google account login remains an interactive verification step.
