# NEXUS Research website

The official website of NEXUS Research: what we do, our products, and our policies.

- **Live site:** https://hairoespii.github.io/NEXUS-Website/ (once GitHub Pages is switched on; see below)
- **Contact:** NEXUSResearchNX@gmail.com
- **Hosting:** GitHub Pages, free. No database, no paid services, nothing to install.

## How the site is put together

| Folder / file | What it is | Edit it? |
| --- | --- | --- |
| `data/products.json` | **Every product.** The Products page, the home page feature and each product's own page are built from this one file. | Yes |
| `data/site.json` | Business name, email, X link, disclaimer, site address, policy draft label. | Yes |
| `src/pages/` | The words on each page (home, products, about, contact, refund, terms, privacy, 404). | Yes |
| `src/assets/` | Stylesheet, logo icon, share image. | Rarely |
| `scripts/` | The small programs that build and check the site. | No |
| `docs/` | **The finished website** that GitHub Pages publishes. Built automatically. | **Never by hand** |

The build turns `data/` + `src/` into plain HTML pages in `docs/`. It needs only
[Node.js](https://nodejs.org) 18 or newer. There is nothing to install with npm.

```
node scripts/build.mjs     # build the site into docs/
node scripts/check.mjs     # check every link, the footer on every page, the buy links
node scripts/serve.mjs     # preview it at http://localhost:8000/NEXUS-Website/
```

You don't have to run these yourself. When you change `data/` or `src/` on
github.com, the **Rebuild site** action (in the Actions tab) builds and checks
the site and publishes it for you. If something is wrong, for example a missing
comma in `products.json`, the action stops with a plain message saying what to
fix, and the live site stays as it was.

## How to add a new product

1. Open `data/products.json`. On github.com, open the file and click the pencil icon (Edit).
2. Copy one whole product block, from its opening `{` to its closing `}`.
3. Paste it after the last product, and put a comma between the two blocks: `},` then `{`.
4. Change the details in your copy:
   - `slug`: the product's web address, lowercase with dashes, e.g. `"shopify-shipping-check"` becomes `/products/shopify-shipping-check/`. Every product needs its own.
   - `name`, `summary` (the short text on the product card), `intro` (the longer text at the top of the product page).
   - `price`: `amount` (a number, e.g. `29`), `label` (what people see, e.g. `"$29"`), `terms` (e.g. `"one-time"`).
   - `buyUrl`: the product's Stripe payment link.
   - The page sections: `whatYouGet`, `whoItsFor`, `howItWorks`, `delivery`, `priceDetails`, `faq`. Delete any section you don't need.
   - `featured`: set to `true` on the one product the home page should show; `false` on the others.
   - `status`: `"available"`, or `"coming-soon"` to list a product without a buy button.
5. Save (on github.com: **Commit changes**).
6. Wait a minute or two, then reload the site. The new product appears on the Products page with its own page.

Text in `products.json` can use `[link text](/refund-policy/)` for a link, `**bold**`, and
`{{email}}` / `{{name}}` for the business email and name.

## How to change a page's text

Edit the matching file in `src/pages/`, for example `src/pages/about.html`. The lines between
`---` at the top set the page's title, its search-engine description and its address. Words in
`{{double braces}}`, like `{{email}}`, are filled in automatically from `data/site.json`.

## Policies

`/refund-policy/`, `/terms/` and `/privacy/` are plain-English **drafts** that the owner must
review. They show the label "DRAFT, owner review" while `policyStatus` in `data/site.json`
says so. Once the policies are final, set `"policyStatus": ""` and the label disappears.

## Publishing with GitHub Pages (one-time setup)

1. On github.com open the repository, then **Settings**, then **Pages**.
2. Under **Build and deployment** set **Source** to **Deploy from a branch**.
3. Choose the branch that holds this site (for now `ccr-7b44bd0d-q5fvks`, or `main` once it's merged) and the folder **/docs**. Click **Save**.
4. After a minute or two the site is live at https://hairoespii.github.io/NEXUS-Website/.

### Other free hosts

GitHub's terms say Pages is not meant "to run your online business, e-commerce site, or any other website
that is primarily directed at either facilitating commercial transactions". If you'd rather not rely on
that, the same repository runs on **Cloudflare Pages** with no changes. Cloudflare's free terms don't rule out
commercial sites, and static traffic is free and unlimited. You (the owner) must create the Cloudflare account;
its terms don't allow someone else to sign up for you.

1. Sign up at https://dash.cloudflare.com (free plan).
2. **Workers & Pages → Create application → Pages → Connect to Git**, authorize GitHub, choose `hairoespii/NEXUS-Website`.
3. Production branch: the branch with this site. Build command: `node scripts/build.mjs`. Build output directory: `docs`.
4. Under **Environment variables**, add `SITE_URL` = the address Cloudflare gives the project, e.g. `https://nexus-research.pages.dev/`.
5. **Save and Deploy.** Cloudflare serves `404.html` automatically.

Netlify's free plan also works (build command `node scripts/build.mjs`, publish directory `docs`, same
`SITE_URL` variable), but it has a monthly credit limit that pauses the site when used up.

Whichever host you pick, a custom domain makes the business look most established.

## Moving to a custom domain later

All links inside the site are relative, so nothing needs rebuilding by hand.

1. Buy the domain (for example from any registrar). This is the only step that costs money.
2. In `data/site.json` change `siteUrl` to the new address, e.g. `"https://nexusresearch.example/"`. The build then writes the `docs/CNAME` file GitHub needs.
3. In **Settings → Pages → Custom domain**, enter the domain and save. Then add the DNS records GitHub shows for an apex or `www` domain at your registrar.
4. When GitHub has issued the certificate, tick **Enforce HTTPS**.
5. Update the website address in your Stripe account and on X.
