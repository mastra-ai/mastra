import type { Agent } from '@mastra/core/agent';
import type { ApiRouteHandler } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { z } from 'zod';
import { askOrganizationAgent } from '../agents/organization-agent.js';
import type { SourceIndex } from '../workspaces/source-index.js';

export function createOrganizationAnswerRoute(agent: Agent) {
  const input = z.object({ question: z.string() });
  const handler: ApiRouteHandler = async context => {
    try {
      return context.json(await askOrganizationAgent(agent, input.parse(await context.req.json()).question));
    } catch {
      return context.json({ error: 'The answer request could not be completed.' }, 422);
    }
  };
  return registerApiRoute('/organization-answer', { method: 'POST', requiresAuth: false, handler });
}

/** Read-only operational summary; the telemetry store excludes query and provider payloads. */
export function createOrganizationTelemetryRoute(index: SourceIndex) {
  const handler: ApiRouteHandler = async context => {
    try {
      return context.json(await index.telemetry.summary());
    } catch {
      return context.json({ error: 'The telemetry summary could not be read.' }, 503);
    }
  };
  return registerApiRoute('/organization-telemetry', { method: 'GET', requiresAuth: false, handler });
}
