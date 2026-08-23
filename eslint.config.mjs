import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare build output. `.open-next/` is the bundled worker and its
    // copied static chunks; `.wrangler/` is the dev server's scratch space.
    // Both are generated, both are gitignored, and linting them buries the
    // real source under ~15k warnings from minified vendor code.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
