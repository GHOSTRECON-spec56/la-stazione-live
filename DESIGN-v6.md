# La Stazione V6 — beige-led palette

The existing composition, typography, spacing, artwork, photographs and motion remain intact. This revision answers the request for more beige and a more coherent color family: cream and sand now cover the major surfaces, with warm brown type and actions. The original logo retains its colors.

| Role | Color |
| --- | --- |
| Main cream | `#f7efdf` |
| Menu sand | `#eadbc3` |
| Coffee ribbon | `#dec8a7` |
| Location beige | `#e7d5b8` |
| Primary text | `#3b3028` |
| Heading accent | `#4b392d` |
| Secondary text | `#695746` |
| Action / hover | `#70513b` / `#583e2b` |
| Input boundary | `#8a7560` |

Large green panels and red-filled actions now use this tonal palette. Decorative ink strokes are warmed with a static filter; the logo and photographs are not filtered. There is no added texture or aging effect.

Secondary text contrast is 6.02:1 on cream, 5.05:1 on menu sand, and 4.79:1 on the location beige. The ribbon uses darker primary ink. Cream button labels contrast 6.27:1 on normal actions and 8.59:1 on hover. Input boundaries exceed 3:1 against their surrounding surfaces.

V6 lives at `/redesign_v6/`. The permanent `/menu/` and `/owner/` pages share the palette. Saved menu data, photo collections, API/storage behavior, QR destinations, the original homepage, and V1–V5 files are preserved.

## Verification

Browser checks passed at 1440, 390 and 320 pixels: V5/V6 layout geometry is identical, all three pages fit the viewport, and nine axe WCAG AA scans report no violations. The menu still renders 103 items; the owner workspace loads published content without unsaved changes. No JavaScript errors were recorded. WebKit lifecycle checks restore sampled hero opacity to 1 after resume; this is browser-engine coverage, not a physical iPhone test.

The Impeccable detector was reviewed once. Its inherited warnings concern the hidden lightbox image populated on open, small brand/decorative text, full-width sections and the existing visual language. Those are outside this palette-only revision. The beige direction follows the explicit user preference.

Both deployment and private-source builds pass. JavaScript, media, shared content and previous version files were verified unchanged. Browser reports and screenshots are archived in the private source repository under `docs/redesign-v6/`.
