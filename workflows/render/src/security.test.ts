import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import type { TaskContext } from '@renderinc/sdk/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { init, createMemoryPersistence } from './index.js';
import { registerRenderTasks } from './worker.js';
import { authorizeDispatch, submissionHash, verifyDispatch } from './authorization.js';
import type { StepEnvelope } from './protocol.js';
import type { RunRecord } from './persistence/types.js';

describe('generated task authorization', () => {
  it.each([false, true])('rejects a fabricated child before effects (existing run: %s)', async existing => {
    let effects = 0;
    const store = createMemoryPersistence();
    const h = init({
      workflowSlug: 'security',
      buildId: 'v1',
      persistence: store,
      transport: { start: async () => 'native', get: async id => ({ id, status: 'running' }), cancel: async () => {} },
    });
    const step = h.createStep({
      id: 'effect',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async () => ++effects,
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    const definitions = registerRenderTasks({ mastra: new Mastra({ workflows: { workflow }, logger: false }) });
    const manifest = h.provider.workflows.get(workflow.id)!.manifest();
    const runId = randomUUID();
    if (existing)
      await store.create({
        workflowId: workflow.id,
        runId,
        buildId: 'v1',
        manifest: manifest.hash,
        revision: 0,
        status: 'running',
        workerClaim: 'a-secret-the-caller-does-not-have',
        input: 1,
        initialState: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    const envelope = {
      version: 1,
      workflowId: workflow.id,
      runId,
      buildId: 'v1',
      manifest: manifest.hash,
      input: 1,
      state: {},
      requestContext: {},
      stepKey: 'effect',
      executionKey: 'one',
      initialInput: 1,
      priorOutputs: {},
      readOnly: false,
    };
    const context: TaskContext = {
      run: async () => {
        throw new Error('unexpected dispatch');
      },
    };
    await expect(definitions.get(manifest.steps.get('effect')!.name)!.func(context, envelope)).rejects.toThrow();
    expect(effects).toBe(0);
  });
});

function authorizedFixture() {
  const envelope: StepEnvelope = {
    version: 1,
    workflowId: 'w',
    runId: 'r',
    resourceId: 'alice',
    buildId: 'b',
    manifest: 'm',
    stepKey: 's',
    executionKey: '["r",0,"s",1]',
    input: { a: 1, b: 2 },
    state: {},
    requestContext: {},
    initialInput: 1,
    priorOutputs: {},
    readOnly: true,
  };
  const record: RunRecord = {
    workflowId: 'w',
    runId: 'r',
    resourceId: 'alice',
    buildId: 'b',
    manifest: 'm',
    revision: 0,
    status: 'running',
    workerClaim: 'private-root-secret',
    dispatchClosed: false,
    dispatchExpiresAt: Date.now() + 60000,
    input: 1,
    initialState: {},
    createdAt: 0,
    updatedAt: 0,
  };
  return { record, signed: authorizeDispatch(envelope, record.workerClaim!) };
}

describe('dispatch proof boundaries', () => {
  it.each([
    'input',
    'state',
    'requestContext',
    'initialInput',
    'priorOutputs',
    'readOnly',
    'stepKey',
    'executionKey',
    'resourceId',
    'workflowId',
    'runId',
    'buildId',
    'manifest',
  ] as const)('rejects tampered %s', key => {
    const { record, signed } = authorizedFixture();
    expect(() => verifyDispatch({ ...signed, [key]: 'changed' }, record)).toThrow();
  });
  it.each(['success', 'failed', 'canceled', 'cancel-requested', 'pending', 'submission-unknown'] as const)(
    'rejects a parent in %s',
    status => {
      const { record, signed } = authorizedFixture();
      expect(() => verifyDispatch(signed, { ...record, status })).toThrow();
    },
  );
  it.each(['closed', 'expired', 'unclaimed', 'replaced'] as const)('rejects %s dispatch authority', kind => {
    const { record, signed } = authorizedFixture();
    const changed = {
      ...record,
      ...(kind === 'closed' ? { dispatchClosed: true } : {}),
      ...(kind === 'expired' ? { dispatchExpiresAt: Date.now() - 1 } : {}),
      ...(kind === 'unclaimed' ? { workerClaim: undefined } : {}),
      ...(kind === 'replaced' ? { workerClaim: 'different-root' } : {}),
    };
    expect(() => verifyDispatch(signed, changed)).toThrow();
  });
  it('preserves legitimate retry authorization and JSON key reordering without exposing the secret', () => {
    const { record, signed } = authorizedFixture();
    verifyDispatch(signed, record);
    verifyDispatch(JSON.parse(JSON.stringify({ ...signed, input: { b: 2, a: 1 } })), record);
    expect(JSON.stringify(signed)).not.toContain(record.workerClaim);
  });
  it('signs prototype-related own properties as data and rejects their tampering', () => {
    const { record, signed } = authorizedFixture();
    const envelope = { ...signed, input: JSON.parse('{"__proto__":{"admin":true},"constructor":"data"}') };
    const authorized = authorizeDispatch(envelope, record.workerClaim!);
    const received = JSON.parse(JSON.stringify(authorized));
    expect(() => verifyDispatch(received, record)).not.toThrow();
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    received.input.__proto__.admin = false;
    expect(() => verifyDispatch(received, record)).toThrow('does not match');
  });
  it('binds the root to its input, state and request context', () => {
    const root = {
      version: 1 as const,
      workflowId: 'w',
      runId: 'r',
      buildId: 'b',
      manifest: 'm',
      input: 1,
      state: {},
      requestContext: {},
    };
    for (const key of ['input', 'state', 'requestContext'])
      expect(submissionHash({ ...root, [key]: { changed: true } })).not.toBe(submissionHash(root));
  });
});
