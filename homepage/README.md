# Homepage (approved NEXUS Research design)

The site's homepage (`docs/index.html` and `docs/assets/home/`) is built from this folder by the main
build, `node scripts/build.mjs`. The other pages (products, about, contact, policies) are still built from
`data/` and `src/pages/` as before.

| File | What it is |
| --- | --- |
| `content/current-tests.json` | **The Current Tests cards.** Add, remove or replace tests here; the homepage layout stays the same. Never add customers, results, testimonials or guarantees without evidence (the checks refuse common wording). |
| `content/links.json` | Every homepage link. `production` is the link used on the live site; `href` is used in review previews. |
| `src/index.html` | Homepage text and structure (approved copy). |
| `src/assets/` | Homepage stylesheet, menu script, logo, hero artwork. Published under `assets/home/`. |
| `LINKS.md` | Generated list of every link, button and CTA with its destination. |

Preview and test the homepage on its own (from this folder):

```
node scripts/build.mjs               # review preview into homepage/dist/ (with "Review preview" bar)
node scripts/build.mjs --production  # the live version into homepage/dist/
node scripts/check.mjs               # links, headings, approved copy, no unsupported claims
node scripts/qa.mjs                  # browser checks at 8 screen widths (needs Playwright)
```

Editing anything in this folder on github.com triggers the **Rebuild site** action, which rebuilds and
publishes the whole site, the same as editing `data/` or `src/`.

Went live 2026-11-05 with the owner's approval. The previous homepage is in git history
(commit e61c279, `src/pages/home.html`) and can be restored.
