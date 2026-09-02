// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config = {
	...defineCloudflareConfig({
		// For best results consider enabling R2 caching
		// See https://opennext.js.org/cloudflare/caching for more details
		// incrementalCache: r2IncrementalCache
	}),

	// `opennextjs-cloudflare build` shells out to the package manager's `build`
	// script to produce the Next output. Since `npm run build` IS this command,
	// leaving the default recurses until Node dies. Point it at the Next half.
	buildCommand: "npm run build:next",
};

export default config;
