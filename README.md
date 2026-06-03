# SEFB Degree Planner

Static multi-page redesign of the SEFB Degree Planner for GitHub Pages.

## Upload To GitHub Pages

1. Create a GitHub repository, for example `sefb-degree-planner`.
2. Upload everything inside this `sefb_site` folder to the repository root.
3. Confirm the repository root contains `index.html`, `planner.html`, `audit.html`, `analytics.html`, `courses.html`, `profile.html`, `.nojekyll`, and the `assets` folder.
4. Open the repository on GitHub, then go to `Settings` > `Pages`.
5. Set `Source` to `Deploy from a branch`.
6. Select the `main` branch and `/ (root)`, then save.
7. Share the GitHub Pages link with students after GitHub finishes deploying.

The link will usually look like:

```text
https://YOUR-USERNAME.github.io/sefb-degree-planner/
```

## Pages

- `index.html` - academic overview
- `planner.html` - semester planning
- `audit.html` - graduation checklist and alerts
- `analytics.html` - CGPA simulation and credit progress
- `courses.html` - searchable course list
- `profile.html` - storage and plan settings
- `help.html` - student usage guide

## Notes For Students

- The planner stores data in the student's own browser using `localStorage`.
- No login or backend server is required.
- If a student changes browser/device, their saved plan will not automatically follow them.
- Students can download a backup file from the Profile page.
