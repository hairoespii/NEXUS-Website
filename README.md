# NEXUS Research website — new homepage (staging)

The approved NEXUS Research homepage design (desktop and mobile previews, 2026-11-03), built as a
working static website. **This is a staging/preview build. It is not live and does not replace
nexusresearchnx.com.**

## Where things stand

| | |
| --- | --- |
| Status | Staging build complete and tested. Not published. |
| Live website | https://nexusresearchnx.com — unchanged. Its source is the branch `ccr-7b44bd0d-q5fvks` of this same repository (`docs/` folder; that branch holds the `CNAME` file for the domain), so it is almost certainly the branch GitHub Pages publishes. **Do not touch that branch** unless the owner approves going live. |
| This build | Branch `claude/laughing-ride-owes3a`. It has no GitHub Actions workflow and no `docs/` folder, so pushing it cannot change the live site. |
| Staging preview | Private page: https://claude.ai/artifact/PM1EJ2SfWTDk5okyg5HKmh (only the owner can open it unless shared). Built from this branch. |
| Design source | Google Drive: `NEXUS_Research_Desktop_Preview.png` and `NEXUS_Research_Mobile_Preview.png` (2026-11-03). |
| Link map | [LINKS.md](LINKS.md): every link, button and CTA with its destination and status. |

## Tech stack (kept deliberately simple)

Plain HTML + CSS + one small JavaScript file (mobile menu only). A small Node.js script (no packages to
install) builds the page into `dist/`. Any free static host can serve `dist/`.

| Folder / file | What it is |
| --- | --- |
| `content/current-tests.json` | **The Current Tests cards.** Change tests here; the homepage layout stays the same. |
| `content/links.json` | Every link destination, with its status. The build refuses links that are not listed here. |
| `src/index.html` | The homepage text and structure (approved copy). |
| `src/assets/` | Stylesheet, menu script, logo, hero artwork (WebP + JPEG fallback). |
| `scripts/build.mjs` | Builds `dist/` and regenerates `LINKS.md`. `--production` drops the review-preview notes and the "noindex" tag. |
| `scripts/check.mjs` | Static checks: links, headings, image text, approved copy, design corrections, no unsupported claims. |
| `scripts/qa.mjs` | Browser checks at 8 screen widths (Playwright): sideways scrolling, overflow, clipped text, mobile menu, keyboard, contrast, console errors. |
| `scripts/serve.mjs` | Local preview at http://localhost:8000/ |

```
node scripts/build.mjs      # build the staging preview into dist/
node scripts/check.mjs      # static checks
node scripts/qa.mjs         # browser checks + screenshots (needs Playwright)
node scripts/serve.mjs      # preview locally
```

## Changing the Current Tests

The homepage is not built around any one test. Each entry in `content/current-tests.json` becomes one
card. To replace the Amazon test with a future test, edit that entry (or add a second one):

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Short unique name, lowercase with dashes. |
| `title` | yes | Test name shown on the card. |
| `summary` | yes | One sentence describing the test. |
| `label` | | Small badge, default "Current test". |
| `icon` | | `"box"` or leave out. |
| `price.amount`, `price.note` | | e.g. `"$29"`, `"Test offer"`. Leave `price` out if there is none. |
| `cta.label`, `cta.link` | | Button text, and the name of a destination in `content/links.json` (add it there first). |
| `disclaimer` | | Small print for this test (shown at full contrast). |

With no tests listed, the section says new tests are being prepared. The checks fail the build if a
test claims customers, results, testimonials, guarantees, or Amazon affiliation.

## Owner decisions still open

See the **PLACEHOLDER / NEEDS CONFIRMATION** rows in [LINKS.md](LINKS.md) (header "Explore Our Work"
button and "About"). Both work today; they only need a yes or a different destination.

## Going live later (owner approval required)

Not done, and not to be done without the owner's explicit approval. When approved, the simplest path is
to build with `node scripts/build.mjs --production` and publish `dist/` in place of the current site's
files on the branch GitHub Pages publishes from. No DNS change is needed for that. The previous site
stays in git history on `ccr-7b44bd0d-q5fvks`, so it can be restored at any time.
