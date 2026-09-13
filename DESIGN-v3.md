# La Stazione v3: an illustrated café poster

Reading this as a neighborhood café website for guests on their phones, with original ink illustrations, confident typography and playful physical movement. The user explicitly chose Chun for illustration style and Sunbeam for animation, while keeping La Stazione's own identity. Those references govern this version; earlier routes remain intact.

## Reference evidence

[Chun Café](https://www.chun-amsterdam.com/) was inspected in a live desktop browser. Its opening composition places a large wordmark among irregular single-ink food drawings, then moves into spare editorial type and venue information. The adaptation keeps its drawing-led composition, visual breathing room and oversized brand presence. La Stazione uses newly generated original coffee, pastry, chess and sun illustrations; no Chun images, lettering, characters or source code are shipped. Captures and asset observations are under `docs/qa/v3-reference-chun-*`.

[Sunbeam Bagels](https://sunbeambagels.com/) was inspected in a live browser, including its timed food wheel, photograph motion, pointer previews and optional bagel-drop toy. Its food wheel changes position every two seconds. V3 adapts that physical playfulness into a slower 4.5-second illustrated wheel, a native-scroll photo spread and an optional seven-piece coffee-break toss. Actual menu prices and results remain steady. Detailed measurements and evidence are in `docs/v3-sunbeam-research.md`.

## Direction and composition

Seven grounded structures considered: café sketchbook, espresso-counter lettering, terrace journal, chess-club noticeboard, illustrated gathering poster, rotating counter display, and a handwritten menu folio. Impeccable direction seed `1f44bca8` assigned the fifth structure: the illustrated gathering poster. The user's pinned references remain authoritative. The convention catalog's tiny cell density would make menu browsing harder; the Push Pin poster's warm illustrative hierarchy is competitive and raises the chosen poster's type scale; terminal, ceramic process and astronomical metaphors lack a direct café connection. Their useful disciplines are consistent navigation, finite motion states and bounded interaction, without adopting their materials.

The first viewport makes the proper-case **La Stazione** name unmistakable, with four ink vignettes, a short coffee-and-company promise and working menu/directions actions. Three genuine venue photographs introduce the café's terrace, cappuccino and chess. A green moving ribbon leads to a short welcome, the complete existing menu, an illustrated wheel, the actual photo gallery and an embedded Google Map beside hours and contact details.

The open-space poster is the signature; lower sections prioritize reading and actions. There are no fictional products, testimonials, ordering flows or business claims. Illustrations depict familiar café objects and never masquerade as photographs of the premises.

## Tokens and mechanics

- Forest green `#245747`, dark green `#19352b`, clean off-white `#f6f8f3`, sage `#e4eddf`, secondary green `#52675a`. The supplied raster logo retains its original red.
- Self-hosted Fraunces for expressive brand/display type, DM Sans for body and controls. Large brand type follows the user's Chun reference; body and price information remain plainly readable.
- Simple 5px action corners, 7–10px image/map corners, no card grid, no texture overlay. Original pen marks supply texture.
- Native page scrolling. On mobile the drawings move to clear corners, photos use deliberate edge crops, menu rows become a single column, and the map stacks below the address.
- GSAP controls the entrance and small scroll spread; the illustrated wheel and bounded toss use the Web Animations API. Rotating art stays upright. Loops stop offscreen and when the document is hidden; pause and reduced motion restore authored visible styles. Keyboard actions remain immediate.

## Assets and provenance

`public/redesign_v3/art/cafe-illustrations.webp` is a delivery encoding of the original imagegen-produced transparent sheet. The original PNG and exact prompt are preserved in `docs/generated/` and `docs/v3-artwork.md`. The runtime sheet is 1254 × 1254, 460,716 bytes, with preserved alpha. Existing optimized photographs, fonts and GSAP are copied locally into the version.

## Version preservation

- `/redesign_v1/`: initial completed design, snapshot `d4fc2eb`.
- `/redesign_v2/`: forest-green, motion and Google Maps revision, snapshot `1181122`.
- `/redesign_v3/`: this illustration and motion version.
- `/redesign/`: preserved at the existing v2 design.
- `/`: original public homepage, unchanged.

Archive contents match their snapshots except the Open Graph URL identifies each numbered route. All versions share the existing live menu data and full-size gallery files. The private source exporter discovers numbered version directories, so subsequent exports retain every version.

## Verification

Motion-specific checks are in `docs/qa/v3-motion-report.json`. The full responsive, accessibility and functional report is `docs/qa/v3-report.json`; captures use the `v3-*` prefix. The live publishing check separately fingerprints the original homepage and `/redesign/`, checks all numbered routes and verifies the new interactions.

All 51 browser checks passed, including widths 320, 390, 768, 1024 and 1440, menu/currency/search/empty states, navigation and gallery keyboard controls, real map content, motion pause/resume, particle cleanup, reduced motion, no-JavaScript content and application axe scans. The isolated mobile Lighthouse run scored 99 performance, 100 accessibility and 100 best practices: 2.0-second LCP, zero layout shift and 10ms blocking time. `docs/qa/lighthouse-v3.json` preserves the full measurement.

The detector ran once. Small functional text was raised to 11px; duplicate hero caption cadence was removed. Remaining findings reflect the inherited typeface, explicitly requested and pausable moving ribbon, a light-green-on-forest color pair, nested containers with padded children, and the hidden lightbox image populated when opened. The new original raster illustrations are visibly present rather than approximated with CSS or SVG scenes.
