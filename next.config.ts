import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes getCloudflareContext() work under `next dev`: D1 comes from wrangler's local state
// (.wrangler/state, populated by `npm run db:local`), vars from wrangler.jsonc, secrets from .dev.vars.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
