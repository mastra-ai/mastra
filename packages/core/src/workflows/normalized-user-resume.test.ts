import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MASTRA_NORMALIZED_USER_KEY, RequestContext } from '../request-context';
import { MockStore } from '../storage/mock';
import { createWorkflow as createDefaultWorkflow } from './create';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from './evented';
import { createStep as createDefaultStep } from './workflow';

const looseObject = z.looseObject({});
const alice = { id: 'alice', role: 'admin' };
const bob = { id: 'bob', role: 'member' };

// Keys the server auth middleware sets for an authenticated request.
const USER_KEYS = [MASTRA_NORMALIZED_USER_KEY, 'mastra__user', 'mastra__userRoles', 'mastra__userPermissions'];

function contextFor(user: { id: string; role: string }) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_NORMALIZED_USER_KEY, user);
  requestContext.set('mastra__user', { sub: user.id });
  requestContext.set('mastra__userRoles', [user.role]);
  requestContext.set('mastra__userPermissions', [`${user.role}:*`]);
  requestContext.set('tenant', 'acme');
  return requestContext;
}

function userKeysFor(user: { id: string; role: string } | undefined) {
  return {
    [MASTRA_NORMALIZED_USER_KEY]: user,
    mastra__user: user && { sub: user.id },
    mastra__userRoles: user && [user.role],
    mastra__userPermissions: user && [`${user.role}:*`],
  };
}

function snapshotOf(requestContext: RequestContext) {
  return {
    user: Object.fromEntries(USER_KEYS.map(key => [key, requestContext.get(key)])),
    tenant: requestContext.get('tenant'),
  };
}

const engines = [
  { name: 'default', createWorkflow: createDefaultWorkflow, createStep: createDefaultStep, evented: false },
  {
    name: 'evented',
    createWorkflow: createEventedWorkflow as unknown as typeof createDefaultWorkflow,
    createStep: createEventedStep as unknown as typeof createDefaultStep,
    evented: true,
  },
];

describe.each(engines)('$name engine resume with a normalized user', ({ createWorkflow, createStep, evented }) => {
  function setup() {
    const seen: Record<string, ReturnType<typeof snapshotOf>> = {};
    const first = createStep({
      id: 'first',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ requestContext }) => {
        seen.first = snapshotOf(requestContext);
        return {};
      },
    });
    const approval = createStep({
      id: 'approval',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ requestContext, resumeData, suspend }) => {
        if (!resumeData) return suspend({});
        seen.approval = snapshotOf(requestContext);
        return {};
      },
    });
    const workflow = createWorkflow({
      id: `normalized-user-${evented ? 'evented' : 'default'}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
    })
      .then(first)
      .then(approval)
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow as any },
      ...(evented ? { pubsub: new EventEmitterPubSub() } : {}),
    });
    return { mastra, workflow, seen };
  }

  async function withWorkers<T>(mastra: Mastra, fn: () => Promise<T>) {
    if (evented) await mastra.startWorkers();
    try {
      return await fn();
    } finally {
      if (evented) await mastra.stopWorkers();
    }
  }

  it('does not carry the starting user, roles or permissions into a resume without one', async () => {
    const { mastra, workflow, seen } = setup();
    await withWorkers(mastra, async () => {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {}, requestContext: contextFor(alice) })).status).toBe('suspended');

      const resumed = await run.resume({ step: 'approval', resumeData: { approved: true } });

      expect(resumed.status).toBe('success');
      expect(seen.first).toEqual({ user: userKeysFor(alice), tenant: 'acme' });
      expect(seen.approval).toEqual({ user: userKeysFor(undefined), tenant: 'acme' });
    });
  });

  it('uses the resuming user', async () => {
    const { mastra, workflow, seen } = setup();
    await withWorkers(mastra, async () => {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {}, requestContext: contextFor(alice) })).status).toBe('suspended');

      const resumed = await run.resume({
        step: 'approval',
        resumeData: { approved: true },
        requestContext: contextFor(bob),
      });

      expect(resumed.status).toBe('success');
      expect(seen.approval).toEqual({ user: userKeysFor(bob), tenant: 'acme' });
    });
  });
});
