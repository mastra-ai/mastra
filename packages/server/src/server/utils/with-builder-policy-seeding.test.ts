import { MASTRA_BUILDER_MODEL_POLICY_KEY } from '@mastra/core/agent-builder/ee';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi } from 'vitest';

import { AGENTS_ROUTES } from '../server-adapter/routes/agents';
import {
  applyBuilderPolicySeeding,
  isWrappedWithBuilderPolicySeeding,
  withBuilderPolicySeeding,
} from './with-builder-policy-seeding';

const makeMastra = (overrides: any = {}) =>
  ({
    getEditor: () => overrides.editor ?? undefined,
  }) as any;

describe('withBuilderPolicySeeding', () => {
  it('seeds policy BEFORE delegating to the original handler', async () => {
    const order: string[] = [];

    const wrapped = withBuilderPolicySeeding(async ({ requestContext }: any) => {
      // By the time the handler runs, the seed must already be in place.
      order.push('handler');
      expect(requestContext.get(MASTRA_BUILDER_MODEL_POLICY_KEY)).toEqual({ active: false });
      return { ok: true };
    });

    const ctx = new RequestContext();
    const setSpy = vi.spyOn(ctx, 'set');

    await wrapped({
      mastra: makeMastra(),
      requestContext: ctx,
      abortSignal: new AbortController().signal,
    } as any);

    // Seed call happens before the handler pushed 'handler'
    expect(setSpy).toHaveBeenCalledWith(MASTRA_BUILDER_MODEL_POLICY_KEY, { active: false });
    expect(order).toEqual(['handler']);
  });

  it('marks wrapped handlers with a brand for drift detection', () => {
    const wrapped = withBuilderPolicySeeding(async () => 'ok');
    expect(isWrappedWithBuilderPolicySeeding(wrapped as any)).toBe(true);
  });

  it('does not mark un-wrapped handlers', () => {
    const handler = async () => 'ok';
    expect(isWrappedWithBuilderPolicySeeding(handler as any)).toBe(false);
  });

  it('applyBuilderPolicySeeding is idempotent', () => {
    const route: any = { handler: async () => 'ok' };
    applyBuilderPolicySeeding(route);
    const wrappedOnce = route.handler;
    applyBuilderPolicySeeding(route);
    expect(route.handler).toBe(wrappedOnce);
  });
});

describe('agent runtime-defense route coverage (drift guard)', () => {
  // Routes that resolve a model at runtime MUST be wrapped. Anything that doesn't
  // touch a model (voice, tool listing, listing endpoints) is in the exempt list.
  const EXEMPT_PATHS = new Set<string>([
    '/agents',
    '/agents/providers',
    '/agents/:agentId',
    '/agents/:agentId/clone',
    '/agents/:agentId/speakers',
    '/agents/speakers',
    '/agents/:agentId/speak',
    '/agents/speak',
    '/agents/:agentId/listen',
    '/agents/listen',
    '/agents/:agentId/voice/listener',
    '/agents/:agentId/voice/speak',
    '/agents/:agentId/voice/listen',
    '/agents/:agentId/tools/:toolId',
    '/agents/:agentId/tools/:toolId/execute',
    '/agents/:agentId/model',
    '/agents/:agentId/model/reset',
    '/agents/:agentId/models/reorder',
    '/agents/:agentId/models/:modelConfigId',
  ]);

  it('every POST /agents/:agentId/... route that runs the agent is wrapped', () => {
    const offenders: string[] = [];
    for (const route of AGENTS_ROUTES) {
      if (route.method !== 'POST') continue;
      if (!route.path.startsWith('/agents/:agentId/')) continue;
      if (EXEMPT_PATHS.has(route.path)) continue;
      if (!isWrappedWithBuilderPolicySeeding(route.handler)) {
        offenders.push(`${route.method} ${route.path}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
