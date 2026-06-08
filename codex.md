# Codex Notes for `sefb_site_2`

`sefb_site_2` is the experimental UI copy of the SEFB Degree Planner.

The original `sefb_site` folder is kept as the safer fallback version. Changes in this folder are for testing cleaner UI, layout, and interaction improvements before deciding whether anything should be copied back.

## Current Focus

- Keep `sefb_site_2` as the active GitHub Pages version of the SEFB Degree Planner.
- Improve UI clarity without changing the curriculum engine unless a visible bug requires it.
- Keep the coffee-themed academic style, with cleaner planner layout and mobile-friendly navigation.
- Keep the Planner usable for real student workflows: programme choice, semester planning, grades, retake handling, and graduation readiness.

## Recent Changes

- Published to GitHub Pages:
  `https://mukhrizizraf.github.io/sefb_planner_codex/`
- Homepage hero uses `assets/img/dms.jpeg`.
- Graduation Checklist hero uses `assets/img/convocation.jpg`.
- Homepage advising image uses `assets/img/library.jpg`.
- Refreshed Help guide screenshots.
- Added the `Take Note` issue panel to the Planner page only, placed between the course grouping chips and Semester 1.
- `Take Note` starts muted by default on every page load.
- `Take Note` now only shows current high-signal issues:
  failed or unresolved retake papers, courses locked because a prerequisite failed, and semesters over the credit maximum.
- Removed noisy `Take Note` items for grade missing, minimum-credit locks, under-filled semesters, and "finish other courses first".
- Fixed retake prerequisite logic so a later passed retake unlocks dependent courses.
- Fixed old failed attempts so they no longer stay in `Take Note` after the course is retaken and passed later.
- Graduation credit progress now uses passed-credit-only helpers: failed attempts and duplicate retakes do not inflate the credit hours required for graduation, while GPA/CGPA still includes graded failed attempts.
- Current JavaScript cache version: `app.js?v=20260608b`.
- Current stylesheet cache version: `styles.css?v=20260608b`.

## Verification

The JavaScript syntax check passed for:

- `assets/js/app.js`
- `assets/js/sefb-data.js`

Recent browser checks were done with Playwright screenshots for:

- Planner `Take Note` default-muted state.
- Retake cleared after a later passed attempt.
- Minimum-credit and grade-missing messages filtered out of `Take Note`.
- Planner mobile layout with the `Take Note` panel.

## Notes

- Do not create `_github_upload_*` folders for deployment.
- If Git is needed for upload, initialize it temporarily inside `sefb_site_2`, push, then delete `.git` immediately after upload.
- Do not stage Windows `desktop.ini` files.
- `sefb_site` remains the older fallback version.
