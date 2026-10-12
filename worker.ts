// Custom Worker entrypoint (wrangler.jsonc `main`).
// `opennextjs-cloudflare build` still writes .open-next/worker.js; this file re-exports it and adds
// the `scheduled` handler so Willie's cron (wrangler.jsonc `triggers`) dispatches due tasks.
// .open-next/ only exists after the OpenNext build, so `next build`'s type-check can't resolve the import.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import handler from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

type Env = CloudflareEnv & { CRON_SECRET?: string; APP_URL?: string };

export default {
  fetch: handler.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Call the Next.js route in-process (no network hop) with the cron secret.
    const url = `${env.APP_URL ?? "https://aidoctorswarm.com"}/api/willie/dispatch`;
    const req = new Request(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CRON_SECRET ?? ""}`,
        "x-cron": controller.cron,
        "content-type": "application/json",
      },
      body: JSON.stringify({ scheduledTime: controller.scheduledTime }),
    });
    ctx.waitUntil(
      handler.fetch(req, env, ctx).then(async (res: Response) => {
        console.log("[willie:cron]", res.status, await res.text());
      }),
    );
  },
} satisfies ExportedHandler<Env>;
