#!/usr/bin/env node
/*
 * Builds the NEXUS Research website into docs/, the folder GitHub Pages serves.
 *
 *   data/site.json       business details used on every page
 *   data/products.json   every product. The Products grid, the home page feature
 *                        and each product's own page are all built from this file.
 *   src/pages/*.html     page text: home, products, about, contact, policies, 404
 *   src/assets/          stylesheet, icons and images, copied as they are
 *
 * Run it with:  node scripts/build.mjs   (Node.js 18 or newer, nothing to install)
 * docs/ is deleted and rebuilt on every run, so never edit it by hand.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');

class BuildError extends Error {}
const fail = (message) => { throw new BuildError(message); };
const warnings = [];
const warn = (message) => warnings.push(message);

/* ---------- reading files ---------- */

function readText(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    fail(`Missing file: ${rel}`);
  }
}

function readJson(rel) {
  const text = readText(rel);
  try {
    return JSON.parse(text);
  } catch (error) {
    // Node gives no line number for the most common slip, a comma after the last item.
    const trailing = text.search(/,\s*[\]}]/);
    const hint = !/line \d+/.test(error.message) && trailing >= 0
      ? `\nLine ${text.slice(0, trailing).split('\n').length} ends with a comma right before a closing ] or }. Delete that comma.` : '';
    fail(`${rel} is not valid JSON: ${error.message}${hint}\n` +
      'Tip: look for a missing comma, a missing quote, or a comma after the last item near that spot.');
  }
}

/* ---------- small helpers ---------- */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isHttps = (value) => isText(value) && /^https:\/\/[^\s]+$/.test(value);
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
// An email address may wrap before "@" instead of mid-word on narrow screens.
const emailHtml = (email) => esc(email).replace('@', '<wbr>@');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function mailto(email, subject, body) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}

// JSON-LD goes inside <script>, so "<" must never appear raw.
const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/* ---------- site details ---------- */

function loadSite() {
  const site = readJson('data/site.json');
  for (const key of ['name', 'tagline', 'description', 'email', 'siteUrl', 'disclaimer', 'policyUpdated']) {
    if (!isText(site[key])) fail(`data/site.json: "${key}" is missing or empty.`);
  }
  if (typeof site.policyStatus !== 'string') fail('data/site.json: "policyStatus" must be text (use "" once the policies are final).');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(site.email)) fail(`data/site.json: "email" doesn't look like an email address: ${site.email}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(site.policyUpdated)) fail('data/site.json: "policyUpdated" must look like 2026-10-21.');
  if (site.x !== undefined && !isHttps(site.x)) fail('data/site.json: "x" must be a full https:// link.');
  for (const key of ['ownerName', 'country', 'governingLaw', 'statementDescriptor', 'xHandle', 'footerBlurb']) {
    if (site[key] !== undefined && typeof site[key] !== 'string') fail(`data/site.json: "${key}" must be text (or "").`);
  }
  // Another host (e.g. Cloudflare Pages or Netlify) can build the site for its own
  // address with: SITE_URL=https://example.pages.dev/ node scripts/build.mjs
  if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL;

  let url;
  try {
    url = new URL(site.siteUrl);
  } catch {
    fail(`data/site.json: "siteUrl" is not a valid web address: ${site.siteUrl}`);
  }
  if (url.protocol !== 'https:') fail('data/site.json: "siteUrl" must start with https://');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  site.siteUrl = url.href;
  site.basePath = url.pathname;
  // A github.io address needs no CNAME file; any other address is a custom domain.
  // A SITE_URL build is for another host, which never uses GitHub's CNAME file.
  site.forOtherHost = Boolean(process.env.SITE_URL);
  site.customDomain = site.forOtherHost || url.hostname.endsWith('.github.io') ? '' : url.hostname;
  return site;
}

/* ---------- products ---------- */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = ['available', 'coming-soon'];
const PRODUCT_FIELDS = ['slug', 'name', 'status', 'featured', 'badge', 'summary', 'intro', 'seoTitle', 'seoDescription',
  'highlights', 'chips', 'price', 'freeOffer', 'buyUrl', 'buyLabel', 'buyNote', 'freeSample', 'sections', 'howItWorks',
  'delivery', 'deliveryNote', 'priceDetails', 'freeSampleTerms', 'faq', 'ctaTitle', 'ctaText', 'disclaimer'];

function loadProducts(site) {
  const data = readJson('data/products.json');
  const products = data && data.products;
  if (!Array.isArray(products) || products.length === 0) {
    fail('data/products.json must contain a "products" list with at least one product.');
  }

  const slugs = new Set();
  const buyUrls = new Map();
  products.forEach((p, i) => {
    const where = `data/products.json, product #${i + 1}${p && isText(p.name) ? ` ("${p.name}")` : ''}`;
    const need = (ok, message) => { if (!ok) fail(`${where}: ${message}`); };
    const textList = (key) => need(p[key] === undefined || (Array.isArray(p[key]) && p[key].every(isText)),
      `"${key}" must be a list of text items, like ["first", "second"]`);
    const objectList = (key, fields) => need(p[key] === undefined ||
      (Array.isArray(p[key]) && p[key].every((item) => item && fields.every((f) => isText(item[f])))),
    `"${key}" must be a list of items that each have ${fields.map((f) => `"${f}"`).join(' and ')}`);

    need(p && typeof p === 'object' && !Array.isArray(p), 'each product must be a { ... } block');
    for (const key of Object.keys(p)) {
      need(PRODUCT_FIELDS.includes(key), `unknown field "${key}". Check the spelling. Allowed fields: ${PRODUCT_FIELDS.join(', ')}`);
    }
    need(isText(p.name), '"name" is required');
    need(isText(p.slug) && SLUG.test(p.slug),
      '"slug" is required and may only use lowercase letters, numbers and dashes, e.g. "my-new-product"');
    need(!slugs.has(p.slug), `the slug "${p.slug}" is used by two products; each product needs its own`);
    slugs.add(p.slug);
    if (p.status === undefined) p.status = 'available';
    need(STATUSES.includes(p.status), `"status" must be one of: ${STATUSES.join(', ')}`);
    need(isText(p.summary), '"summary" is required (one or two sentences for the product card)');
    need(p.price && typeof p.price === 'object', '"price" is required, e.g. { "amount": 29, "currency": "USD", "label": "$29", "terms": "one-time" }');
    need(typeof p.price.amount === 'number' && p.price.amount >= 0, '"price.amount" must be a number, e.g. 29');
    need(isText(p.price.currency) && /^[A-Z]{3}$/.test(p.price.currency), '"price.currency" must be a 3-letter code, e.g. "USD"');
    need(isText(p.price.label), '"price.label" is required, e.g. "$29"');
    need(p.price.terms === undefined || isText(p.price.terms), '"price.terms" must be text, e.g. "one-time, per catalog"');
    if (p.status === 'available') {
      need(isHttps(p.buyUrl), '"buyUrl" must be the full https:// Stripe payment link (it starts with https://buy.stripe.com/). ' +
        'No payment link yet? Set "status": "coming-soon" instead.');
    } else need(p.buyUrl === undefined || isHttps(p.buyUrl), '"buyUrl" must be a full https:// link');
    if (p.buyUrl) {
      need(!buyUrls.has(p.buyUrl), `"buyUrl" is the same Stripe link as "${buyUrls.get(p.buyUrl)}". ` +
        'Each product needs its own payment link, or buyers would pay for the wrong product.');
      buyUrls.set(p.buyUrl, p.name);
    }
    need(p.featured === undefined || typeof p.featured === 'boolean', '"featured" must be true or false, without quotes');
    need(p.freeSample === undefined || (p.freeSample && typeof p.freeSample === 'object' &&
      isText(p.freeSample.label) && isText(p.freeSample.subject)),
    '"freeSample" needs a "label" and a "subject" (and usually a "body")');
    need(p.freeSample === undefined || p.freeSample.body === undefined || typeof p.freeSample.body === 'string',
      '"freeSample.body" must be text');
    for (const key of ['badge', 'intro', 'freeOffer', 'deliveryNote', 'buyLabel', 'buyNote', 'ctaTitle', 'ctaText', 'disclaimer', 'seoTitle', 'seoDescription']) {
      need(p[key] === undefined || isText(p[key]), `"${key}" must be text`);
    }
    for (const key of ['highlights', 'priceDetails', 'freeSampleTerms', 'chips']) textList(key);
    // Text that sits right next to the price must show the same price.
    for (const text of [p.buyLabel, ...(p.chips || [])]) {
      for (const m of String(text || '').matchAll(/\$\d+(?:\.\d{2})?/g)) {
        need(m[0] === p.price.label, `"buyLabel" or "chips" says ${m[0]}, but "price.label" is "${p.price.label}". Make them match.`);
      }
    }
    // Search engines show 50 to 170 characters; check.mjs enforces the same range.
    const description = plainText(p.seoDescription || p.summary, site, where);
    need(description.length >= 50 && description.length <= 170,
      `${p.seoDescription ? '"seoDescription"' : '"summary"'} is ${description.length} characters, but the search-engine ` +
      'description must be 50 to 170. Change it, or add a separate "seoDescription" of 50 to 170 characters.');
    objectList('howItWorks', ['title', 'text']);
    objectList('delivery', ['label', 'value']);
    objectList('faq', ['q', 'a']);
    need(p.sections === undefined || Array.isArray(p.sections), '"sections" must be a list of { "id", "title", ... } blocks');
    const ids = new Set(['how-it-works', 'delivery', 'price', 'faq', 'free-sample-terms']);
    (p.sections || []).forEach((s, n) => {
      const at = `"sections" item #${n + 1}`;
      need(s && isText(s.title), `${at} needs a "title"`);
      need(isText(s.id) && SLUG.test(s.id), `${at} needs an "id": lowercase letters, numbers and dashes, e.g. "what-you-get"`);
      need(!ids.has(s.id), `${at}: the id "${s.id}" is already used on this page`);
      ids.add(s.id);
      need(s.text === undefined || (Array.isArray(s.text) && s.text.every(isText)), `${at}: "text" must be a list of paragraphs`);
      need(s.items === undefined || (Array.isArray(s.items) && s.items.every(isText)), `${at}: "items" must be a list of text items`);
      need((s.text && s.text.length) || (s.items && s.items.length),
        `${at} ("${s.title}") has no "text" or "items". Add at least one, or delete the whole section from { to }.`);
      need(s.note === undefined || isText(s.note), `${at}: "note" must be text`);
      need(s.nav === undefined || isText(s.nav), `${at}: "nav" must be text`);
    });
  });

  const featured = products.filter((p) => p.featured === true);
  if (featured.length > 1) {
    fail(`data/products.json: "featured": true is set on ${featured.length} products (${featured.map((p) => p.name).join(', ')}). ` +
      'Only one product can be featured on the home page. Set the others to "featured": false.');
  }
  if (featured.length === 0) warn('No product has "featured": true, so the home page shows the first product.');
  return products;
}

/* ---------- pages ---------- */

const NAV = [
  { key: 'products', label: 'Products', to: 'products/' },
  { key: 'about', label: 'About', to: 'about/' },
  { key: 'contact', label: 'Contact', to: 'contact/' },
];
const POLICIES = [
  { label: 'Refund Policy', to: 'refund-policy/' },
  { label: 'Terms of Service', to: 'terms/' },
  { label: 'Privacy Policy', to: 'privacy/' },
];

// Where a page sits decides how its links reach the site root. Relative links
// keep the site working at /NEXUS-Website/ today and at a custom domain later.
// 404.html can be shown at any address, so it uses links from the domain root.
function pageContext(site, pagePath) {
  const isNotFound = pagePath === '404.html';
  const depth = pagePath.split('/').length - 1;
  const root = isNotFound ? site.basePath : '../'.repeat(depth);
  return {
    path: pagePath,
    root,
    isHome: pagePath === '',
    isNotFound,
    link: (to) => (to === '' ? root || './' : root + to),
    canonical: site.siteUrl + pagePath,
  };
}

// Text in products.json may use [link text](address) and **bold**, plus
// {{email}}, {{name}} and {{x}}. An address starting with "/" is a page on
// this site, e.g. [Refund Policy](/refund-policy/).
function fillValues(text, site, where) {
  const values = { email: site.email, name: site.name, x: site.x || '' };
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key) => {
    if (!(key in values)) fail(`${where}: unknown placeholder ${match}. You can use {{email}}, {{name}} or {{x}}.`);
    return values[key];
  });
}

// The same text with placeholders filled in and **bold** / [links](...) reduced to
// their words, for search-engine descriptions and structured data.
function plainText(text, site, where) {
  return fillValues(text, site, where).replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
}

function rich(text, ctx, site, where) {
  return esc(fillValues(text, site, where))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) =>
      `<a href="${href.startsWith('/') ? ctx.link(href.slice(1)) : href}">${label}</a>`);
}

const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8" fill="#0d1830"/><path d="M16 8.5 8.5 22.5h15Z" fill="none" stroke="#4fe3c9" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 8.5v9.2M8.5 22.5l7.5-4.8 7.5 4.8" fill="none" stroke="#4fe3c9" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="8.5" r="2.6" fill="#4fe3c9"/><circle cx="8.5" cy="22.5" r="2.6" fill="#4fe3c9"/><circle cx="23.5" cy="22.5" r="2.6" fill="#4fe3c9"/><circle cx="16" cy="17.7" r="2.2" fill="#e9eef8"/></svg>`;

function layout(site, ctx, page, body, { cssVersion, structuredData = [] }) {
  const title = ctx.isHome ? `${site.name}: ${site.tagline}` : `${page.title} | ${site.name}`;
  const navLinks = NAV.map((item) => {
    const current = page.nav === item.key ? (page.navExact ? ' aria-current="page"' : ' class="is-section" aria-current="true"') : '';
    return `<li><a href="${ctx.link(item.to)}"${current}>${esc(item.label)}</a></li>`;
  }).join('');
  const ogImage = `${site.siteUrl}assets/og-image.png`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
${ctx.isNotFound ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(ctx.canonical)}">`}
<meta name="theme-color" content="#060a13">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${ctx.root}assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ctx.root}assets/apple-touch-icon.png">
<link rel="stylesheet" href="${ctx.root}assets/styles.css?v=${cssVersion}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(ctx.isHome ? site.name : `${page.title} | ${site.name}`)}">
<meta property="og:description" content="${esc(page.description)}">
${ctx.isNotFound ? '' : `<meta property="og:url" content="${esc(ctx.canonical)}">\n`}<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${site.name}: ${site.tagline}`)}">
<meta name="twitter:card" content="summary_large_image">
${site.xHandle ? `<meta name="twitter:site" content="${esc(site.xHandle)}">\n` : ''}${structuredData.map(jsonLd).join('\n')}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${ctx.link('')}"${ctx.isHome ? ' aria-current="page"' : ''}>${LOGO}<span>${esc(site.name)}</span></a>
    <nav class="site-nav" aria-label="Main"><ul>${navLinks}</ul></nav>
  </div>
</header>
<main id="main">
${body.trim()}
</main>
${footer(site, ctx)}
</body>
</html>
`;
}

function footer(site, ctx) {
  const list = (items) => items.map((i) => `<li><a href="${ctx.link(i.to)}">${esc(i.label)}</a></li>`).join('');
  // role="list" keeps list semantics in Safari/VoiceOver for lists styled without bullets.
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${ctx.link('')}">${LOGO}<span>${esc(site.name)}</span></a>
        <p>${esc(site.footerBlurb || site.description)}</p>
      </div>
      <div>
        <h2>Contact</h2>
        <ul role="list">
          <li><a class="email-link" href="mailto:${esc(site.email)}">${emailHtml(site.email)}</a></li>
          ${site.x ? `<li><a href="${esc(site.x)}">X: ${esc(site.xHandle || site.x)}</a></li>` : ''}
        </ul>
      </div>
      <div>
        <h2>Site</h2>
        <ul role="list"><li><a href="${ctx.link('')}">Home</a></li>${list(NAV)}</ul>
      </div>
      <div>
        <h2>Policies</h2>
        <ul role="list">${list(POLICIES)}</ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="disclaimer">${esc(site.disclaimer)}</p>
      <p>&copy; ${new Date().getFullYear()} ${esc(site.name)}</p>
    </div>
  </div>
</footer>`;
}

/* ---------- product pieces ---------- */

function sampleHref(site, p) {
  return p.freeSample ? mailto(site.email, p.freeSample.subject, p.freeSample.body) : '';
}

function buyButton(p, className = 'btn btn-primary') {
  if (p.status !== 'available') return '';
  return `<a class="${className}" href="${esc(p.buyUrl)}">${esc(p.buyLabel || `Buy now: ${p.price.label}`)}</a>`;
}

function sampleButton(site, p, className = 'btn btn-secondary') {
  if (!p.freeSample || p.status !== 'available') return '';
  return `<a class="${className}" href="${esc(sampleHref(site, p))}">${esc(p.freeSample.label)}</a>`;
}

// "$29 USD one-time, per catalog". Stripe asks for the currency to be spelled out, not just "$".
function priceLine(p, className = 'price') {
  return `<p class="${className}"><span class="price-amount">${esc(p.price.label)}</span> <span class="price-currency">${esc(p.price.currency)}</span>${
    p.price.terms ? ` <span class="price-terms">${esc(p.price.terms)}</span>` : ''}</p>`;
}

// The small print next to every buy button: how payment works and where the policies are.
function checkoutNote(site, ctx) {
  const lines = [
    'Secure checkout by Stripe, which is certified to PCI Service Provider Level 1. We never see or store your full card number.',
  ];
  if (site.statementDescriptor) lines.push(`Shows on your card statement as ${esc(site.statementDescriptor)}.`);
  if (site.country) lines.push(`${esc(site.name)} is based in ${esc(site.country)}.`);
  return `<p class="price-note">${lines.join(' ')}</p>
  <p class="price-links"><a href="${ctx.link('refund-policy/')}">Refund Policy</a><a href="${ctx.link('terms/')}">Terms of Service</a><a href="${ctx.link('privacy/')}">Privacy Policy</a></p>`;
}

function pricePanel(site, ctx, p) {
  const comingSoon = p.status !== 'available';
  const buyNote = p.buyNote ? `<p class="price-note price-note-strong">${rich(p.buyNote, ctx, site, `data/products.json ("${p.name}") buyNote`)}</p>\n  ` : '';
  const sampleNote = p.freeSample && !comingSoon ? `<p class="price-note">No email app? Send up to 5 listing links or ASINs to <a class="email-link" href="mailto:${esc(site.email)}">${emailHtml(site.email)}</a>.${
    p.freeSampleTerms ? ` <a href="${ctx.link(`products/${p.slug}/`)}#free-sample-terms">Free sample terms</a>.` : ''}</p>\n  ` : '';
  return `<div class="price-panel">
  <p class="price-panel-label">${comingSoon ? 'Coming soon' : 'Price'}</p>
  ${priceLine(p)}
  ${p.freeOffer ? `<p class="price-free">${esc(p.freeOffer)}</p>` : ''}
  ${comingSoon
    ? `<a class="btn btn-secondary btn-block" href="${esc(mailto(site.email, `Tell me when ${p.name} is ready`))}">Email me when it's ready</a>`
    : `${buyButton(p, 'btn btn-primary btn-block')}\n  ${sampleButton(site, p, 'btn btn-secondary btn-block')}\n  ${sampleNote}${buyNote}${checkoutNote(site, ctx)}`}
</div>`;
}

function productCard(site, ctx, p, headingLevel = 'h2') {
  const href = ctx.link(`products/${p.slug}/`);
  const badge = p.status === 'coming-soon' ? 'Coming soon' : p.badge;
  return `<article class="card product-card">
  ${badge ? `<p class="badge">${esc(badge)}</p>` : ''}
  <${headingLevel} class="product-card-title"><a href="${href}">${esc(p.name)}</a></${headingLevel}>
  <p>${rich(p.summary, ctx, site, `${p.name} summary`)}</p>
  <p class="product-card-price"><strong>${esc(p.price.label)} ${esc(p.price.currency)}</strong>${p.price.terms ? ` ${esc(p.price.terms)}` : ''}${p.freeOffer ? `<br><span>${esc(p.freeOffer)}</span>` : ''}</p>
  <div class="btn-row">
    ${buyButton(p)}
    <a class="btn btn-secondary" href="${href}" aria-label="Details: ${esc(p.name)}">Details</a>
  </div>
</article>`;
}

// A short list of every product, for the home page hero. New products show up here automatically.
function productList(ctx, products) {
  const shown = products.slice(0, 4);
  return `<div class="product-list">
  <p class="product-list-label">Products</p>
  <ul role="list">${shown.map((p) => `<li><a href="${ctx.link(`products/${p.slug}/`)}"><span class="product-list-name">${esc(p.name)}</span><span class="product-list-price">${
    p.status === 'coming-soon' ? 'Coming soon' : `<strong>${esc(p.price.label)} ${esc(p.price.currency)}</strong>${p.price.terms ? ` ${esc(p.price.terms)}` : ''}${p.freeOffer ? ` &middot; ${esc(p.freeOffer)}` : ''}`
  }</span></a></li>`).join('')}</ul>
  ${products.length > shown.length ? `<p class="product-list-more"><a href="${ctx.link('products/')}">See all ${products.length} products</a></p>` : ''}
</div>`;
}

function featuredSection(site, ctx, p) {
  const where = `${p.name} (home page feature)`;
  const highlights = p.highlights || [];
  return `<section class="section" aria-labelledby="featured-title">
  <div class="container feature">
    <div class="feature-body">
      <p class="eyebrow">Featured product</p>
      <h2 id="featured-title"><a href="${ctx.link(`products/${p.slug}/`)}">${esc(p.name)}</a></h2>
      <p class="lead">${rich(p.summary, ctx, site, where)}</p>
      ${highlights.length ? `<ul class="checklist" role="list">${highlights.map((h) => `<li>${rich(h, ctx, site, where)}</li>`).join('')}</ul>` : ''}
      <p><a class="text-link" href="${ctx.link(`products/${p.slug}/`)}">See full details <span aria-hidden="true">&rarr;</span></a></p>
    </div>
    ${pricePanel(site, ctx, p)}
  </div>
</section>`;
}

// One block of a product page's "sections" list: a heading, optional paragraphs,
// an optional list and an optional small note underneath.
function sectionBlock(s, r) {
  return `<h2>${esc(s.title)}</h2>
      ${(s.text || []).map((t) => `<p>${r(t)}</p>`).join('\n      ')}
      ${s.items ? `<ul class="checklist${s.style === 'limits' ? ' limits' : ''}" role="list">${s.items.map((t) => `<li>${r(t)}</li>`).join('')}</ul>` : ''}
      ${s.note ? `<p class="muted small">${r(s.note)}</p>` : ''}`;
}

function productPage(site, ctx, p) {
  const where = `data/products.json ("${p.name}")`;
  const r = (text) => rich(text, ctx, site, where);
  const html = [];
  const jump = [];
  let alt = true;
  const section = (inner, id) => {
    alt = !alt;
    return `<section class="section${alt ? ' section-alt' : ''}"${id ? ` id="${id}"` : ''}>\n  <div class="container${inner.twoCol ? ' two-col' : ''}">\n    ${inner.html}\n  </div>\n</section>`;
  };

  // Sections marked "column": true sit side by side in pairs; others take the full width.
  const sections = p.sections || [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const next = sections[i + 1];
    jump.push({ id: s.id, label: s.nav || s.title });
    if (s.column && next && next.column) {
      jump.push({ id: next.id, label: next.nav || next.title });
      html.push(section({ twoCol: true, html: `<div class="col" id="${s.id}">\n      ${sectionBlock(s, r)}\n    </div>\n    <div class="col" id="${next.id}">\n      ${sectionBlock(next, r)}\n    </div>` }));
      i++;
    } else {
      html.push(section({ html: `<div class="${s.column ? 'col' : 'wide'}">\n      ${sectionBlock(s, r)}\n    </div>` }, s.id));
    }
  }

  if (p.howItWorks) {
    jump.push({ id: 'how-it-works', label: 'How it works' });
    html.push(section({ html: `<h2>How it works</h2>
    <ol class="steps">${p.howItWorks.map((s) => `<li><h3>${r(s.title)}</h3><p>${r(s.text)}</p></li>`).join('')}</ol>` }, 'how-it-works'));
  }

  if (p.delivery || p.priceDetails) {
    if (p.delivery) jump.push({ id: 'delivery', label: 'Delivery time' });
    jump.push({ id: 'price', label: 'Price' });
    html.push(section({ twoCol: true, html: `${p.delivery ? `<div class="col" id="delivery">
      <h2>Delivery time</h2>
      <dl class="facts">${p.delivery.map((d) => `<div><dt>${r(d.label)}</dt><dd>${r(d.value)}</dd></div>`).join('')}</dl>
      ${p.deliveryNote ? `<p class="muted">${r(p.deliveryNote)}</p>` : ''}
    </div>` : ''}
    <div class="col" id="price">
      <h2>Price</h2>
      ${priceLine(p, 'price price-inline')}
      ${p.priceDetails ? `<ul class="checklist" role="list">${p.priceDetails.map((t) => `<li>${r(t)}</li>`).join('')}</ul>` : ''}
      ${p.freeSampleTerms ? `<h3 id="free-sample-terms">Free sample terms</h3>
      <ul class="checklist" role="list">${p.freeSampleTerms.map((t) => `<li>${r(t)}</li>`).join('')}</ul>` : ''}
      <div class="btn-row">${buyButton(p)}${sampleButton(site, p)}</div>
    </div>` }));
  }

  if (p.faq) {
    jump.push({ id: 'faq', label: 'FAQ' });
    html.push(section({ html: `<h2>Frequently asked questions</h2>
    <div class="faq">${p.faq.map((f) => `<div class="faq-item"><h3>${r(f.q)}</h3><p>${r(f.a)}</p></div>`).join('')}</div>` }, 'faq'));
  }

  const chips = p.chips || [];
  const badge = p.status === 'coming-soon' ? 'Coming soon' : p.badge;
  const ctaBand = p.status === 'available' ? `<section class="section cta-band">
  <div class="container cta-inner">
    <div>
      <h2>${esc(p.ctaTitle || 'Ready to get started?')}</h2>
      <p class="muted">${r(p.ctaText || 'Questions first? Email [{{email}}](mailto:{{email}}).')}</p>
    </div>
    <div class="btn-row">${buyButton(p)}${sampleButton(site, p)}</div>
  </div>
</section>` : '';

  return `<section class="hero hero-product">
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="${ctx.link('products/')}">Products</a></li><li aria-current="page">${esc(p.name)}</li></ol></nav>
    <div class="product-hero">
      <div class="product-hero-body">
        ${badge ? `<p class="badge">${esc(badge)}</p>` : ''}
        <h1>${esc(p.name)}</h1>
        <p class="lead">${r(p.intro || p.summary)}</p>
        ${chips.length ? `<ul class="chips" role="list">${chips.map((c) => `<li>${r(c)}</li>`).join('')}</ul>` : ''}
      </div>
      ${pricePanel(site, ctx, p)}
    </div>
    ${jump.length ? `<nav class="jump" aria-label="On this page"><ul>${jump.map((j) => `<li><a href="#${j.id}">${esc(j.label)}</a></li>`).join('')}</ul></nav>` : ''}
  </div>
</section>
${html.join('\n')}
${ctaBand}
${p.disclaimer ? `<section class="section section-tight"><div class="container"><p class="muted small">${r(p.disclaimer)}</p></div></section>` : ''}`;
}

function productStructuredData(site, ctx, p) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: p.name,
    description: plainText(p.summary, site, p.name),
    url: ctx.canonical,
    provider: { '@type': 'Organization', name: site.name, url: site.siteUrl, email: site.email },
    offers: {
      '@type': 'Offer',
      price: p.price.amount.toFixed(2),
      priceCurrency: p.price.currency,
      url: ctx.canonical,
    },
  };
}

/* ---------- page files in src/pages ---------- */

function parsePageFile(file) {
  const rel = `src/pages/${file}`;
  const raw = readText(rel);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) fail(`${rel}: must start with a block between --- lines (title, description, path).`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i < 1) fail(`${rel}: can't read "${line}" in the --- block. Each line should be "name: value".`);
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of ['title', 'description', 'path']) {
    if (!isText(meta[key])) fail(`${rel}: "${key}:" is missing from the --- block at the top.`);
  }
  const pagePath = meta.path === '/' ? '' : meta.path.replace(/^\//, '');
  if (pagePath !== '' && pagePath !== '404.html' && !/^[a-z0-9-]+(\/[a-z0-9-]+)*\/$/.test(pagePath)) {
    fail(`${rel}: "path: ${meta.path}" should look like /about/ (lowercase, ending with /).`);
  }
  return { file: rel, title: meta.title, description: meta.description, path: pagePath,
    nav: meta.nav || '', navExact: true, policy: meta.policy === 'true', body: raw.slice(match[0].length) };
}

function fillTokens(template, tokens, where) {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key) => {
    if (!(key in tokens)) fail(`${where}: unknown placeholder ${match}. You can use: ${Object.keys(tokens).map((k) => `{{${k}}}`).join(' ')}`);
    return typeof tokens[key] === 'function' ? tokens[key]() : tokens[key];
  });
}

/* ---------- build ---------- */

// Every page is rendered into memory first. docs/ is only replaced once the
// whole site has built, so a mistake never leaves the live folder half-written.
const output = new Map();
const writeOut = (rel, content) => output.set(rel.split(path.sep).join('/'), content);

function copyDir(fromRel, toRel) {
  const from = path.join(ROOT, fromRel);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) copyDir(path.join(fromRel, entry.name), path.join(toRel, entry.name));
    else writeOut(path.join(toRel, entry.name), fs.readFileSync(path.join(from, entry.name)));
  }
}

function outputFile(pagePath) {
  if (pagePath === '') return 'index.html';
  return pagePath.endsWith('/') ? `${pagePath}index.html` : pagePath;
}

function build() {
  const site = loadSite();
  const products = loadProducts(site);
  const featured = products.find((p) => p.featured === true) || products[0];
  // The Terms, About and Contact pages talk about this product by name, so they
  // must point at it even when another product is featured on the home page.
  const bundle = products.find((p) => p.slug === 'amazon-bundle-rule-check') ||
    fail('data/products.json: the Terms, About and Contact pages describe the product with slug "amazon-bundle-rule-check". ' +
      'Keep that product, or update those pages first.');
  const cssVersion = hash(readText('src/assets/styles.css'));

  // GitHub writes docs/CNAME itself when a custom domain is set in Settings > Pages.
  // Keep it across rebuilds so the domain doesn't get switched off by accident.
  const cnamePath = path.join(OUT, 'CNAME');
  const oldCname = fs.existsSync(cnamePath) ? fs.readFileSync(cnamePath, 'utf8').trim() : '';

  const pageFiles = fs.readdirSync(path.join(ROOT, 'src/pages')).filter((f) => f.endsWith('.html')).sort();
  const pages = pageFiles.map(parsePageFile);
  const seenPaths = new Map();
  const claim = (pagePath, owner) => {
    if (seenPaths.has(pagePath)) fail(`Two pages want the same address "/${pagePath}": ${seenPaths.get(pagePath)} and ${owner}.`);
    seenPaths.set(pagePath, owner);
  };
  for (const p of products) claim(`products/${p.slug}/`, `data/products.json ("${p.name}")`);

  const sitemap = [];
  const options = { cssVersion };

  for (const page of pages) {
    claim(page.path, page.file);
    const ctx = pageContext(site, page.path);
    const tokens = {
      root: ctx.root,
      home: ctx.link(''),
      name: esc(site.name),
      tagline: esc(site.tagline),
      email: esc(site.email),
      emailWrap: emailHtml(site.email),
      emailHref: esc(`mailto:${site.email}`),
      x: esc(site.x || ''),
      xHandle: esc(site.xHandle || ''),
      disclaimer: esc(site.disclaimer),
      policyUpdated: esc(formatDate(site.policyUpdated)),
      draftNotice: site.policyStatus
        ? `<p class="notice"><strong>${esc(site.policyStatus)}</strong><span>Plain-English draft. Last updated ${esc(formatDate(site.policyUpdated))}.</span></p>`
        : `<p class="updated">Last updated ${esc(formatDate(site.policyUpdated))}</p>`,
      // Facts only the owner can supply. Each line stays out of the pages until its field in data/site.json is filled in.
      operator: esc(`${site.name} is a small, independent online-services business${
        site.ownerName ? `, operated by ${site.ownerName}` : ''}${site.country ? `, based in ${site.country}` : ''}.`),
      governingLaw: site.governingLaw
        ? `<p>These terms are governed by the laws of ${esc(site.governingLaw)}. This doesn't take away any rights the law where you live gives you that can't be changed by agreement.</p>`
        : '',
      statementLine: site.statementDescriptor
        ? `<li>The charge shows on your card statement as <strong>${esc(site.statementDescriptor)}</strong>.</li>`
        : '',
      featured: () => featuredSection(site, ctx, featured),
      featuredName: esc(featured.name),
      featuredUrl: ctx.link(`products/${featured.slug}/`),
      bundleName: esc(bundle.name),
      bundleUrl: ctx.link(`products/${bundle.slug}/`),
      bundleSample: esc(sampleHref(site, bundle) || `mailto:${site.email}`),
      productGrid: () => `<div class="grid">${products.map((p) => productCard(site, ctx, p)).join('\n')}</div>`,
      productList: () => productList(ctx, products),
    };
    const body = fillTokens(page.body, tokens, page.file);
    const structuredData = [];
    if (ctx.isHome) {
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: site.name,
        url: site.siteUrl,
        email: site.email,
        description: site.description,
        ...(site.x ? { sameAs: [site.x] } : {}),
      });
    }
    writeOut(outputFile(page.path), layout(site, ctx, page, body, { ...options, structuredData }));
    if (!ctx.isNotFound) sitemap.push(ctx.canonical);
  }

  for (const p of products) {
    const pagePath = `products/${p.slug}/`;
    const ctx = pageContext(site, pagePath);
    const page = {
      title: p.seoTitle ? plainText(p.seoTitle, site, p.name) : p.name,
      description: plainText(p.seoDescription || p.summary, site, p.name),
      nav: 'products',
      navExact: false,
    };
    writeOut(outputFile(pagePath), layout(site, ctx, page, productPage(site, ctx, p),
      { ...options, structuredData: [productStructuredData(site, ctx, p)] }));
    sitemap.push(ctx.canonical);
  }

  if (!seenPaths.has('')) fail('src/pages needs a home page with "path: /".');
  if (!seenPaths.has('products/')) fail('src/pages needs a products page with "path: /products/".');

  copyDir('src/assets', 'assets');
  writeOut('.nojekyll', '');
  writeOut('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    sitemap.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  writeOut('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}sitemap.xml\n`);

  if (site.customDomain) {
    writeOut('CNAME', `${site.customDomain}\n`);
  } else if (oldCname && !site.forOtherHost) {
    writeOut('CNAME', `${oldCname}\n`);
    warn(`Kept docs/CNAME (${oldCname}). Set "siteUrl" in data/site.json to https://${oldCname}/ so links and the sitemap match.`);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const [rel, content] of output) {
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return { pages: seenPaths.size, products: products.length };
}

try {
  const result = build();
  for (const w of warnings) console.warn(`Warning: ${w}`);
  console.log(`Built ${result.pages} pages (${result.products} product${result.products === 1 ? '' : 's'}) into docs/`);
} catch (error) {
  if (error instanceof BuildError) {
    console.error(`\nBuild stopped: ${error.message}\n\nNothing was published. Fix the problem above and run the build again.`);
    process.exit(1);
  }
  throw error;
}
