# La Stazione Live Website

This is the deployment repository for [lastazionelb.com](https://lastazionelb.com/).
It contains the public website, menu, owner workspace, and shared-content functions. Pushes to `main` deploy
automatically through Netlify.

**Production moved to Cloudflare Free on 14 September 2026.** Both the bare and `www` domains point to the Worker. The deployment code is on `migration/cloudflare`; use `npm run deploy:cloudflare` with the account-specific `wrangler.production.json` for updates. The historical `main` branch's Netlify integration remains a backup, not the current production release mechanism. See [CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md) and [verification notes](cloudflare/VERIFICATION.md). The Cloudflare local preview uses `npm run dev:cloudflare` after local storage initialization.

The private `la-stazione-website` repository contains the complete source
archive, original media, spreadsheets, and maintenance tools.

## Local preview

```powershell
npm install
npm run dev
```

Open `http://localhost:8888/`. The permanent printable menu is `/menu/` and
the owner workspace is `/owner/`. The approved beige V6 design is the homepage;
its assets now use `/assets/site/`. Retired preview URLs redirect to the homepage.
Earlier saved photo URLs continue to resolve without changing published content.

The owner workspace requires Google sign-in. Only `lastazione10@gmail.com` can grant or remove editor access. See [OWNER-ACCESS.md](OWNER-ACCESS.md) for the one-time Google client configuration; the editor and backend writes remain locked until it is completed. See [HOSTING.md](HOSTING.md) for the free hosting assessment and [LAUNCH.md](LAUNCH.md) for promotion notes.

Large videos use Git LFS, so run `git lfs install` before cloning.
