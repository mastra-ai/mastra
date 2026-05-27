import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { createStep } from '@mastra/core/workflows';
import { Inngest } from 'inngest';
import type { InngestFunction } from 'inngest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { connect } from './connect';
import { InngestWorkflow } from './workflow';

const mocks = vi.hoisted(() => ({
  inngestConnect: vi.fn(async () => ({
    connectionId: 'conn-test',
    close: vi.fn(async () => {}),
    closed: Promise.resolve(),
    state: 'ACTIVE',
    getDebugState: vi.fn(),
  })),
}));

vi.mock('inngest/connect', () => ({ connect: mocks.inngestConnect }));

const { inngestConnect } = mocks;

const getFunctionIds = (functions: InngestFunction.Like[]) =>
  functions.map(fn => {
    if ('id' in fn && typeof fn.id === 'function') {
      return fn.id();
    }
    throw new Error('Expected an Inngest function with an id() method');
  });

function createMastraWithWorkflows(inngest: Inngest) {
  const step = createStep({
    id: 'step',
    execute: async () => ({ result: 'done' }),
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  });

  const nestedWorkflow = new InngestWorkflow(
    {
      id: 'nested-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step],
    },
    inngest,
  );
  nestedWorkflow.then(step).commit();

  const workflow = new InngestWorkflow(
    {
      id: 'test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [nestedWorkflow],
    },
    inngest,
  );
  workflow.then(nestedWorkflow).commit();

  const cronWorkflow = new InngestWorkflow(
    {
      id: 'cron-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step],
      cron: '*/5 * * * *',
    },
    inngest,
  );
  cronWorkflow.then(step).commit();

  return new Mastra({
    storage: new MockStore(),
    workflows: {
      'test-workflow': workflow,
      'cron-workflow': cronWorkflow,
    },
  });
}

describe('connect()', () => {
  let mastra: Mastra;
  let inngest: Inngest;

  beforeEach(() => {
    vi.clearAllMocks();
    inngest = new Inngest({ id: 'test-app' });
    mastra = createMastraWithWorkflows(inngest);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('exports connect as a function', () => {
    expect(typeof connect).toBe('function');
  });

  it('registers normal, nested, cron, and user functions with inngest/connect', async () => {
    const userFunction = inngest.createFunction(
      { id: 'user-function', triggers: { event: 'test/event' } },
      async () => 'done',
    );

    await connect({ mastra, inngest, functions: [userFunction] });

    const connectOptions = inngestConnect.mock.calls[0][0];

    expect(connectOptions.apps).toHaveLength(1);
    expect(connectOptions.apps[0].client).toBe(inngest);
    expect(getFunctionIds(connectOptions.apps[0].functions)).toEqual([
      'workflow.test-workflow',
      'workflow.nested-workflow',
      'workflow.cron-workflow',
      'workflow.cron-workflow.cron',
      'user-function',
    ]);
  });

  it('forwards registerOptions and worker options to inngest/connect', async () => {
    await connect({
      mastra,
      inngest,
      registerOptions: { signingKey: 'test-signing-key' },
      gatewayUrl: 'ws://localhost:8100',
      handleShutdownSignals: [],
      instanceId: 'worker-1',
      maxWorkerConcurrency: 10,
    });

    const callArgs = inngestConnect.mock.calls[0][0];
    expect(callArgs.signingKey).toBe('test-signing-key');
    expect(callArgs.gatewayUrl).toBe('ws://localhost:8100');
    expect(callArgs.handleShutdownSignals).toEqual([]);
    expect(callArgs.instanceId).toBe('worker-1');
    expect(callArgs.maxWorkerConcurrency).toBe(10);
  });

  it('returns the WorkerConnection object from inngest/connect', async () => {
    const connection = await connect({ mastra, inngest });

    expect(connection.connectionId).toBe('conn-test');
    expect(typeof connection.close).toBe('function');
  });

  it('lets registerOptions override overlapping top-level Connect options', async () => {
    await connect({
      mastra,
      inngest,
      signingKey: 'top-level-signing-key',
      registerOptions: { signingKey: 'register-options-signing-key' },
    });

    const callArgs = inngestConnect.mock.calls[0][0];
    expect(callArgs.signingKey).toBe('register-options-signing-key');
  });

  it('warns when called with no Inngest workflows and no additional functions', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emptyMastra = new Mastra({ storage: new MockStore() });

    await connect({ mastra: emptyMastra, inngest });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('no Inngest workflows');
    warnSpy.mockRestore();
  });

  it('does not warn when at least one user function is provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emptyMastra = new Mastra({ storage: new MockStore() });
    const userFunction = inngest.createFunction(
      { id: 'user-function', triggers: { event: 'test/event' } },
      async () => 'done',
    );

    await connect({ mastra: emptyMastra, inngest, functions: [userFunction] });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
