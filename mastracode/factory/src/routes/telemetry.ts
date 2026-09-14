import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import { FACTORY_WEB_PAGES } from '../telemetry-types.js';
import { captureFactoryWebActivity, isFactoryTelemetryEnabled } from '../telemetry.js';
import { Route } from './route.js';
import type { RouteDependencies } from './route.js';

const activitySchema = z
  .object({
    activity: z.enum(['page_view', 'interaction']),
    page: z.enum(FACTORY_WEB_PAGES),
  })
  .strict();

// Core bundles Hono declarations, so the same runtime Context has distinct
// nominal request types across the package boundary (as in other route modules).
function localContext(context: unknown): Context {
  return context as Context;
}

interface TelemetryRoutesDeps extends RouteDependencies {
  providerName?: string;
  publicOrigin: string;
  allowedOrigins: string[];
}

export class TelemetryRoutes extends Route<TelemetryRoutesDeps> {
  private readonly budgets = new Map<string, { until: number; count: number }>();

  routes() {
    const limitBody = bodyLimit({ maxSize: 512 });
    const origins = new Set([this.deps.publicOrigin, ...this.deps.allowedOrigins]);
    return [
      registerApiRoute('/web/telemetry/activity', {
        method: 'POST',
        middleware: (context, next) => limitBody(localContext(context), next),
        handler: async context => {
          const c = localContext(context);
          if (!this.deps.auth.enabled()) return c.body(null, 401);
          await this.deps.auth.ensureUser(c);
          const actor = this.deps.auth.tenant(c);
          if (!actor?.userId) return c.body(null, 401);
          const origin = c.req.header('Origin');
          if (origin && !origins.has(origin)) return c.body(null, 403);
          if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
            return c.body(null, 415);
          }
          const parsed = activitySchema.safeParse(await c.req.json().catch(() => undefined));
          if (!parsed.success) return c.body(null, 400);
          if (!isFactoryTelemetryEnabled(this.deps.providerName)) return c.body(null, 204);

          // Bound capture rate and memory per process; this is not a distributed
          // quota or a promise of exactly-once delivery.
          const key = JSON.stringify([actor.orgId, actor.userId]);
          const now = Date.now();
          const previous = this.budgets.get(key);
          if (previous && previous.until > now) {
            if (previous.count >= 60) return c.body(null, 204);
            previous.count += 1;
          } else {
            if (this.budgets.size >= 10_000) {
              for (const [id, budget] of this.budgets) {
                if (budget.until <= now) this.budgets.delete(id);
              }
              if (this.budgets.size >= 10_000) return c.body(null, 204);
            }
            this.budgets.set(key, { until: now + 60_000, count: 1 });
          }
          captureFactoryWebActivity(parsed.data, actor);
          return c.body(null, 204);
        },
      }),
    ];
  }
}
