#!/usr/bin/env node
/*
 * Local preview of the built site, served the way GitHub Pages serves it:
 * at the same sub-path as the live site (/NEXUS-Website/ for now), with the
 * 404 page for unknown addresses.
 *
 * Run it with:  node scripts/serve.mjs   then open the address it prints.
 * Use another port with:  PORT=9000 node scripts/serve.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL;
const basePath = new URL(site.siteUrl).pathname.replace(/\/?$/, '/');
const port = Number(process.env.PORT) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8',
};

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  const page = path.join(DOCS, '404.html');
  if (fs.existsSync(page)) send(res, 404, page);
  else { res.writeHead(404); res.end('Not found'); }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' && basePath !== '/') { res.writeHead(302, { Location: basePath }); res.end(); return; }
  if (`${url.pathname}/` === basePath) { res.writeHead(301, { Location: basePath }); res.end(); return; }
  if (!url.pathname.startsWith(basePath)) { notFound(res); return; }

  const rel = decodeURIComponent(url.pathname.slice(basePath.length));
  const file = path.join(DOCS, rel);
  if (!file.startsWith(DOCS)) { notFound(res); return; }
  let stat = fs.existsSync(file) ? fs.statSync(file) : null;
  if (stat && stat.isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }); res.end(); return; }
    const index = path.join(file, 'index.html');
    stat = fs.existsSync(index) ? fs.statSync(index) : null;
    if (stat) { send(res, 200, index); return; }
  }
  if (stat && stat.isFile()) { send(res, 200, file); return; }
  notFound(res);
}).listen(port, () => {
  console.log(`Previewing docs/ at http://localhost:${port}${basePath}  (Ctrl+C to stop)`);
});
