# La Stazione Live Website

This is the deployment repository for [lastazionelb.com](https://lastazionelb.com/).
It contains the public website, menu, owner workspace, and shared-content functions. Pushes to `main` deploy
automatically through Netlify.

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
