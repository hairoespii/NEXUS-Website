# Owner review checklist

Everything on the website is real except the items below. They are **drafts I wrote because the
page needed something there**, or **settings only you can change**. Each item says where to change it.
Nothing here costs money.

## 1. Put the site online (about 1 minute)

GitHub Pages is not switched on yet, so the site is not live. Only the repository owner can switch it on.

1. Open https://github.com/hairoespii/NEXUS-Website/settings/pages
2. **Source:** Deploy from a branch.
3. **Branch:** `ccr-7b44bd0d-q5fvks` (or `main`, after this branch is merged into it). **Folder:** `/docs`. Click **Save**.
4. Wait up to 10 minutes. The site appears at https://hairoespii.github.io/NEXUS-Website/

**Hosting caution.** GitHub's terms say Pages "is not intended for or allowed to be used as a free web
hosting service to run your online business, e-commerce site, or any other website that is primarily
directed at either facilitating commercial transactions". This site describes your business and links out to
Stripe for payment, so it's a judgment call. If you'd rather avoid the question, see the "Other free hosts"
section of `README.md`. The site works unchanged on Cloudflare Pages or Netlify.

## 2. Confirm the business promises I drafted

These appear on the product page and in the policies. Change any you don't agree with, or tell your assistant to.

| What the site currently says | Where to change it |
| --- | --- |
| Free sample delivered **within 2 business days** of getting the listings | `data/products.json` → `delivery` |
| Full check delivered **within 5 business days** of payment + listings | `data/products.json` → `delivery`, `buyNote` |
| **One free sample per Amazon seller account** | `data/products.json` → `freeSampleTerms`; `src/pages/refund-policy.html`; `src/pages/terms.html` |
| One **catalog** = the bundle listings sold under one Amazon seller account (no listing limit) | `data/products.json` → `faq` |
| We check against Amazon's **US** bundling policy; other stores: email first | `data/products.json` → `faq` |
| **What we look at / What we don't do** (seller-assembled bundles, Amazon's exceptions, listing basics; no logins, no changes to listings, no contact with brands or Amazon) | `data/products.json` → `sections` |
| Report is **a written report, by email** | `data/products.json` → `delivery`, `sections` |
| **Full refund** if cancelled before work starts, or if the report is late | `src/pages/refund-policy.html`, `src/pages/terms.html` |
| Report problems **within 14 days** of delivery → fix or full refund | `src/pages/refund-policy.html` |
| **No refund for change of mind** after a report is delivered | `src/pages/refund-policy.html` |
| Buyers must be **18+ and buying for their business** | `src/pages/terms.html` |
| We **never ask for passwords** and **don't send marketing emails** | `src/pages/about.html`, `src/pages/terms.html`, `src/pages/privacy.html` |
| Order records kept **as long as tax rules require**; unused free-sample emails deleted **within 12 months** | `src/pages/privacy.html` |

**If any tool other than Stripe, Gmail and GitHub touches customer emails or listings** (for example an AI
assistant that helps with the review), the Privacy Policy must name it under "Who helps us". Right now it doesn't.

## 3. Fill in facts only you know

Open `data/site.json`. These fields are empty, so nothing shows on the site yet. Each one appears in the right
places as soon as you fill it in.

| Field | What it's for |
| --- | --- |
| `country` | Your business's country (for example `"the United States"`). Card networks (Visa) expect the merchant's country to be shown at checkout. It appears next to every buy button and in the Terms and Privacy pages. **Recommended before Stripe review.** |
| `statementDescriptor` | The name buyers see on their card statement, exactly as set in Stripe (for example `"NEXUS RESEARCH"`). Stripe recommends telling customers. |
| `governingLaw` | Which laws govern the Terms (for example `"the State of Florida, USA"`). |
| `ownerName` | Optional. Your legal name, if you want it on the Terms and Privacy pages. |

## 4. Read the policies, then remove the draft label

1. Read `/refund-policy/`, `/terms/` and `/privacy/` on the site. They are plain-English drafts, **not legal advice**.
2. When you're happy, open `data/site.json` and change `"policyStatus": "DRAFT, owner review"` to `"policyStatus": ""`.
   The "DRAFT, owner review" labels disappear on the next build. Stripe treats "under construction" sites as
   incomplete, so do this **before** you send the link to Stripe.

## 5. Stripe Dashboard (only you can sign in)

Don't redo the Payment Link. These are settings around it.

1. **Settings → Business → Public details:** set the website to the live address, and add the Terms of Service
   (`…/terms/`) and Privacy Policy (`…/privacy/`) links and the support email.
2. Check that the **public business name** is "NEXUS Research", that the business description matches the
   site, and note the **statement descriptor** (put it in `data/site.json`).
3. Optional but recommended: on the Payment Link, turn on **require customers to accept your terms of service**
   and show your policies at checkout. Card issuers give more weight to terms the buyer ticked.
4. Reply to Stripe's request with the website link **well before November 18, 2026**.

## 6. Later

- **After January 11, 2027:** the product page talks about checking listings "before January 11, 2027" and
  "before the deadline". Update that wording in `data/products.json` (`intro`, `ctaTitle`, `whoItsFor`).
- **Keep "Last checked" honest:** the product page cites Amazon's announcement and policy page, "Last checked
  October 21, 2026". Re-read those pages now and then and update the date in `data/products.json` (`sections` → `the-rule` → `note`).
- **Custom domain:** see "Moving to a custom domain later" in `README.md`. Buying the domain is the only step that costs money.
- **The repository is public** (free GitHub Pages needs that). Everything in it, including commit history, is visible to anyone.
