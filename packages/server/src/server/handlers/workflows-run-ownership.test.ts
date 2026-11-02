import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MASTRA_RESOURCE_ID_KEY } from '../constants';
import { createTestServerContext } from './test-utils';
import {
  CREATE_WORKFLOW_RUN_ROUTE,
  EXECUTE_WORKFLOW_STEP_ROUTE,
  RECEIVE_WORKFLOW_EVENT_ROUTE,
  RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ASYNC_ROUTE,
  RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE,
  GET_WORKFLOW_RUN_BY_ID_ROUTE,
  START_ASYNC_WORKFLOW_ROUTE,
  STREAM_LEGACY_WORKFLOW_ROUTE,
  STREAM_WORKFLOW_ROUTE,
} from './workflows';

async function setup({
  mapper,
  fga = false,
  runResourceId,
}: {
  mapper: boolean;
  fga?: boolean;
  runResourceId?: string;
}) {
  const step = createStep({
    id: 's',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async () => ({ ok: true }),
  });
  const workflow = createWorkflow({
    id: 'wf',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    steps: [step],
  })
    .then(step)
    .commit();
  const auth = {
    authenticateToken: async () => ({ id: 'bob' }),
    ...(mapper ? { mapUserToResourceId: (user: { id: string }) => user.id } : {}),
  };
  const mastra = new Mastra({
    logger: false,
    workflows: { wf: workflow },
    storage: new MockStore(),
    server: {
      auth: auth as any,
      ...(fga
        ? {
            fga: {
              check: async () => true,
              require: async () => {},
              filterAccessible: async (_u: unknown, r: unknown[]) => r,
            } as any,
          }
        : {}),
    },
  });
  const run = await mastra.getWorkflow('wf').createRun({ resourceId: runResourceId });
  await run.start({ inputData: {} });
  return { mastra, runId: run.runId };
}

function caller(resourceId?: string) {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'bob' });
  if (resourceId) requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return requestContext;
}

function read(mastra: Mastra, runId: string, requestContext: RequestContext) {
  return GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
    ...createTestServerContext({ mastra }),
    requestContext,
    workflowId: 'wf',
    runId,
  } as any);
}

function call(
  route: { handler: (args: any) => unknown },
  mastra: Mastra,
  runId: string,
  requestContext: RequestContext,
) {
  return Promise.resolve().then(() =>
    route.handler({
      ...createTestServerContext({ mastra }),
      requestContext,
      workflowId: 'wf',
      runId,
      inputData: {},
    } as any),
  );
}

describe('with a resource mapper, a scoped caller', () => {
  it("is denied another tenant's run (control)", async () => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(read(mastra, runId, caller('tenant-b'))).rejects.toMatchObject({ status: 403 });
  });

  it('reads its own run', async () => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(read(mastra, runId, caller('tenant-a'))).resolves.toMatchObject({ runId });
  });

  it('is denied a run persisted without a resource id', async () => {
    const { mastra, runId } = await setup({ mapper: true });
    await expect(read(mastra, runId, caller('tenant-b'))).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['/stream', STREAM_WORKFLOW_ROUTE],
    ['/create-run', CREATE_WORKFLOW_RUN_ROUTE],
    ['/start-async', START_ASYNC_WORKFLOW_ROUTE],
    ['/stream-legacy', STREAM_LEGACY_WORKFLOW_ROUTE],
  ])("is denied %s against another tenant's existing run id", async (_path, route) => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(call(route, mastra, runId, caller('tenant-b'))).rejects.toMatchObject({ status: 403 });
  });
});

describe('with a resource mapper, an unscoped caller', () => {
  it('is denied an owned run without FGA', async () => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(read(mastra, runId, caller())).rejects.toMatchObject({ status: 403 });
  });

  it('is denied an owner-less run without FGA', async () => {
    const { mastra, runId } = await setup({ mapper: true });
    await expect(read(mastra, runId, caller())).rejects.toMatchObject({ status: 403 });
  });

  it('keeps privileged access when FGA authorizes the route', async () => {
    for (const runResourceId of ['tenant-a', undefined]) {
      const { mastra, runId } = await setup({ mapper: true, fga: true, runResourceId });
      await expect(read(mastra, runId, caller())).resolves.toMatchObject({ runId });
    }
  });
});

describe('without a resource mapper (behaviour unchanged)', () => {
  it('lets an unscoped caller read owned and owner-less runs', async () => {
    for (const runResourceId of ['tenant-a', undefined]) {
      const { mastra, runId } = await setup({ mapper: false, runResourceId });
      await expect(read(mastra, runId, caller())).resolves.toMatchObject({ runId });
    }
  });

  it('lets a scoped caller read an owner-less run', async () => {
    const { mastra, runId } = await setup({ mapper: false });
    await expect(read(mastra, runId, caller('tenant-b'))).resolves.toMatchObject({ runId });
  });

  it("still denies a scoped caller another tenant's run", async () => {
    const { mastra, runId } = await setup({ mapper: false, runResourceId: 'tenant-a' });
    await expect(read(mastra, runId, caller('tenant-b'))).rejects.toMatchObject({ status: 403 });
  });
});

describe('restart-all-active-workflow-runs', () => {
  const routes = [
    ['async', RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ASYNC_ROUTE],
    ['fire-and-forget', RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE],
  ] as const;

  it.each(routes)("%s denies a mapped caller restarting every owner's runs", async (_name, route) => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(call(route, mastra, runId, caller('tenant-a'))).rejects.toMatchObject({ status: 403 });
  });

  it.each(routes)('%s denies an unscoped caller without FGA when a mapper is configured', async (_name, route) => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(call(route, mastra, runId, caller())).rejects.toMatchObject({ status: 403 });
  });

  it.each(routes)('%s allows an unscoped caller with FGA, or without a mapper', async (_name, route) => {
    for (const opts of [{ mapper: true, fga: true }, { mapper: false }]) {
      const { mastra, runId } = await setup({ ...opts, runResourceId: 'tenant-a' });
      await expect(call(route, mastra, runId, caller())).resolves.toBeDefined();
    }
  });
});

describe('worker routes that address a run', () => {
  function executeStep(mastra: Mastra, runId: string, requestContext: RequestContext) {
    return Promise.resolve().then(() =>
      EXECUTE_WORKFLOW_STEP_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        workflowId: 'wf',
        runId,
        stepId: 's',
        executionPath: [0],
        stepResults: {},
        state: {},
        input: {},
        requestContext,
      } as any),
    );
  }

  function receiveEvent(mastra: Mastra, runId: string, requestContext: RequestContext) {
    return Promise.resolve().then(() =>
      RECEIVE_WORKFLOW_EVENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        event: {
          id: 'e1',
          type: 'workflow.step.run',
          data: { workflowId: 'wf' },
          runId,
          createdAt: new Date().toISOString(),
        },
        requestContext,
      } as any),
    );
  }

  it.each([
    ['steps/execute', executeStep],
    ['/workflows/events', receiveEvent],
  ])("%s denies a mapped caller another tenant's run", async (_name, send) => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(send(mastra, runId, caller('tenant-b'))).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['steps/execute', executeStep],
    ['/workflows/events', receiveEvent],
  ])('%s denies an unscoped caller without FGA when a mapper is configured', async (_name, send) => {
    const { mastra, runId } = await setup({ mapper: true, runResourceId: 'tenant-a' });
    await expect(send(mastra, runId, caller())).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['steps/execute', executeStep],
    ['/workflows/events', receiveEvent],
  ])('%s passes the ownership check for an unscoped caller without a mapper', async (_name, send) => {
    const { mastra, runId } = await setup({ mapper: false, runResourceId: 'tenant-a' });
    await send(mastra, runId, caller()).catch((error: { status?: number }) => expect(error?.status).not.toBe(403));
  });
});
