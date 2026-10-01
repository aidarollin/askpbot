// Pulls the AskPBot design out of pandai.question.uiux and into this repo.
//
//   node scripts/pbot-design/sync.mjs        (PANDAI_UIUX=<path> to override)
//
// Writes, all generated — edit this script, never the outputs:
//   app/pbot.css            the source's own rules for every class in classes.json
//   public/pbot/**          the images those rules and the components reference
//   public/pbot/icons.svg   the DS sprite cut down to the glyphs used here
//   public/pbot/rive/*      pbot.riv, and the runtime's rive.wasm (see PBotRive.tsx)
//
// The CSS is EXTRACTED, not rewritten. A selector survives only if every class in
// it is one the source actually renders in a state this port ships (classes.json,
// from collect-classes.mjs) — so Math Drill, the report modal and the ds-scroll
// widget fall away on their own, and nothing has to be hand-pruned. Host-specific
// overrides (this app has no Pandai header to subtract) live in app/pbot-host.css.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');
const UIUX = path.resolve(process.env.PANDAI_UIUX ?? path.join(REPO, '../pandai.question.uiux'));
const postcss = createRequire(path.join(UIUX, 'package.json'))('postcss');

const IMAGES = path.join(UIUX, 'themes/app/assets/images');
const PUBLIC = path.join(REPO, 'public/pbot');
const CSS_OUT = path.join(REPO, 'app/pbot.css');

// Source stylesheet, in its own cascade order (resources/css/app.css). dark.css and
// navbar.css are skipped: the surfaces keep their brand colours in dark mode (see
// README), and the navbar is the host app's chrome.
const FILES = ['tokens', 'base', 'components', 'modals', 'motion', 'responsive'];

// Rendered in the source, deliberately not ported. Each is a SCOPE.md row.
const EXCLUDE = [
  /^pbot-md/, /^pbot-web__math$/, /^pbot-web__rail-md$/, /^pbot-web__rule$/, // Math Drill
  /^pbot-deck__card--math$/, /^pbot-topbar__chip$/, /^pbot-modal__card--success$/, /^pbot-modal__bar$/,
  /^ds-scroll/, /^pbot-compose__scroll$/,                                     // native scrolling
  /^pbot-report/, /^pbot-fb__/, /^pbot-modal__art--think$/, /^pbot-modal__title--report$/, // report modals
];
// Classes the collector cannot reach (states it does not drive) but this port uses.
const EXTRA = [
  'home-pbot', 'home-pbot__poof', 'home-pbot__diver', 'home-pbot__canvas', 'pbot-panel--left',
  'btn-gamefeel', 'is-playing', 'is-live', 'is-away', 'is-poof',
];
// Body/page modifiers that start with `is-` but belong to the source's host pages.
const HOST_STATES = new Set(['is-lab-fixed', 'is-math', 'is-drill']);

// Referenced from component markup (the CSS references are found automatically).
const MARKUP_IMAGES = [
  'askpbot/web-hero-glow.svg', 'askpbot/web-hero-halo.svg', 'askpbot/web-hero-spark.svg',
  'askpbot/web-hero-spark-gold.svg', 'askpbot/sparkle.svg', 'askpbot/tab-ask-active.png',
  'askpbot/empty-state.png', 'askpbot/chat-sparkle-scene.svg', 'askpbot/chat-sparkle-10.svg',
  'askpbot/chat-sparkle-9.svg', 'askpbot/chat-sparkle-white.svg', 'askpbot/chat-sparkle-yellow.svg',
  'askpbot/chat-motion-lines.svg', 'askpbot/askpbot-wordmark.png', 'askpbot/pbot-face.svg',
  'askpbot/mathdrill-pod.png', 'profile/avatar-illustration.png',
];
const ICONS = [
  'arrow-up', 'check', 'chevron-btn-m', 'chevron-down', 'chevron-left', 'clipboard', 'edit', 'image',
  'maximize-2', 'mic', 'more-vertical', 'play-filled', 'refresh-cw', 'square', 'thumbs-up', 'trash-2', 'x',
];

// ── CSS ─────────────────────────────────────────────────────────────────────
const collected = JSON.parse(fs.readFileSync(path.join(here, 'classes.json'), 'utf8')).classes;
const allowed = new Set([...collected, ...EXTRA].filter((c) => !EXCLUDE.some((re) => re.test(c))));
const isAllowed = (c) => allowed.has(c) || (c.startsWith('is-') && !HOST_STATES.has(c));

function keepSelector(sel) {
  if (/data-theme|\.dark\b/.test(sel)) return false;
  // Element selectors only — `\bbody\b` would also match the class `pbot-web__side-body`.
  if (/(^|[\s>+~(,])(body|html)(?![\w-])|:root/.test(sel) && !sel.includes('.btn-gamefeel')) return false;
  // :not(…) only narrows a match, so an excluded class inside it is harmless.
  const subject = sel.replace(/:not\(([^()]|\([^()]*\))*\)/g, '');
  const classes = [...subject.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  return classes.length > 0 && classes.every(isAllowed) && classes.some((c) => !c.startsWith('is-'));
}

const usedVars = new Set();
const usedKeyframes = new Set();
const keyframes = new Map();
const rootDecls = new Map();

function scan(decl) {
  for (const m of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) usedVars.add(m[1]);
  if (decl.prop === 'animation' || decl.prop === 'animation-name') {
    for (const tok of decl.value.split(/[\s,]+/)) usedKeyframes.add(tok);
  }
}

function filter(src, dst, file) {
  src.each((node) => {
    if (node.type === 'rule') {
      if (node.selector.includes(':root')) {
        if (node.selector.trim() === ':root' && (file === 'tokens' || file === 'base')) {
          // Braces matter: a walk callback that returns `false` stops the walk.
          node.walkDecls((d) => {
            if (d.prop.startsWith('--')) rootDecls.set(d.prop, d.value);
          });
        }
        return;
      }
      const selectors = node.selectors.filter(keepSelector);
      if (!selectors.length) return;
      const rule = node.clone({ selectors });
      rule.walkComments((c) => c.remove());
      rule.walkDecls(scan);
      rule.raws.before = '\n';
      dst.append(rule);
    } else if (node.type === 'atrule') {
      if (node.name.endsWith('keyframes')) keyframes.set(node.params.trim(), node);
      else if (['media', 'supports', 'container'].includes(node.name) && !/prefers-color-scheme/.test(node.params)) {
        const at = node.clone({ nodes: [] });
        filter(node, at, file);
        if (at.nodes.length) { at.raws.before = '\n\n'; dst.append(at); }
      }
    }
  });
}

const body = [];
for (const file of FILES) {
  const css = fs.readFileSync(path.join(UIUX, 'resources/css/pandai', `${file}.css`), 'utf8');
  const section = postcss.root();
  filter(postcss.parse(css, { from: `${file}.css` }), section, file);
  if (section.nodes.length) body.push(`\n\n/* ── resources/css/pandai/${file}.css ── */`, section.toString());
}

const frames = [];
for (const name of usedKeyframes) {
  const kf = keyframes.get(name);
  if (!kf) continue;
  const c = kf.clone();
  c.walkComments((x) => x.remove());
  c.walkDecls(scan);
  frames.push(c.toString());
}

// Design tokens, transitively: a token can be defined in terms of another.
const tokens = new Map();
for (let grew = true; grew; ) {
  grew = false;
  for (const v of [...usedVars]) {
    if (tokens.has(v) || !rootDecls.has(v)) continue;
    tokens.set(v, rootDecls.get(v));
    for (const m of rootDecls.get(v).matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!usedVars.has(m[1])) { usedVars.add(m[1]); grew = true; }
    }
  }
}

const commit = execSync('git rev-parse --short HEAD', { cwd: UIUX }).toString().trim();
const cssAssets = new Set();
let out = [
  `/* GENERATED by scripts/pbot-design/sync.mjs from pandai.question.uiux@${commit}. Do not edit:`,
  '   change the script (or app/pbot-host.css) and re-run it. */',
  '',
  ':root {',
  ...[...tokens].sort().map(([k, v]) => `    ${k}: ${v};`),
  '}',
  ...body,
  '\n\n/* ── keyframes ── */\n',
  frames.join('\n\n'),
  '',
].join('\n');
out = out
  // Tailwind's theme() would resolve these too, but only if this app declared the same
  // breakpoints; the fallbacks are the DS values, so inline them.
  .replace(/theme\(--breakpoint-tablet(?:,\s*[^)]*)?\)/g, '764px')
  .replace(/theme\(--breakpoint-desktop(?:,\s*[^)]*)?\)/g, '1320px')
  .replace(/url\((['"]?)\/Themes\/app\/assets\/images\/([^'")]+)\1\)/g, (m, q, p) => {
    cssAssets.add(p);
    return `url(${q}/pbot/${p}${q})`;
  });
fs.writeFileSync(CSS_OUT, out);

// ── images ──────────────────────────────────────────────────────────────────
fs.rmSync(PUBLIC, { recursive: true, force: true });
for (const rel of [...cssAssets, ...MARKUP_IMAGES]) {
  const dst = path.join(PUBLIC, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(IMAGES, rel), dst);
}

// ── icon sprite ─────────────────────────────────────────────────────────────
// The source sprite defines a few ids twice; <use> resolves to the FIRST, so take that.
const sprite = fs.readFileSync(path.join(UIUX, 'themes/app/assets/icons/sprite.svg'), 'utf8');
const symbols = ICONS.map((name) => {
  const m = sprite.match(new RegExp(`<symbol id="ic-${name}"[\\s\\S]*?</symbol>`));
  if (!m) throw new Error(`icon ${name} not in the source sprite`);
  return m[0];
});
fs.writeFileSync(
  path.join(PUBLIC, 'icons.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols.join('\n')}\n</svg>\n`,
);

// ── Rive ────────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(PUBLIC, 'rive'), { recursive: true });
fs.copyFileSync(path.join(UIUX, 'themes/app/assets/rive/pbot.riv'), path.join(PUBLIC, 'rive/pbot.riv'));
// The WASM must match the JS runtime byte for byte, so it comes from THIS repo's install
// of @rive-app/canvas (pinned exact in package.json), never from the source repo's.
fs.copyFileSync(path.join(REPO, 'node_modules/@rive-app/canvas/rive.wasm'), path.join(PUBLIC, 'rive/rive.wasm'));

console.log(
  `pbot.css: ${out.split('\n').length} lines, ${tokens.size} tokens, ${frames.length} keyframes · ` +
  `${cssAssets.size + MARKUP_IMAGES.length} images · ${ICONS.length} icons · from uiux@${commit}`,
);
