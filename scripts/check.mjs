// Static checks on the built page (run after build.mjs). No dependencies.
// Fails (exit 1) on: unknown or broken links, missing image text/sizes, skipped heading levels,
// missing approved copy, removed design elements, and unsupported business claims.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) { console.error('Run node scripts/build.mjs first.'); process.exit(1); }
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const { links } = JSON.parse(readFileSync(join(root, 'content/links.json'), 'utf8'));
const { tests } = JSON.parse(readFileSync(join(root, 'content/current-tests.json'), 'utf8'));

const errors = [];
const warnings = [];
const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// 1. Links: every href is a known destination; in-page anchors exist.
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const known = new Set(Object.values(links).map((l) => l.href));
const anchors = [...html.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)];
for (const [, attrs, inner] of anchors) {
  const href = (attrs.match(/href="([^"]*)"/) || [])[1];
  const label = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!href) { errors.push(`Link "${label}" has no destination.`); continue; }
  if (!known.has(href)) errors.push(`Link "${label}" goes to ${href}, which is not documented in content/links.json.`);
  if (href.startsWith('#') && !ids.has(href.slice(1))) errors.push(`Link "${label}" jumps to ${href}, but no section has that id.`);
  if (/target="_blank"/.test(attrs) && !/rel="noopener"/.test(attrs)) errors.push(`Link "${label}" opens a new tab without rel="noopener".`);
  if (!label) errors.push(`A link to ${href} has no text.`);
}
const local = [...html.matchAll(/(?:src|href|srcset)="((?!https?:|mailto:|#)[^"]+)"/g)].map((m) => m[1]);
for (const f of local) if (!existsSync(join(dist, f))) errors.push(`The page uses ${f}, but that file is missing from dist/.`);

// 2. Images: alt text and fixed size (prevents layout jumps while loading).
for (const [img] of html.matchAll(/<img\s[^>]*>/g)) {
  if (!/\salt="[^"]+"/.test(img)) errors.push(`Image without alt text: ${img}`);
  if (!/\swidth="\d+"/.test(img) || !/\sheight="\d+"/.test(img)) errors.push(`Image without width/height: ${img}`);
}

// 3. Headings: one h1, no skipped levels.
const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
if (levels.filter((l) => l === 1).length !== 1) errors.push('The page must have exactly one h1.');
levels.reduce((prev, l) => { if (l > prev + 1) errors.push(`Heading order skips from h${prev} to h${l}.`); return l; }, 0);

// 4. Buttons need a type; the menu button needs aria wiring.
for (const [b] of html.matchAll(/<button\s[^>]*>/g)) if (!/type="/.test(b)) errors.push(`Button without type: ${b}`);
if (!/aria-controls="site-nav"/.test(html) || !/id="site-nav"/.test(html)) errors.push('Mobile menu button is not connected to the menu.');

// 5. Approved copy must be present exactly.
const approved = [
  'Clarity before your next move.',
  'Independent research. Practical solutions.',
  'We find real problems, investigate what matters, and test practical solutions.',
  'Our Approach', 'Less guesswork. A clearer way forward.',
  'Understand the problem', 'Start with a specific problem worth solving.',
  'Check the evidence', 'Research buyers, alternatives, constraints and real-world evidence.',
  'Test what works', 'Turn the strongest findings into practical tests and learn from what happens.',
  'Current tests.', 'Research that leads somewhere.',
  'Promising opportunities can graduate into independent businesses. NEXUS Research continues discovering and testing what comes next.',
  'The NEXUS Model', 'Discover', 'Research', 'Test', 'Learn', 'Improve', 'Build',
  'The principles behind the work.', 'Evidence before claims', 'Tests before assumptions',
  'Clear limitations', 'Practical solutions', 'Continuous learning',
  'Independent research and venture development.',
];
for (const s of approved) if (!text.includes(s)) errors.push(`Approved copy missing: "${s}"`);

// 6. Final design corrections.
if (/N\s*\/\s*0\d/.test(text)) errors.push('The "N / 01" identifier must not appear on the Current Test card.');
if (text.includes('Promising opportunities may develop into separate businesses')) errors.push('Old "Research that leads somewhere" sentence is still present.');
for (const t of tests) if (!text.includes(t.title)) errors.push(`Current test "${t.title}" is not on the page.`);
if (!/class="test-disclaimer"/.test(html) && tests.some((t) => t.disclaimer)) errors.push('Current test disclaimer is missing.');

// 7. Business evidence boundary: no invented proof.
const banned = [/testimonial/i, /guarantee/i, /\bproven\b/i, /\bvalidated\b/i, /success rate/i, /\d+\+?\s+(customers|clients|sellers)/i,
  /trusted by/i, /official amazon/i, /amazon[- ]approved/i, /partnered with amazon/i, /\bcompliant\b/i];
for (const re of banned) if (re.test(text)) errors.push(`Unsupported claim wording found: ${re}`);
if (/Amazon/.test(text) && !/Not affiliated with Amazon/.test(text)) errors.push('Amazon is mentioned without "Not affiliated with Amazon."');

// 8. Placeholders still waiting on the owner (reported, not a failure).
for (const [k, l] of Object.entries(links)) if (l.status === 'needs-confirmation') warnings.push(`PLACEHOLDER / NEEDS CONFIRMATION: ${l.used_by} -> ${l.href}`);

for (const w of warnings) console.log(`note: ${w}`);
if (errors.length) { for (const e of errors) console.error(`ERROR: ${e}`); console.error(`\n${errors.length} problem(s). Fix them and run again.`); process.exit(1); }
console.log(`Checks passed: ${anchors.length} links, ${levels.length} headings, ${approved.length} approved copy lines, ${tests.length} current test(s).`);
