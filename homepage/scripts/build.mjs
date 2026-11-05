// Builds the NEXUS Research homepage.
//
//   node scripts/build.mjs               staging/preview build into dist/ (review bar, noindex)
//   node scripts/build.mjs --production  the live version into dist/ (no review notes, links to the site's own pages)
//
// The live website's build (scripts/build.mjs at the repository root, on the branch GitHub Pages
// publishes) imports buildHomepage() from this file, so the homepage is rebuilt with the rest of the site.
// No dependencies: needs only Node.js 18+.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ASSET_DIR = 'assets/home';

class HomepageError extends Error {}
const fail = (msg) => { throw new HomepageError(`Homepage: ${msg}`); };
const readJSON = (rel) => {
  try { return JSON.parse(readFileSync(join(root, rel), 'utf8')); }
  catch (e) { fail(`${rel} is not valid JSON (${e.message}). Check for a missing comma or quote.`); }
};
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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

// Where a link goes in this build. In the live build, pages of the website itself are
// linked relatively and open in the same tab; in the preview they open the live site.
export function resolveLink(l, production) {
  if (production && l.production) return { href: l.production, external: false };
  return { href: l.href, external: !!l.external };
}

/**
 * Renders the homepage. Returns a Map of output path -> file contents
 * ("index.html" and the files under assets/home/).
 *   production: live version (no review notes, canonical address, site-relative links)
 *   siteUrl:    the site's canonical address (production only)
 */
export function buildHomepage({ production = false, siteUrl = 'https://nexusresearchnx.com/' } = {}) {
  const { links } = readJSON('content/links.json');
  const { tests } = readJSON('content/current-tests.json');
  const logo = readFileSync(join(root, 'src/assets/logo.svg'), 'utf8').trim();

  function linkAttrs(key, where) {
    const l = links[key];
    if (!l) fail(`${where} uses link "${key}", which is not in content/links.json.`);
    if (!l.href) fail(`content/links.json: link "${key}" has no href.`);
    const { href, external } = resolveLink(l, production);
    let attrs = `href="${esc(href)}"`;
    if (external) attrs += ' target="_blank" rel="noopener"';
    if (l.status === 'needs-confirmation') attrs += ' data-link-status="needs-confirmation"';
    return attrs;
  }

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
      cta = `<a class="btn btn-gold btn-sm test-cta" ${linkAttrs(t.cta.link, where)}>${esc(t.cta.label)} <span class="btn-icon" aria-hidden="true">&#8599;</span></a>`;
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
  tests.forEach((t) => { if (ids.has(t.id)) fail(`content/current-tests.json: two tests share the id "${t.id}".`); ids.add(t.id); });
  const currentTests = tests.length
    ? `<div class="test-list">\n          ${tests.map(renderTest).join('\n          ')}\n          </div>`
    : '<p class="test-empty">New tests are being prepared. Check back soon.</p>';

  let html = readFileSync(join(root, 'src/index.html'), 'utf8');
  html = html.replace(/\{\{#staging\}\}([\s\S]*?)\{\{\/staging\}\}/g, production ? '' : '$1');
  html = html.replace(/\{\{#production\}\}([\s\S]*?)\{\{\/production\}\}/g, production ? '$1' : '');
  html = html.replaceAll('{{canonical}}', esc(siteUrl));
  html = html.replaceAll('{{logo}}', logo);
  html = html.replace('{{current_tests}}', currentTests);
  html = html.replace(/\{\{link:([a-z0-9-]+)\}\}/g, (_, key) => linkAttrs(key, 'src/index.html'));
  // Tell screen-reader users when a link opens in a new tab.
  html = html.replace(/(<a [^>]*target="_blank"[^>]*>)([\s\S]*?)(<\/a>)/g, (m, open, inner, close) => {
    const note = '<span class="visually-hidden"> (opens the existing website in a new tab)</span>';
    return /<span class="(ext|btn-icon)"/.test(inner)
      ? `${open}${inner.replace(/(<span class="(?:ext|btn-icon)")/, `${note}$1`)}${close}`
      : `${open}${inner}${note}${close}`;
  });
  const leftover = html.match(/\{\{[^}]*\}\}/);
  if (leftover) fail(`src/index.html still contains ${leftover[0]}. It is not a known placeholder.`);

  const files = new Map([['index.html', html]]);
  for (const f of readdirSync(join(root, 'src/assets'))) {
    if (f === 'logo.svg' || f.startsWith('.')) continue;
    files.set(`${ASSET_DIR}/${f}`, readFileSync(join(root, 'src/assets', f)));
  }
  files.set(`${ASSET_DIR}/favicon.svg`,
    logo.replace(' class="logo"', '').replace(' aria-hidden="true" focusable="false"', '') + '\n');
  return files;
}

// LINKS.md: every link, button and CTA with its destination, regenerated on each build.
export function linksMarkdown() {
  const { links } = readJSON('content/links.json');
  const { tests } = readJSON('content/current-tests.json');
  const cell = (l) => (l.production && l.production !== l.href ? `\`${l.production}\` (preview: \`${l.href}\`)` : `\`${l.href}\``);
  const rows = Object.values(links).map((l) =>
    `| ${l.used_by} | ${cell(l)} | ${l.status === 'needs-confirmation' ? '**PLACEHOLDER / NEEDS CONFIRMATION**' : l.status} | ${l.note} |`);
  const testRows = tests.filter((t) => t.cta).map((t) => `- **${t.title}**: "${t.cta.label}" uses link \`${t.cta.link}\`.`);
  return `# Link map: every link, button and CTA

Generated by \`node scripts/build.mjs\` from \`content/links.json\`. Do not edit by hand.

Status meanings: **in-page** jumps to a section of the homepage. **existing-site** opens a page of the
website (nexusresearchnx.com); on the live site these are ordinary links to the site's own pages, and in the
review preview they open the live website. **PLACEHOLDER / NEEDS CONFIRMATION** works, but the owner has not
confirmed the destination.

| Where it appears | Destination | Status | Notes |
| --- | --- | --- | --- |
${rows.join('\n')}

Current Tests buttons (from \`content/current-tests.json\`):

${testRows.join('\n') || '- none'}
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const production = process.argv.includes('--production');
  try {
    const files = buildHomepage({ production });
    const out = join(root, 'dist');
    rmSync(out, { recursive: true, force: true });
    for (const [rel, content] of files) {
      mkdirSync(dirname(join(out, rel)), { recursive: true });
      writeFileSync(join(out, rel), content);
    }
    writeFileSync(join(out, 'robots.txt'), production ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
    writeFileSync(join(root, 'LINKS.md'), linksMarkdown());
    const { tests } = readJSON('content/current-tests.json');
    console.log(`Built dist/ (${production ? 'production' : 'staging preview'}): ${tests.length} current test(s).`);
  } catch (e) {
    if (e instanceof HomepageError) { console.error(`BUILD FAILED: ${e.message}`); process.exit(1); }
    throw e;
  }
}
