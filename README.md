# La Stazione Live Website

This is the deployment repository for [lastazionelb.com](https://lastazionelb.com/).
It contains only customer-facing website files. Pushes to `main` deploy
automatically through Netlify.

The private `la-stazione-website` repository contains the complete source
archive, original media, spreadsheets, and maintenance tools.

## Local preview

```powershell
cd public
py -m http.server 8000
```

Open `http://localhost:8000/index.html`.

Large videos use Git LFS, so run `git lfs install` before cloning.
