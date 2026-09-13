# Optimized La Stazione assets

Generated from existing, supplied repository assets on 13 September 2026. All source files remain unchanged. These are resolution and encoding derivatives of the café's own assets; no new photography, cropping, compositing, retouching, or generated imagery was introduced.

## Source mapping

| Output | Supplied source | Original photo filename recorded by the site's preparation script |
| --- | --- | --- |
| `gallery-07-640.webp`, `gallery-07-1000.webp` | `public/gallery/gallery-07.webp` | `IMG_3041.JPG` |
| `gallery-08-640.webp`, `gallery-08-1000.webp` | `public/gallery/gallery-08.webp` | `IMG_3042.JPG` |
| `gallery-09-640.webp`, `gallery-09-1000.webp` | `public/gallery/gallery-09.webp` | `IMG_3043.JPG` |
| `gallery-15-640.webp`, `gallery-15-1000.webp` | `public/gallery/gallery-15.webp` | `IMG_4440.jpeg` |
| `gallery-16-640.webp`, `gallery-16-1000.webp` | `public/gallery/gallery-16.webp` | `IMG_4473.jpeg` |
| `gallery-17-640.webp`, `gallery-17-1000.webp` | `public/gallery/gallery-17.webp` | `IMG_4547.jpeg` |
| `gallery-20-640.webp`, `gallery-20-1000.webp` | `public/gallery/gallery-20.webp` | `IMG_4569.jpeg` |
| `logo-160.webp` | `public/brand-logo.jpg` | Existing supplied brand logo |
| `illy-100.webp` | `public/logo-illy.png` | Existing supplied partner logo |
| `marzocco-320.webp` | `public/logo-la-marzocco.png` | Existing supplied partner logo; transparency retained |

Original photo filenames are recorded in `la-stazione-website/tools/prepare_gallery_assets.py`. This optimization uses the checked-out WebP files, not that script's external original-photo directory.

## Reproduction

FFmpeg with libwebp; requested width, proportionally calculated height rounded to an integer, Lanczos resampling, quality 80, compression level 6, photo preset:

```text
ffmpeg -hide_banner -loglevel error -y -i SOURCE -vf "scale=WIDTH:-1:flags=lanczos" -frames:v 1 -c:v libwebp -quality 80 -compression_level 6 -preset photo OUTPUT
```

Width is 640 or 1000 for gallery photographs, 160 for the shop logo, 100 for illy, and 320 for La Marzocco. Square photographs remain square. Portrait variants are 640 × 853 or 1000 × 1333. All 17 files were opened with an image decoder and their output dimensions verified.

## Size totals

- Ten unique original assets: **1,145,022 bytes**.
- All seventeen optimized output files: **825,454 bytes**.
- Seven 640-pixel gallery variants plus three logos: **294,246 bytes** (74.3% smaller than the source set).
- Seven 1000-pixel gallery variants plus three logos: **544,678 bytes** (52.4% smaller than the source set).

These are alternative responsive sources: the browser should download an appropriate width for each image, not both variants.
