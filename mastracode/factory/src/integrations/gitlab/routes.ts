import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { handleGitLabWebhook } from './webhook.js';
import type { ParsedGitLabWebhook } from './webhook.js';

type RouteContext = Context;

function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

export interface BuildGitLabRoutesOptions {
  webhookSecret?: string;
  ingestFactoryEvent?: (event: ParsedGitLabWebhook) => Promise<unknown>;
}

export function buildGitLabRoutes(options: BuildGitLabRoutesOptions): ApiRoute[] {
  return [
    registerApiRoute('/web/gitlab/webhook', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const result = await handleGitLabWebhook(loose(c), {
          webhookSecret: options.webhookSecret,
          ingestFactoryEvent: options.ingestFactoryEvent,
        });
        return c.json(result.body, result.status);
      },
    }),
  ];
}
