# La Stazione · version 4

The new homepage lives at `/redesign_v4/`. The original homepage and versions 1–3 are preserved byte for byte. A permanent `/menu/` address is intended for printed QR codes; SVG and 1600 px PNG copies are available in that directory.

The first photo arrangement now supports native touch swiping, arrow keys and previous/next controls. It loops in both directions without changing its center-photo and tilted-neighbor composition. The owner can change its complete collection. The rotating illustration has a separate original ink sheet: iced matcha, Lebanese coffee pot, baguette sandwich and chocolate cake.

Safari restoration tears down and safely restores animation state on visibility/page lifecycle changes, then resumes only eligible scenes. It does not force-complete every nested GSAP entrance tween. Hero content remains fully opaque after restoration. Motion pause and system reduced-motion settings continue to work.

## Content editing

`/owner/` edits the menu title/introduction, groups, categories, items, descriptions, availability, featured picks, options, multiple USD/LBP prices, extras and both photo collections. Drafts remain in the browser until Publish. Photo uploads are decoded and optimized to at most 2000 px before upload. Collections have no fixed photo-count limit; the API has a practical 3 MB content payload limit and 4 MB per-upload limit.

Temporary owner access intentionally has no sign-in, as requested. Anyone who reaches the owner page can publish until company email authentication is added. The page is excluded from indexing and is not linked from the customer site. Same-origin write checks prevent cross-site browser submissions; they are not authentication. Future sign-in must protect both function write endpoints, not only the page.

Netlify Functions use the site-wide `la-stazione-v4` Netlify Blobs store, so published edits and uploaded photos persist across devices and deployments. The original menu data and earlier redesigns do not read this store. Content writes use ETag-based conditional updates to reject stale drafts; previous published content is retained under history keys for recovery. Removing a photo removes its gallery reference; original and uploaded image files are retained for recovery and existing links.

The public client reads shared content, with a checked-in menu snapshot as an outage fallback. The owner page reports connection failures and keeps unpublished drafts. `public/site-content/default.json` starts with all 103 original items and 168 original price variants.

## Local operation

Run `npm ci`, then `npm run dev` in the deployment repository. Open `http://localhost:8888/redesign_v4/`, `/menu/` or `/owner/`. The development server uses the same request handler and a disk store in ignored `.local-data/`; it is separate from production data. `npm test` covers validation, persisted reads, concurrent writes, stale edits, cross-site requests and image uploads.

Netlify automatically installs dependencies and bundles `netlify/functions`. No browser credential or private key is embedded in public files. Backend documentation used: https://docs.netlify.com/build/data-and-storage/netlify-blobs/ and https://docs.netlify.com/build/functions/api/.
