#!/usr/bin/env node
/*
 * Checks the built site in docs/ before it goes live.
 *
 * - every link and image inside the site points at a file that exists
 * - every #section link points at a section that exists
 * - every page has a title, a description, one main heading and the full footer
 *   (business name, email, the three policy links and the disclaimer)
 * - policy pages carry the draft label while data/site.json has one
 * - every product has its own page, a card on the Products page and, when it is
 *   for sale, its buy link
 *
 * Run it with:  node scripts/check.mjs   (after node scripts/build.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const problems = [];
const problem = (file, message) => problems.push(`${file}: ${message}`);

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL;
site.siteUrl = new URL(site.siteUrl).href.replace(/\/?$/, '/'); // the same clean-up build.mjs does
const { products } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const basePath = new URL(site.siteUrl).pathname.replace(/\/?$/, '/');

if (!fs.existsSync(DOCS)) {
  console.error('docs/ does not exist yet. Run: node scripts/build.mjs');
  process.exit(1);
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [path.relative(DOCS, full).split(path.sep).join('/')];
  });
}

const files = new Set(listFiles(DOCS));
const htmlFiles = [...files].filter((f) => f.endsWith('.html')).sort();
const html = new Map(htmlFiles.map((f) => [f, fs.readFileSync(path.join(DOCS, f), 'utf8')]));
const ENTITIES = { amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' };
const decode = (s) => s.replace(/&(amp|quot|#39|lt|gt);/g, (m, k) => ENTITIES[k]);
const ids = (text) => new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const externalLinks = new Map();

// Turns a link found in docs/<file> into the docs/ file it should open.
function targetOf(file, href) {
  const pageUrl = new URL(`https://site.test${basePath}${file}`);
  const url = new URL(href, pageUrl);
  if (url.origin !== pageUrl.origin) return { external: true };
  if (!url.pathname.startsWith(basePath)) return { error: `goes outside the site (${url.pathname})` };
  let rel = decodeURIComponent(url.pathname.slice(basePath.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  return { rel, hash: decodeURIComponent(url.hash.slice(1)) };
}

for (const [file, text] of html) {
  // Links and images.
  for (const match of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const href = decode(match[1]);
    if (href === '') { problem(file, 'has an empty link'); continue; }
    if (/^(mailto:|tel:)/.test(href)) {
      if (href.startsWith('mailto:') && !href.slice(7).split('?')[0].includes('@')) problem(file, `email link without an address: ${href}`);
      continue;
    }
    if (/^(https?:)?\/\//.test(href)) {
      if (href.startsWith('http://')) problem(file, `uses an insecure http:// link: ${href}`);
      if (href.startsWith(site.siteUrl)) continue; // the page's own canonical address
      const list = externalLinks.get(href) || [];
      list.push(file);
      externalLinks.set(href, list);
      continue;
    }
    if (/^[a-z]+:/i.test(href)) { problem(file, `unexpected link type: ${href}`); continue; }
    if (file === '404.html' && !href.startsWith('#') && !href.startsWith('/')) {
      problem(file, `the 404 page must use links from the site root (it can be shown at any address): ${href}`);
    }
    const target = targetOf(file, href);
    if (target.external) continue;
    if (target.error) { problem(file, `link ${href} ${target.error}`); continue; }
    if (!files.has(target.rel)) { problem(file, `broken link ${href} (no docs/${target.rel})`); continue; }
    if (target.hash && target.rel.endsWith('.html') && !ids(html.get(target.rel)).has(target.hash)) {
      problem(file, `link ${href} points to #${target.hash}, which doesn't exist on that page`);
    }
  }

  // Duplicate ids break #links.
  const allIds = [...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))) problem(file, `id "${id}" is used more than once`);

  // Required page parts.
  if (!/<html lang="en">/.test(text)) problem(file, 'missing <html lang="en">');
  if (!/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(text)) problem(file, 'missing the mobile viewport tag');
  const title = text.match(/<title>([^<]*)<\/title>/);
  if (!title || !title[1].trim()) problem(file, 'missing a <title>');
  const description = text.match(/<meta name="description" content="([^"]*)">/);
  const where = file.startsWith('products/') && file !== 'products/index.html'
    ? '"seoDescription" in data/products.json ("summary" is used if there is none)'
    : 'the "description:" line at the top of its src/pages file';
  if (!description || decode(description[1]).trim().length < 50) problem(file, `missing a meta description, or it is under 50 characters. Change ${where}.`);
  if (description && decode(description[1]).length > 170) problem(file, `meta description is ${decode(description[1]).length} characters; the limit is 170. Shorten ${where}.`);
  const h1s = (text.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) problem(file, `should have exactly one <h1> main heading, found ${h1s}`);
  if (file !== '404.html' && !text.includes(`<link rel="canonical" href="${site.siteUrl.replace(/\/?$/, '/')}`)) problem(file, 'missing its canonical address');
  const visible = text.replace(/<script[\s\S]*?<\/script>/g, '');
  if (/\{\{|\}\}/.test(visible)) {
    const left = visible.match(/\{\{[^}]*\}\}/);
    const found = left ? left[0] : 'a {{placeholder}}';
    const productFile = file.startsWith('products/') && file !== 'products/index.html';
    problem(file, productFile
      ? `still contains ${found}. {{name}}, {{email}} and {{x}} don't work in "name", "badge", "price", "freeOffer", ` +
        '"buyLabel", "ctaTitle", or a section\'s "title" or "nav" in data/products.json. Type the words out instead.'
      : `still contains ${found}. Check its spelling in the matching src/pages file.`);
  }
  if (/TODO|FIXME|lorem ipsum/i.test(text)) problem(file, 'contains TODO / FIXME / lorem ipsum text');

  // Footer on every page.
  const footer = text.slice(text.indexOf('<footer'));
  if (!text.includes('<footer')) { problem(file, 'missing the footer'); continue; }
  if (!footer.includes(site.name)) problem(file, 'footer is missing the business name');
  if (!footer.includes(`href="mailto:${site.email}"`)) problem(file, 'footer is missing the email link');
  if (!footer.includes(site.disclaimer)) problem(file, 'footer is missing the disclaimer');
  for (const policy of ['refund-policy/', 'terms/', 'privacy/']) {
    const linked = [...footer.matchAll(/href="([^"]*)"/g)].some((m) => {
      const t = targetOf(file, decode(m[1]));
      return t.rel === `${policy}index.html`;
    });
    if (!linked) problem(file, `footer is missing the link to ${policy}`);
  }
}

// Policy pages.
for (const policy of ['refund-policy', 'terms', 'privacy']) {
  const file = `${policy}/index.html`;
  if (!html.has(file)) { problem('docs', `missing the ${policy} page`); continue; }
  if (site.policyStatus && !html.get(file).includes(site.policyStatus)) problem(file, `should show "${site.policyStatus}"`);
}

// Products.
const productsPage = html.get('products/index.html') || '';
const linksTo = (file, rel) => [...(html.get(file) || '').matchAll(/\shref="([^"]*)"/g)]
  .some((m) => targetOf(file, decode(m[1])).rel === rel);
for (const p of products) {
  const file = `products/${p.slug}/index.html`;
  if (!html.has(file)) { problem('docs', `missing the page for ${p.name}`); continue; }
  if (!linksTo('products/index.html', file)) problem('products/index.html', `has no card linking to ${p.name}`);
  if ((p.status || 'available') === 'available') {
    const buy = `href="${p.buyUrl.replace(/&/g, '&amp;')}"`;
    if (!html.get(file).includes(buy)) problem(file, 'is missing its buy link');
    if (!productsPage.includes(buy)) problem('products/index.html', `is missing the buy link for ${p.name}`);
    if (p.featured && !(html.get('index.html') || '').includes(buy)) problem('index.html', `is missing the buy link for the featured product ${p.name}`);
  }
}

for (const required of ['index.html', 'about/index.html', 'contact/index.html', '404.html', '.nojekyll', 'sitemap.xml', 'robots.txt', 'assets/styles.css', 'assets/favicon.svg']) {
  if (!files.has(required)) problem('docs', `missing ${required}`);
}
for (const image of ['assets/og-image.png', 'assets/apple-touch-icon.png']) {
  if (!files.has(image)) problem('docs', `missing ${image} (it lives in src/assets/)`);
}

const pagesChecked = htmlFiles.length;
if (process.argv.includes('--links')) {
  console.log('Links to other websites (not checked automatically):');
  for (const [href, where] of [...externalLinks].sort()) console.log(`  ${href}  (${where.length} page${where.length === 1 ? '' : 's'})`);
}
if (problems.length) {
  console.error(`Found ${problems.length} problem${problems.length === 1 ? '' : 's'} in ${pagesChecked} pages:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`All good: ${pagesChecked} pages checked, ${externalLinks.size} outside links listed (run with --links to see them).`);
