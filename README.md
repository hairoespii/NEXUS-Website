# NEXUS Research website

The official website of NEXUS Research: what we do, our products, and our policies.

- **Live site:** https://hairoespii.github.io/NEXUS-Website/ (once GitHub Pages is switched on; see below)
- **Contact:** NEXUSResearchNX@gmail.com
- **Hosting:** free. No database, no paid services, nothing to install.
- **Owner to-do list:** [OWNER-REVIEW.md](OWNER-REVIEW.md)

## How the site is put together

| Folder / file | What it is | Edit it? |
| --- | --- | --- |
| `data/products.json` | **Every product.** The Products page, the product list and feature on the home page, and each product's own page are built from this one file. | Yes |
| `data/site.json` | Business name, email, X link, disclaimer, site address, policy draft label, and facts only the owner knows. | Yes |
| `src/pages/` | The words on each page (home, products, about, contact, refund, terms, privacy, 404). | Yes |
| `src/assets/` | Stylesheet, logo icon, share image. | Rarely |
| `scripts/` | The small programs that build, check and preview the site. | No |
| `docs/` | **The finished website** that GitHub Pages publishes. Built automatically. | **Never by hand** |

The build turns `data/` + `src/` into plain HTML pages in `docs/`. It needs only
[Node.js](https://nodejs.org) 18 or newer. There is nothing to install with npm.

```
node scripts/build.mjs     # build the site into docs/
node scripts/check.mjs     # check every link, the footer on every page, the buy links
node scripts/serve.mjs     # preview it at http://localhost:8000/NEXUS-Website/
```

You don't have to run these yourself. When you change `data/` or `src/` on github.com, the
**Rebuild site** action builds the site, checks it and publishes it. To see how it went, open the
**Actions** tab:

- A **green tick** means it's done. The live site shows the change within about 10 minutes (a private
  browser window shows it sooner).
- A **red cross** means it stopped and the live site is unchanged. Click the run, then **rebuild**, then the
  red step (**Build the site** or **Check the site**). The last lines say what to fix, for example
  `data/products.json, product #2 ("..."): "slug" is required...`. GitHub also emails you when a run fails.

## How to add a new product

1. On github.com, check that the branch button above the file list shows the branch the site publishes from
   (normally **main**). Open `data/products.json` and click the pencil icon (**Edit**).
2. Find the product block. It starts with a line that is just `    {` and ends with a line that is just
   `    }`. Copy the whole block.
3. Paste it right after the last product's closing `}`, and put a comma between the two blocks, so it reads
   `},` then `{`. There must be **no** comma after the last product.
4. **Change every line of your copy.** Anything you leave keeps the old product's words, and the build can't
   tell they're wrong. When you're done, search your copy for `Amazon`, `bundle`, `29` and `catalog` to catch
   leftovers. The table below explains every field. Delete any optional field you don't need.
5. Set `"featured": false` in your copy, unless the new product should replace the current one on the home
   page (only one product can be featured).
6. Make sure `buyUrl` is the **new product's own** Stripe payment link. The build refuses two products with
   the same link. No payment link yet? Set `"status": "coming-soon"` and leave `buyUrl` out.
7. Also update `src/pages/refund-policy.html` (its first paragraph names the products it covers). If the new
   product's free sample, delivery or refund rules differ, update `src/pages/refund-policy.html` and sections 5
   to 8 of `src/pages/terms.html` too. Keep the product with slug `amazon-bundle-rule-check`: the Home, About,
   Contact, Terms and Refund pages describe it.
8. Click **Commit changes**. Then watch the **Actions** tab for the green tick (see above).
9. Open the new product's page on your phone and read it top to bottom.

**Rules for typing in `products.json`:** keep the double quotes around text, a comma between items, and no
comma after the last item in a list. Most text can use `**bold**`, `[link text](/refund-policy/)` (a page
on this site), `[link text](https://...)`, and `{{name}}`, `{{email}}` and `{{x}}`. These do **not** work in
`slug`, `name`, `badge`, `price`, `freeOffer`, `buyLabel`, `ctaTitle`, or a section's `title` or `nav`
(`freeSample` takes `{{name}}`, `{{email}}` and `{{x}}`, but not bold or links, except in its `note`).

### What each field does

| Field | Required? | What it is |
| --- | --- | --- |
| `slug` | Yes | The page address, lowercase with dashes. `"shopify-shipping-check"` becomes `/products/shopify-shipping-check/`. Every product needs its own. |
| `name` | Yes | The product name. |
| `status` | | `"available"` (default) or `"coming-soon"` (no buy button). |
| `featured` | | `true` on the one product shown on the home page, `false` on the others. No quotes. |
| `badge` | | Small label above the name, like `"New"`. |
| `summary` | Yes | One or two sentences for the product card and the home page. Also used for search engines unless `seoDescription` is set, so it must then be 50 to 170 characters. |
| `intro` | | The longer opening paragraph at the top of the product page. |
| `seoDescription` | | The text search engines show, 50 to 170 characters. |
| `seoTitle` | | Browser-tab title, if it should differ from `name`. |
| `highlights` | | Three or so short points shown on the home page feature. |
| `chips` | | Short tags under the intro, like `"Free 5-listing sample"`. |
| `price` | Yes | `amount` (a number, e.g. `29`), `currency` (e.g. `"USD"`; the site adds it after the price), `label` (e.g. `"$29"`), `terms` (e.g. `"one-time"`). |
| `freeOffer` | | Highlighted line in the price box, like `"Free 5-listing sample first"`. |
| `buyUrl` | Yes, if available | The product's Stripe payment link. |
| `buyLabel` | | Buy-button text. Leave it out to get "Buy now: $price". Any dollar price written in it, or in the summary, intro, seoDescription, chips, highlights, price details or How it works steps, must match `price` (the build checks). |
| `buyNote` | | Short note under the buy buttons: delivery time and cancellation. |
| `freeSample` | | The free-sample email button: `label` (button text), `subject` and `body` (the pre-written email). Optional `note`: small print under the buttons, e.g. the address to write to without an email app. |
| `sections` | | The page's main blocks. Each has an `id` (lowercase with dashes, unique on the page), a `title`, and `text` (paragraphs) and/or `items` (a ticked list). Optional: `nav` (short name for the jump menu), `note` (small print), `"column": true` (two such blocks in a row sit side by side) and `"style": "limits"` (dashes instead of ticks). |
| `howItWorks` | | The numbered steps: each has a `title` and `text`. |
| `delivery` | | Delivery-time table: each row has a `label` and `value`. `deliveryNote` is the small print under it. |
| `priceDetails` | | Ticked list in the Price section. |
| `freeSampleTerms` | | The free sample's terms (Stripe asks for these). |
| `faq` | | Questions and answers: each has `q` and `a`. |
| `ctaTitle`, `ctaText` | | The closing call to action at the bottom of the page. |
| `disclaimer` | | Small print at the very bottom of the product page. |

## How to change a page's text

Edit the matching file in `src/pages/`, for example `src/pages/about.html`. The lines between
`---` at the top set the page's title, its search-engine description (50 to 170 characters) and its
address. Words in `{{double braces}}`, like `{{email}}`, are filled in automatically from
`data/site.json`. The build lists every placeholder you can use if you mistype one.

## Policies

`/refund-policy/`, `/terms/` and `/privacy/` are plain-English **drafts** that the owner must
review. They show the label "DRAFT, owner review" while `policyStatus` in `data/site.json`
says so. Once the policies are final, set `"policyStatus": ""` and the label disappears.

## Publishing with GitHub Pages (one-time setup)

The site is on the branch `ccr-7b44bd0d-q5fvks`. The cleanest setup is to merge it into `main` first, so the
repository's front page shows the site's files and `main` is the branch you edit:

1. Open https://github.com/hairoespii/NEXUS-Website/compare/main...ccr-7b44bd0d-q5fvks, click
   **Create pull request**, then **Merge pull request**.
2. Open **Settings → Pages**. Under **Build and deployment** set **Source** to **Deploy from a branch**.
3. Under **Branch** choose **main** and the folder **/docs**. Click **Save**.
4. Within about 10 minutes the site is live at https://hairoespii.github.io/NEXUS-Website/. Then tick
   **Enforce HTTPS** on the same page if it isn't already ticked.

(If you'd rather skip the merge, choose the branch `ccr-7b44bd0d-q5fvks` in step 3 instead. It works the
same, but remember to switch to `main` if you merge later.)

### Other free hosts

GitHub's terms say Pages is not meant "to run your online business, e-commerce site, or any other website
that is primarily directed at either facilitating commercial transactions". If you'd rather not rely on
that, the same repository runs on **Cloudflare Pages** with no changes. Cloudflare's free terms don't rule out
commercial sites, and static traffic is free and unlimited. You (the owner) must create the Cloudflare account;
its terms don't allow someone else to sign up for you.

1. Sign up at https://dash.cloudflare.com (free plan).
2. **Workers & Pages → Create application → Pages → Connect to Git**, authorize GitHub, choose `hairoespii/NEXUS-Website`.
3. Production branch: the branch with this site. Build command: `node scripts/build.mjs && node scripts/check.mjs`. Build output directory: `docs`.
4. Under **Environment variables**, add `SITE_URL` = the address Cloudflare gives the project, e.g. `https://nexus-research.pages.dev/`.
5. **Save and Deploy.** Cloudflare serves `404.html` automatically.

Netlify's free plan also works (build command `node scripts/build.mjs && node scripts/check.mjs`, publish
directory `docs`, same `SITE_URL` variable), but it has a monthly credit limit that pauses the site when used up.

If you move, update the "Who helps us" hosting line in `src/pages/privacy.html` (it names GitHub).
Whichever host you pick, a custom domain makes the business look most established.

## Moving to a custom domain later

All links inside the site are relative, so nothing needs rebuilding by hand.

1. Buy the domain from any registrar. **This is the only step that costs money.**
2. In `data/site.json` change `siteUrl` to the new address, e.g. `"https://nexusresearch.example/"`, and
   commit. The build writes the `docs/CNAME` file GitHub needs, and the canonical links, sitemap and 404
   page switch to the new address.
3. In **Settings → Pages → Custom domain**, check the domain is filled in (step 2 adds it; if not, type it
   and click **Save**). Add it on GitHub before changing DNS, so nobody else can claim it. Then, at your
   registrar, add the DNS records from
   [GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
   (the Settings page doesn't list them): for `www`, a `CNAME` record pointing to `hairoespii.github.io`; for
   the bare domain, four `A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`. Do steps 2 and 3 on the same day, because the github.io address starts forwarding to
   the new domain.
4. When GitHub has issued the certificate (up to 24 hours), tick **Enforce HTTPS**.
5. Update the website address in your Stripe account and on X.

On Cloudflare Pages instead: add the domain under the project's **Custom domains**, change the `SITE_URL`
environment variable to the new address and redeploy. `SITE_URL` overrides `siteUrl` in `data/site.json`.
