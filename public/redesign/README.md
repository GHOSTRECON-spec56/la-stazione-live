# La Stazione redesign

Independent static preview at `/redesign/`. Existing production files remain unchanged.

`index.html`, `style.css`, and `app.js` provide the page. `menu.js` and `menu.css` implement the full accessible menu, reusing `../menu-data.js`. Gallery lightboxes load full-resolution originals from `../gallery/` on demand. `photos/` contains responsive copies of supplied café images, with provenance in `photos/SOURCE.md`. `fonts/` contains local variable fonts and their licenses. `vendor/` contains GSAP and ScrollTrigger with upstream license headers intact.

Run the parent `public` directory with any static HTTP server and open `/redesign/`. No build required.
