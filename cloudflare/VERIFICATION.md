# Migration verification — 14 September 2026

Status: deployed to Cloudflare Free on 14 September 2026. Both `lastazionelb.com` and `www.lastazionelb.com` are attached as Worker Custom Domains. Cloudflare reports the DNS zone Active. Deployment version: `1086da33-74f6-4332-8905-56fdffcffb63`.

Production checks passed against both domains using the new public Cloudflare IP while the local DNS cache still pointed to Netlify. HTTPS certificate validation remained enabled. The verifier confirmed the exact exported menu, all 103 items and photo selections, QR asset, owner security headers, anonymous access rejection and retired-version redirects. Chrome mobile loaded the homepage, menu and owner page on both domains from Cloudflare with connected storage.

Google Client ID is configured in the account-specific deployment file. After the owner saved the authorized-origin setting, fresh Chrome checks loaded the Google button on both domains without any GSI origin errors. A real owner-account login and publishing session still require an interactive Google sign-in; no successful user login is claimed by these checks.

- `npm test`: **22 passing tests**, including real workerd/D1/KV integration. Checks cover concurrent menu writes, large Unicode records, transaction rollback, repeatable initial import, owner/editor permissions and revocation, image storage/delivery, expiry cleanup and cryptographic Google token validation.
- `wrangler deploy --dry-run`: succeeds; Worker bundle approximately **21 KiB gzipped**. Dry-run does not create a deployment or verify production CPU consumption.
- `tools/verify-cloudflare.mjs`: local published content exactly matches the exported live snapshot. All **103 items**, prices and photo selections are preserved. Public pages, QR SVG, owner security headers, anonymous access rejection and retired-version redirects pass.
- Browser smoke checks: **9 page/viewport checks** across Chrome mobile/desktop and WebKit mobile. Homepage, menu and locked owner page load without JavaScript exceptions or horizontal overflow. Visible hero photographs load. Screenshots are retained in the local workspace's `docs/qa/` directory.
- Final homepage HTML, design styles/scripts, owner UI and QR menu assets have no source changes. The Cloudflare build substitutes host-neutral API URLs in generated JavaScript and retains the legacy API aliases.
- A read-only, timestamped content export is stored locally in `.migration-backups/`; no owner-uploaded photos were referenced by the live snapshot. The existing gallery photos are bundled static assets.
- The live GitHub `main` branch remains at the Netlify launch commit `954611a`; migration work is isolated on `migration/cloudflare`.
- Wrangler is authenticated to the coffee shop's Cloudflare account. The registry uses `jermaine.ns.cloudflare.com` and `jessica.ns.cloudflare.com`. The owner replaced the Namecheap nameservers and removed the old website A/CNAME records; Wrangler then attached both Custom Domains. The Netlify project remains available as a backup.

Use [CLOUDFLARE-MIGRATION.md](../CLOUDFLARE-MIGRATION.md) for deployment and recovery instructions. Email forwarding has not been tested; the existing MX/TXT records were retained by the owner. Real Google account login remains an interactive verification step.

## Standard Google sign-in ? 14 September 2026

Deployed version `f4600209-c004-4f6e-804f-55d35f1756b9` restores the official Google button. There is no website email form or login hint; popup UX is explicit, FedCM button auto-selection and One Tap auto-selection are disabled. A real signed-out browser opened accounts.google.com from the production domain successfully. Actual multi-account selection and completed owner sign-in require the user?s Google session and were not simulated as live success. Mobile and desktop browser fixtures verify denied accounts leave the workspace locked and the Google button available for another attempt. All 22 security/content tests passed.

The production content verifier passed through the Cloudflare IP with normal certificate validation: exact exported menu and photo selections, pages, QR asset, owner headers and anonymous rejection. The build no longer reads netlify.toml or needs Netlify Functions. Old saved photo paths are handled locally by the Cloudflare Worker for compatibility, without contacting Netlify.
