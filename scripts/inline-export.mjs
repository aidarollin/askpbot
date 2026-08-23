/**
 * Refreshes the inlined source blocks in docs/SYSTEM-EXPORT.md from the real
 * files on disk.
 *
 * The export inlines every source file verbatim so another repo or agent can
 * absorb the system from a single document. That is only worth having if it
 * stays true, so this script is idempotent and re-runnable: it finds each
 * `#### path` block already present in the document and replaces its body with
 * the current file contents, rather than depending on one-shot placeholders
 * that vanish after the first run.
 *
 * Run after any source change:  npm run export:refresh
 * Exits non-zero if a referenced file has gone missing, so it can gate CI.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const DOC = "docs/SYSTEM-EXPORT.md";

const LANG = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".css": "css",
  ".json": "json",
  ".example": "bash",
  ".mjs": "js",
};

/** Matches one rendered block: heading, line count, fenced body. */
const BLOCK = /#### `([^`]+)` *\n_\d+ lines_\n\n```[\w-]*\n[\s\S]*?\n```\n/g;

let doc = readFileSync(DOC, "utf8");
const refreshed = [];
const missing = [];

doc = doc.replace(BLOCK, (match, path) => {
  let body;
  try {
    body = readFileSync(path, "utf8").replace(/\s+$/, "");
  } catch {
    missing.push(path);
    return match; // Leave the stale block rather than silently deleting it.
  }
  refreshed.push(path);
  const lang = LANG[extname(path)] ?? "text";
  const lines = body.split("\n").length;
  return (
    "#### `" + path + "`  \n" +
    "_" + lines + " lines_\n\n" +
    "```" + lang + "\n" + body + "\n```\n"
  );
});

writeFileSync(DOC, doc);
console.log(`refreshed ${refreshed.length} file blocks in ${DOC}`);

if (missing.length) {
  console.error("\nMISSING (blocks left stale):");
  for (const m of missing) console.error("  " + m);
  process.exit(1);
}
