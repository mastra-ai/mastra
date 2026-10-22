/**
 * The evented engine must never write the caller's live bearer token
 * (`mastra__authToken`) into workflow snapshots, like the default engine.
 * Steps still receive the live token while the run executes.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/26217
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../request-context';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const looseObject = z.looseObject({});
const TOKEN = 'live-bearer-token-of-alice';

function setup() {
  const seenTokens: Record<string, unknown> = {};
  const record = (id: string) =>
    createStep({
      id,
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ requestContext }) => {
        seenTokens[id] = requestContext.get(MASTRA_AUTH_TOKEN_KEY);
        return {};
      },
    });
  const approval = createStep({
    id: 'approval',
    inputSchema: looseObject,
    outputSchema: looseObject,
    execute: async ({ requestContext, resumeData, suspend }) => {
      if (!resumeData) return suspend({ reason: 'needs-approval' });
      seenTokens.approval = requestContext.get(MASTRA_AUTH_TOKEN_KEY);
      return {};
    },
  });
  const nested = createWorkflow({ id: 'nested', inputSchema: looseObject, outputSchema: looseObject })
    .then(record('inner'))
    .commit();
  const workflow = createWorkflow({ id: 'token-wf', inputSchema: looseObject, outputSchema: looseObject })
    .then(record('first'))
    .parallel([record('left'), record('right')])
    .map(async () => [{}, {}])
    .foreach(record('each'))
    .map(async () => ({}))
    .then(nested)
    .then(approval)
    .commit();

  const storage = new MockStore();
  const mastra = new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
  return { mastra, storage, workflow, seenTokens };
}

async function spyOnWrites(storage: MockStore) {
  const workflowsStore = (await storage.getStore('workflows'))!;
  const writes: unknown[] = [];
  for (const method of ['persistWorkflowSnapshot', 'updateWorkflowResults', 'updateWorkflowState'] as const) {
    const original = workflowsStore[method].bind(workflowsStore) as (args: unknown) => Promise<unknown>;
    vi.spyOn(workflowsStore, method).mockImplementation(async (args: unknown) => {
      writes.push(structuredClone(args));
      return original(args);
    });
  }
  return { workflowsStore, writes };
}

function withToken(token: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_AUTH_TOKEN_KEY, token);
  requestContext.set('tenant', 'acme');
  return requestContext;
}

describe('evented engine auth token persistence', () => {
  it('keeps the live token out of every snapshot write while steps still see it', async () => {
    const { mastra, storage, workflow, seenTokens } = setup();
    const { workflowsStore, writes } = await spyOnWrites(storage);
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const started = await run.start({ inputData: {}, requestContext: withToken(TOKEN) });
      expect(started.status).toBe('suspended');

      const resumed = await run.resume({
        step: 'approval',
        resumeData: { approved: true },
        requestContext: withToken('fresh-token'),
      });
      expect(resumed.status).toBe('success');

      expect(seenTokens).toEqual({
        first: TOKEN,
        left: TOKEN,
        right: TOKEN,
        each: TOKEN,
        inner: TOKEN,
        approval: 'fresh-token',
      });
      expect(writes.length).toBeGreaterThan(0);
      for (const write of writes) {
        expect(JSON.stringify(write)).not.toContain(MASTRA_AUTH_TOKEN_KEY);
      }

      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      expect(snapshot?.requestContext).toEqual({ tenant: 'acme' });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('does not restore a token left in an older snapshot on resume', async () => {
    const { mastra, storage, workflow, seenTokens } = setup();
    const workflowsStore = (await storage.getStore('workflows'))!;
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {}, requestContext: withToken(TOKEN) })).status).toBe('suspended');

      // Simulate a row written before the token was stripped.
      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
        snapshot: { ...snapshot!, requestContext: { ...snapshot!.requestContext, [MASTRA_AUTH_TOKEN_KEY]: TOKEN } },
      });

      const resumed = await run.resume({ step: 'approval', resumeData: { approved: true } });
      expect(resumed.status).toBe('success');
      expect(seenTokens.approval).toBeUndefined();
    } finally {
      await mastra.stopWorkers();
    }
  });
});
