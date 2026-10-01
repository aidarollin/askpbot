// Records every class the source AskPBot UI actually renders, across the states
// this port ships: idle hero, chat, streaming, a grown composer, the history
// row's menu / rename / delete, a voice take (recording → recorded → sent), an
// image attachment and its viewer, and the slide-in panel's home and chat.
//
// Rendered DOM rather than a grep of the Blade files, because <x-btn> and
// <x-icon-btn> expand into classes (btn__face, icon-btn--l …) that never appear
// in the templates themselves.
//
// Needs the source app running — from pandai.question.uiux:
//   php artisan serve --port=8765
// then, from this repo:
//   node scripts/pbot-design/collect-classes.mjs
// and re-run sync.mjs. Writes scripts/pbot-design/classes.json.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const UIUX = path.resolve(process.env.PANDAI_UIUX ?? path.join(here, '../../../pandai.question.uiux'));
const BASE = process.env.PANDAI_UIUX_URL ?? 'http://127.0.0.1:8765';
// Playwright comes from the source repo, so this repo does not carry it.
const { chromium } = createRequire(path.join(UIUX, 'package.json'))('playwright');

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
const found = new Set();
const ROOTS = ['.pbot-web-shell', '.pbot-panel', '.pbot-modal', '.pbot-scrim'];
const grab = async (page) => {
  const classes = await page.evaluate((roots) => {
    const out = [];
    for (const r of roots) {
      document.querySelectorAll(r).forEach((root) => {
        [root, ...root.querySelectorAll('*')].forEach((el) => el.classList?.forEach((c) => out.push(c)));
      });
    }
    return out;
  }, ROOTS);
  classes.forEach((c) => found.add(c));
};
const settle = (page, ms) => page.waitForTimeout(ms);

const p = await ctx.newPage();
await p.goto(`${BASE}/lab/askpbot`, { waitUntil: 'networkidle' });
await settle(p, 1500); await grab(p);
await p.locator('.pbot-web__compose input').fill('hello'); await grab(p);
await p.locator('.pbot-web__prompt').first().click(); await settle(p, 300); await grab(p);
await settle(p, 4500); await grab(p);
await p.locator('.pbot-web .pbot-compose textarea').fill('1\n2\n3\n4\n5\n6\n7'); await settle(p, 200); await grab(p);
await p.locator('.pbot-web .pbot-compose textarea').fill('');
await p.locator('.pbot-history__more').first().click(); await grab(p);
await p.getByText('Rename').first().click(); await settle(p, 200); await grab(p);
await p.locator('.pbot-history__acts .icon-btn').first().click();
await p.getByText('Delete').first().click(); await settle(p, 200); await grab(p);
await p.locator('.pbot-history__acts .icon-btn').first().click();
await p.locator('.pbot-history__acts .icon-btn').first().click();
await p.locator('.pbot-turn__acts button').first().click(); await settle(p, 400); await grab(p);
await p.keyboard.press('Escape'); await settle(p, 300);
await p.locator('.pbot-conv [aria-label="Record a voice message"]').first().click(); await settle(p, 1500); await grab(p);
await p.locator('[aria-label="Stop recording"]').first().click(); await settle(p, 800); await grab(p);
await p.locator('[aria-label="Send voice note"]').first().click(); await settle(p, 1500); await grab(p);
await settle(p, 4000);
await p.locator('.pbot-conv .pbot-filepicker').setInputFiles(path.join(UIUX, 'themes/app/assets/images/askpbot/empty-state.png'));
await settle(p, 300); await grab(p);
await settle(p, 4000); await p.locator('.pbot-conv textarea').first().press('Enter'); await settle(p, 1000); await grab(p);
await p.locator('.pbot-imgmsg__open').first().click().catch(() => {}); await settle(p, 400); await grab(p);

const q = await ctx.newPage();
await q.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
await q.evaluate(() => window.dispatchEvent(new CustomEvent('pbot-open'))); await settle(q, 1500); await grab(q);
await q.locator('.pbot-panel .btn--primary').first().click(); await settle(q, 500); await grab(q);
await q.locator('.pbot-panel .pbot-suggest__chip').first().click(); await settle(q, 4500); await grab(q);

const out = path.join(here, 'classes.json');
fs.writeFileSync(out, JSON.stringify({ classes: [...found].sort() }, null, 1) + '\n');
console.log(`${found.size} classes → ${path.relative(process.cwd(), out)}`);
await browser.close();
