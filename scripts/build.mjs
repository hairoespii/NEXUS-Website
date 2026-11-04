// Builds the NEXUS Research homepage into dist/.
//
//   node scripts/build.mjs               staging/preview build (review bar, noindex)
//   node scripts/build.mjs --production  same page without the review-preview notes
//
// No dependencies: needs only Node.js 18+.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const out = join(root, 'dist');

const fail = (msg) => { console.error(`BUILD FAILED: ${msg}`); process.exit(1); };
const readJSON = (rel) => {
  try { return JSON.parse(readFileSync(join(root, rel), 'utf8')); }
  catch (e) { fail(`${rel} is not valid JSON (${e.message}). Check for a missing comma or quote.`); }
};
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const { links } = readJSON('content/links.json');
const { tests } = readJSON('content/current-tests.json');
const logo = readFileSync(join(root, 'src/assets/logo.svg'), 'utf8').trim();

function linkAttrs(key, where) {
  const l = links[key];
  if (!l) fail(`${where} uses link "${key}", which is not in content/links.json.`);
  if (!l.href) fail(`content/links.json: link "${key}" has no href.`);
  let attrs = `href="${esc(l.href)}"`;
  if (l.external) attrs += ' target="_blank" rel="noopener"';
  if (l.status === 'needs-confirmation') attrs += ' data-link-status="needs-confirmation"';
  return attrs;
}

const icons = {
  box: `<svg class="test-icon" viewBox="0 0 80 80" aria-hidden="true" focusable="false" fill="none" stroke-linejoin="round">
            <path d="M40 10 66 23v30L40 66 14 53V23z" fill="#123553"/>
            <path d="M14 23 40 36l26-13" stroke="#d9b56b" stroke-width="1.6"/>
            <path d="M40 36v30" stroke="#d9b56b" stroke-width="1.6"/>
            <path d="M40 10 66 23v30L40 66 14 53V23z" stroke="#d9b56b" stroke-width="1.6"/>
            <path d="m27 16.5 26 13v8l-5-2.5v-8l-26-13z" fill="#c9a35d" stroke="#d9b56b" stroke-width="1"/>
            <path d="M20 46.5 30 51.5M20 51l6 3" stroke="#6f8aa3" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M7 61 12 58M73 61l-5-3M40 3v4" stroke="#6f8aa3" stroke-width="1" stroke-linecap="round" opacity=".7"/>
          </svg>`,
};

function renderTest(t, i) {
  const where = `content/current-tests.json, test #${i + 1}`;
  for (const f of ['id', 'title', 'summary']) if (!t[f]) fail(`${where}: "${f}" is required.`);
  if (t.icon && !icons[t.icon]) fail(`${where}: icon "${t.icon}" is unknown. Use one of: ${Object.keys(icons).join(', ')}, or leave it out.`);
  const price = t.price && t.price.amount
    ? `<p class="test-price"><span class="test-price-amount">${esc(t.price.amount)}</span>${t.price.note ? ` <span class="test-price-note">${esc(t.price.note)}</span>` : ''}</p>`
    : '';
  let cta = '';
  if (t.cta) {
    if (!t.cta.label || !t.cta.link) fail(`${where}: "cta" needs both "label" and "link".`);
    const ext = links[t.cta.link]?.external;
    cta = `<a class="btn btn-gold btn-sm test-cta" ${linkAttrs(t.cta.link, where)}>${esc(t.cta.label)}${ext ? '<span class="visually-hidden"> (opens the existing website in a new tab)</span>' : ''} <span class="btn-icon" aria-hidden="true">&#8599;</span></a>`;
  }
  const offer = price || cta ? `\n            <div class="test-offer">${price}${cta}</div>` : '';
  return `<article class="test-card" id="test-${esc(t.id)}" aria-labelledby="test-${esc(t.id)}-title">
            <p class="test-badge">${esc(t.label || 'Current test')}</p>
            <div class="test-head">
              <h3 class="test-title" id="test-${esc(t.id)}-title">${esc(t.title)}</h3>
              ${t.icon ? icons[t.icon] : ''}
            </div>
            <p class="test-summary">${esc(t.summary)}</p>${offer}
            ${t.disclaimer ? `<p class="test-disclaimer">${esc(t.disclaimer)}</p>` : ''}
          </article>`;
}

if (!Array.isArray(tests)) fail('content/current-tests.json: "tests" must be a list.');
const ids = new Set();
tests.forEach((t, i) => { if (ids.has(t.id)) fail(`content/current-tests.json: two tests share the id "${t.id}".`); ids.add(t.id); });
const currentTests = tests.length
  ? `<div class="test-list">\n          ${tests.map(renderTest).join('\n          ')}\n          </div>`
  : `<p class="test-empty">New tests are being prepared. Check back soon.</p>`;

let html = readFileSync(join(root, 'src/index.html'), 'utf8');
html = html.replace(/\{\{#staging\}\}([\s\S]*?)\{\{\/staging\}\}/g, production ? '' : '$1');
html = html.replaceAll('{{logo}}', logo);
html = html.replace('{{current_tests}}', currentTests);
html = html.replace(/\{\{link:([a-z0-9-]+)\}\}/g, (_, key) => linkAttrs(key, 'src/index.html'));
// Tell screen-reader users when a link opens the existing website in a new tab.
html = html.replace(/(<a [^>]*target="_blank"[^>]*>)([\s\S]*?)(<\/a>)/g, (m, open, inner, close) =>
  inner.includes('opens the existing website') ? m
    : `${open}${inner.replace(/(<span class="ext")/, '<span class="visually-hidden"> (opens the existing website in a new tab)</span>$1')}${close}`);
const leftover = html.match(/\{\{[^}]*\}\}/);
if (leftover) fail(`src/index.html still contains ${leftover[0]}. It is not a known placeholder.`);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'index.html'), html);
for (const f of readdirSync(join(root, 'src/assets'))) {
  if (f === 'logo.svg') continue;
  copyFileSync(join(root, 'src/assets', f), join(out, 'assets', f));
}
writeFileSync(join(out, 'assets/favicon.svg'),
  logo.replace(' class="logo"', '').replace(' aria-hidden="true" focusable="false"', '') + '\n');
writeFileSync(join(out, 'robots.txt'), production ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');

// Regenerate LINKS.md so the documented destinations always match the build.
const rows = Object.entries(links).map(([k, l]) =>
  `| ${l.used_by} | \`${l.href}\` | ${l.status === 'needs-confirmation' ? '**PLACEHOLDER / NEEDS CONFIRMATION**' : l.status} | ${l.note} |`);
const testRows = tests.filter((t) => t.cta).map((t) => `- **${t.title}**: "${t.cta.label}" uses link \`${t.cta.link}\`.`);
writeFileSync(join(root, 'LINKS.md'), `# Link map: every link, button and CTA

Generated by \`node scripts/build.mjs\` from \`content/links.json\`. Do not edit by hand.

Status meanings: **in-page** jumps to a section of the homepage. **existing-site** opens a page that exists on the
current live website (nexusresearchnx.com), confirmed from the saved copy of the live site dated 2026-11-02.
**PLACEHOLDER / NEEDS CONFIRMATION** works, but the owner has not confirmed the destination.

| Where it appears | Destination | Status | Notes |
| --- | --- | --- | --- |
${rows.join('\n')}

Current Tests buttons (from \`content/current-tests.json\`):

${testRows.join('\n') || '- none'}
`);

console.log(`Built dist/ (${production ? 'production' : 'staging preview'}): ${tests.length} current test(s).`);
