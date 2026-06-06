# Codex Notes for `sefb_site_2`

`sefb_site_2` is the experimental UI copy of the SEFB Degree Planner.

The original `sefb_site` folder is kept as the safer fallback version. Changes in this folder are for testing cleaner UI, layout, and interaction improvements before deciding whether anything should be copied back.

## Current Focus

- Improve the Planner page visual quality without changing curriculum logic.
- Keep the coffee-themed academic style, but make it cleaner and more professional.
- Reduce heavy boxes, noisy colors, and inconsistent dark-mode surfaces.
- Keep course planning functional for student use.

## Recent Changes

- Added a second Planner visual reset in `assets/css/styles.css`.
- Refined the programme setup panel with softer coffee shading.
- Made the degree title area smaller and more structured.
- Simplified category chips into calmer pill-style labels.
- Slimmed semester cards and course rows.
- Improved light and dark mode consistency.
- Bumped HTML cache version to `v=20260606f`.

## Verification

The JavaScript syntax check passed for:

- `assets/js/app.js`
- `assets/js/sefb-data.js`

## Notes

- `sefb_site_2` is not the source of truth yet.
- Do not copy changes back to `sefb_site` until the visual direction is approved.
- If the UI becomes worse, keep using `sefb_site` and discard or revise this folder.
