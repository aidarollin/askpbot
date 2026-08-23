import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

/**
 * Makes Cloudflare bindings available to `next dev`.
 *
 * The adapter's scaffold emits this call unguarded, which is wrong: Next loads
 * this file for `next build` as well as `next dev`, so an unguarded call spawns
 * a `workerd` process on every build. Those processes outlive the build and
 * hold an open handle on `.open-next`, so the *next* build dies with
 * `EPERM ... rm .open-next` — a failure that reads like a permissions problem
 * and is actually a leaked child process.
 *
 * `next dev` sets NODE_ENV to development; `next build` sets it to production.
 */
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
