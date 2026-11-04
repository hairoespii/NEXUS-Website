// Browser QA for the built page: layout at many screen widths, mobile menu, keyboard,
// contrast, console/runtime errors, loading. Uses Playwright (Chromium) if installed.
//   node scripts/qa.mjs [screenshot-folder]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright is not installed here, so the browser QA was skipped. Static checks: node scripts/check.mjs'); process.exit(2); }

const shots = process.argv[2] || 'qa-screenshots';
mkdirSync(shots, { recursive: true });
const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const problems = [];
const passed = [];
const ok = (msg) => passed.push(msg);
const bad = (msg) => problems.push(msg);

const widths = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'phone-414', width: 414, height: 896, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'phone-320', width: 320, height: 640, mobile: true },
];

for (const vp of widths) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.name === 'desktop-1440' || vp.name === 'phone-390' ? 2 : 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`console ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`runtime error: ${e.message}`));
  page.on('requestfailed', (r) => errs.push(`failed request: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { errs.push(`unexpected outside request: ${route.request().url()}`); route.abort(); });
  await page.goto(base, { waitUntil: 'load' });

  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - vw;
    const wide = [];
    const clipped = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.visually-hidden') || el.classList.contains('skip-link')) continue;
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > vw + 0.5 || b.left < -0.5) && !el.closest('.hero-art')) wide.push(`${el.tagName.toLowerCase()}.${el.className}`);
      if (el.children.length === 0 && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1) && ['hidden', 'clip'].includes(cs.overflowX)) clipped.push(el.textContent.trim().slice(0, 40));
    }
    // Smallest text people need to read (ignores hidden/accessibility-only text).
    let minFont = 99, minFontText = '';
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length || el.closest('.visually-hidden') || el.classList.contains('skip-link')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const fs = parseFloat(cs.fontSize);
      if (fs < minFont) { minFont = fs; minFontText = el.textContent.trim().slice(0, 40); }
    }
    // Small tap targets on links/buttons.
    const smallTargets = [...document.querySelectorAll('a, button')].filter((a) => {
      const cs = getComputedStyle(a); if (cs.display === 'none' || a.classList.contains('skip-link')) return false;
      const b = a.getBoundingClientRect(); return b.width > 0 && (b.height < 24 || b.width < 24);
    }).map((a) => a.textContent.trim().slice(0, 30));
    const img = document.querySelector('.hero-art img');
    return { overflow, wide: [...new Set(wide)].slice(0, 8), clipped: clipped.slice(0, 8), minFont, minFontText, smallTargets,
      heroLoaded: img.complete && img.naturalWidth > 0, heroSrc: img.currentSrc.split('/').pop() };
  });
  if (r.overflow > 0) bad(`${vp.name}: page scrolls sideways by ${r.overflow}px`); else ok(`${vp.name}: no horizontal scrolling`);
  if (r.wide.length) bad(`${vp.name}: elements stick out of the screen: ${r.wide.join(', ')}`); else ok(`${vp.name}: no layout overflow`);
  if (r.clipped.length) bad(`${vp.name}: clipped text: ${r.clipped.join(' | ')}`); else ok(`${vp.name}: no clipped text`);
  if (vp.mobile && r.minFont < 12) bad(`${vp.name}: text smaller than 12px ("${r.minFontText}", ${r.minFont}px)`); else ok(`${vp.name}: smallest text ${r.minFont}px ("${r.minFontText}")`);
  if (r.smallTargets.length) bad(`${vp.name}: tap targets under 24px: ${r.smallTargets.join(', ')}`); else ok(`${vp.name}: all tap targets at least 24px`);
  if (!r.heroLoaded) bad(`${vp.name}: hero artwork did not load`); else ok(`${vp.name}: hero artwork loaded (${r.heroSrc})`);

  // Mobile menu behaviour.
  const toggleVisible = await page.isVisible('.nav-toggle');
  if (vp.width < 900) {
    if (!toggleVisible) bad(`${vp.name}: menu button not visible`);
    else {
      await page.click('.nav-toggle');
      const open = await page.evaluate(() => ({ exp: document.querySelector('.nav-toggle').getAttribute('aria-expanded'), vis: getComputedStyle(document.getElementById('site-nav')).display !== 'none', links: [...document.querySelectorAll('#site-nav a')].filter((a) => a.getBoundingClientRect().height > 0).length, ow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      if (vp.name === 'phone-390') { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/phone-390-menu-open.png` }); }
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(() => ({ exp: document.querySelector('.nav-toggle').getAttribute('aria-expanded'), focus: document.activeElement.className }));
      await page.click('.nav-toggle');
      await page.click('#site-nav a[href="#approach"]');
      await page.waitForTimeout(700);
      const afterLink = await page.evaluate(() => ({ exp: document.querySelector('.nav-toggle').getAttribute('aria-expanded'), hash: location.hash, top: Math.round(document.getElementById('approach').getBoundingClientRect().top) }));
      if (open.exp === 'true' && open.vis && open.links === 4 && open.ow <= 0 && closed.exp === 'false' && closed.focus.includes('nav-toggle') && afterLink.exp === 'false' && afterLink.hash === '#approach' && Math.abs(afterLink.top) < 40)
        ok(`${vp.name}: mobile menu opens (4 links), closes with Escape (focus returns), closes and jumps after choosing a link`);
      else bad(`${vp.name}: mobile menu problem ${JSON.stringify({ open, closed, afterLink })}`);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  } else if (toggleVisible) bad(`${vp.name}: menu button should be hidden on desktop`);
  else ok(`${vp.name}: desktop navigation shown, menu button hidden`);

  await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/${vp.name}.png`, fullPage: true });
  if (errs.length) bad(`${vp.name}: ${[...new Set(errs)].join('; ')}`); else ok(`${vp.name}: no console errors, runtime errors or failed requests`);
  await ctx.close();
}

// Keyboard: tab order covers every link/button and focus is visible.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base);
  const seen = [];
  let noRing = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const a = document.activeElement; if (a === document.body) return { t: '__body__' };
      const cs = getComputedStyle(a);
      return { t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28), ring: cs.boxShadow !== 'none' || cs.outlineStyle !== 'none' };
    });
    if (f.t === '__body__' || (seen.length && f.t === seen[0])) break;
    seen.push(f.t);
    if (!f.ring) noRing.push(f.t);
  }
  const total = await page.evaluate(() => [...document.querySelectorAll('a[href], button')].filter((e) => getComputedStyle(e).display !== 'none').length);
  if (seen[0] !== 'Skip to content') bad(`keyboard: first Tab should reach "Skip to content", got "${seen[0]}"`);
  if (noRing.length) bad(`keyboard: no visible focus on ${noRing.join(', ')}`);
  if (seen.length < total) bad(`keyboard: reached ${seen.length} of ${total} links/buttons`);
  if (seen[0] === 'Skip to content' && !noRing.length && seen.length >= total) ok(`keyboard: Tab reaches all ${total} links/buttons in order, starting with "Skip to content", each with a visible focus ring`);
  await page.keyboard.press('Shift+Tab');
  await ctx.close();
}

// Contrast: every visible text element against its effective background colour.
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(base);
  const low = await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') {
          const cols = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi)].map((m) => m[0]);
          const parsed = cols.map((c) => c.startsWith('#') ? { r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16), a: 1 } : parse(c)).filter(Boolean);
          if (parsed.length) return parsed; // check against every stop of a gradient
        }
        const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return [c];
      }
      return [{ r: 255, g: 255, b: 255, a: 1 }];
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.closest('.visually-hidden') || el.classList.contains('skip-link')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const fg = parse(cs.color); const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      for (const bg of bgOf(el)) {
        const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio < need) { out.push(`"${el.textContent.trim().slice(0, 36)}" ${ratio.toFixed(2)}:1 (needs ${need})`); break; }
      }
    }
    const d = document.querySelector('.test-disclaimer');
    let disc = null;
    if (d) { const fg = parse(getComputedStyle(d).color); const bgs = bgOf(d); disc = Math.min(...bgs.map((bg) => { const L1 = lum(fg), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); })).toFixed(2) + `:1 at ${getComputedStyle(d).fontSize}`; }
    return { out, disc };
  });
  if (low.out.length) bad(`contrast ${vp.width}px: ${low.out.join('; ')}`); else ok(`contrast ${vp.width}px: all visible text meets WCAG AA`);
  if (low.disc) ok(`contrast ${vp.width}px: test disclaimer ${low.disc}`);
  await ctx.close();
}

// Without JavaScript every navigation link is still reachable.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base);
  const n = await page.evaluate(() => [...document.querySelectorAll('#site-nav a')].filter((a) => a.getBoundingClientRect().height > 0).length);
  if (n === 4) ok('no-JavaScript fallback: all 4 menu links visible on phones'); else bad(`no-JavaScript fallback: only ${n} menu links visible`);
  await ctx.close();
}

await browser.close();
server.close();
for (const p of passed) console.log(`PASS  ${p}`);
for (const p of problems) console.log(`FAIL  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} failed. Screenshots: ${shots}/`);
process.exit(problems.length ? 1 : 0);
