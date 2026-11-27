import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { RequestContext } from '@mastra/core/request-context';
import { PostgresStore } from '@mastra/pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addContextProbes, createCrossHostRuntime } from '../test-fixtures/cross-host-resume';
import type { contextSnapshot } from '../test-fixtures/cross-host-resume';
import { killProcess, spawnFixture, waitFor, waitForLine } from '../test-fixtures/harness';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';
const POSTGRES = process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';

type Observation = ReturnType<typeof contextSnapshot> & { host: string; pid: number; event: string };

describe('evented resume claimed by another host', () => {
  let mock: LLMock;

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    process.env.MASTRA_EVENTED_EXECUTION = 'true';
  });

  afterAll(async () => {
    await mock.stop();
    delete process.env.MASTRA_EVENTED_EXECUTION;
  });

  it('runs the resumed segment with the resuming caller context on the starting host', async () => {
    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'approval-one', name: 'approve', arguments: {} }] },
    );
    mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved.' });

    const schemaName = `xhost_${randomUUID().slice(0, 8)}`;
    const logFile = join(tmpdir(), `${schemaName}.jsonl`);
    const runId = randomUUID();
    const { agent, mastra, storage } = createCrossHostRuntime({
      host: 'A',
      schemaName,
      connectionString: POSTGRES,
      redisUrl: REDIS_URL,
      modelUrl: mock.url,
      logFile,
      worker: true,
    });
    const read = (): Observation[] =>
      readFileSync(logFile, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
    let hostB: ReturnType<typeof spawnFixture> | undefined;
    try {
      await storage.init();
      const requestContext = new RequestContext();
      requestContext.set('resume-marker', 'A');
      requestContext.set('mastra__user', { id: 'alice' });
      addContextProbes(requestContext, 'A');
      const output = await agent.stream('Ask for approval.', {
        runId,
        memory: { thread: runId, resource: 'cross-host' },
        requestContext,
      });
      void output.consumeStream().catch(() => {});
      const workflows = (await storage.getStore('workflows'))!;
      await waitFor(async () => {
        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId });
        return snapshot?.status === 'suspended';
      });
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId });
      expect(snapshot?.context.input).toMatchObject({
        requestContextEntries: { 'resume-marker': 'A', 'session-controller': { sessionId: 'A' } },
      });
      expect(snapshot?.context.input).not.toHaveProperty(['requestContextEntries', 'read-session']);
      const beforeResume = read().length;

      hostB = spawnFixture({
        entry: 'test-fixtures/cross-host-resume.entry.ts',
        env: {
          MASTRA_EVENTED_EXECUTION: 'true',
          MASTRA_WORKERS: 'false',
          CROSS_HOST_SCHEMA: schemaName,
          CROSS_HOST_MODEL_URL: mock.url,
          CROSS_HOST_LOG: logFile,
          CROSS_HOST_RUN_ID: runId,
          POSTGRES_CONNECTION_STRING: POSTGRES,
          REDIS_URL,
        },
      });
      await waitForLine(hostB, /host-b-text:/, 60_000);
      await waitFor(async () =>
        read()
          .slice(beforeResume)
          .some(entry => entry.event === 'output-result'),
      );

      const initial = read().slice(0, beforeResume);
      const resumed = read().slice(beforeResume);
      // COR-1521: on the starting process both handles are live before the run parks.
      expect(initial.find(entry => entry.event === 'llm-request')).toMatchObject({
        host: 'A',
        user: 'alice',
        controllerState: 'A',
        closureResult: 'A',
      });
      expect(resumed.every(entry => entry.host === 'A' && entry.pid === process.pid)).toBe(true);

      const toolExecution = resumed.find(entry => entry.event === 'tool-execute');
      // COR-1660: tool execution still uses the starting caller's live context on this host.
      expect(toolExecution).toMatchObject({ user: 'alice', controllerState: 'A', closureResult: 'A' });

      const resumedSteps = resumed.filter(entry => entry.event !== 'tool-execute');
      const initialExecutions = new Set(initial.flatMap(entry => entry.executionIds));
      for (const entry of resumedSteps) {
        expect(entry.user, entry.event).toBe('bob');
        expect(
          entry.executionIds.some(id => initialExecutions.has(id)),
          entry.event,
        ).toBe(false);
      }
      // The LLM-step processors see the resume's own values. Finalization restores ordinary keys from the
      // run snapshot by design, so the output processor is only checked for identity above.
      expect(
        resumedSteps.filter(entry => entry.event !== 'output-result').map(({ event, marker }) => ({ event, marker })),
      ).toEqual([
        { event: 'input-step', marker: 'B' },
        { event: 'llm-request', marker: 'B' },
      ]);
      // Even on the starting host, a different caller's live handles cannot cross Redis.
      const resumedLlm = resumed.find(entry => entry.event === 'llm-request');
      expect(resumedLlm).toMatchObject({ controller: { sessionId: 'B' } });
      expect(resumedLlm?.controllerState).toBeUndefined();
      expect(resumedLlm?.closurePresent).toBe(false);
      const finalized = resumed.find(entry => entry.event === 'output-result');
      expect(finalized).toMatchObject({ controller: { sessionId: 'A' }, marker: 'A', user: 'bob' });
      expect(finalized?.controllerState).toBeUndefined();
      expect(finalized?.closurePresent).toBe(false);
    } finally {
      if (hostB) await killProcess(hostB);
      await mastra.shutdown();
      const cleanup = new PostgresStore({ id: `${schemaName}_cleanup`, schemaName, connectionString: POSTGRES });
      await cleanup.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await cleanup.close();
      rmSync(logFile, { force: true });
    }
  }, 120_000);

  it('runs resumed tool-result processing as the resuming caller on a worker that rebuilt the run', async () => {
    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'approval-one', name: 'approve', arguments: {} }] },
    );
    mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved.' });

    const schemaName = `xhostw_${randomUUID().slice(0, 8)}`;
    const logFile = join(tmpdir(), `${schemaName}.jsonl`);
    const runId = randomUUID();
    const env = {
      MASTRA_EVENTED_EXECUTION: 'true',
      CROSS_HOST_SCHEMA: schemaName,
      CROSS_HOST_MODEL_URL: mock.url,
      CROSS_HOST_LOG: logFile,
      CROSS_HOST_RUN_ID: runId,
      POSTGRES_CONNECTION_STRING: POSTGRES,
      REDIS_URL,
    };
    // Host A starts the run but runs no steps; worker W runs them all.
    const { agent, mastra, storage } = createCrossHostRuntime({
      host: 'A',
      schemaName,
      connectionString: POSTGRES,
      redisUrl: REDIS_URL,
      modelUrl: mock.url,
      logFile,
      worker: false,
    });
    const read = (): Observation[] =>
      readFileSync(logFile, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
    let worker: ReturnType<typeof spawnFixture> | undefined;
    let hostB: ReturnType<typeof spawnFixture> | undefined;
    try {
      await storage.init();
      worker = spawnFixture({ entry: 'test-fixtures/cross-host-worker.entry.ts', env });
      await waitForLine(worker, /cross-host-worker-ready/, 60_000);

      const requestContext = new RequestContext();
      requestContext.set('resume-marker', 'A');
      requestContext.set('mastra__user', { id: 'alice' });
      addContextProbes(requestContext, 'A');
      const output = await agent.stream('Ask for approval.', {
        runId,
        memory: { thread: runId, resource: 'cross-host' },
        requestContext,
      });
      void output.consumeStream().catch(() => {});
      const workflows = (await storage.getStore('workflows'))!;
      await waitFor(async () => {
        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId });
        return snapshot?.status === 'suspended';
      }, 60_000);
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId });
      expect(snapshot?.context.input).toMatchObject({
        requestContextEntries: { 'resume-marker': 'A', 'session-controller': { sessionId: 'A' } },
      });
      expect(snapshot?.context.input).not.toHaveProperty(['requestContextEntries', 'read-session']);
      const beforeResume = read().length;

      hostB = spawnFixture({
        entry: 'test-fixtures/cross-host-resume.entry.ts',
        env: { ...env, MASTRA_WORKERS: 'false' },
      });
      await waitForLine(hostB, /host-b-text:/, 60_000);
      await waitFor(async () =>
        read()
          .slice(beforeResume)
          .some(entry => entry.event === 'tool-result'),
      );

      const initial = read().slice(0, beforeResume);
      const resumed = read().slice(beforeResume);
      // COR-1521: the first model step on the worker already receives a method-less controller.
      const initialLlm = initial.find(entry => entry.event === 'llm-request');
      expect(initialLlm).toMatchObject({ host: 'W', user: 'alice', marker: 'A', controller: { sessionId: 'A' } });
      expect(initialLlm?.pid).not.toBe(process.pid);
      expect(initialLlm?.controllerState).toBeUndefined();
      expect(initialLlm?.closurePresent).toBe(false);

      const toolResults = resumed.filter(entry => entry.event === 'tool-result');
      expect(toolResults.length).toBeGreaterThan(0);
      for (const entry of toolResults) {
        expect(entry).toMatchObject({ host: 'W', user: 'bob', marker: 'B', controller: { sessionId: 'B' } });
        expect(entry.controllerState).toBeUndefined();
        expect(entry.closurePresent).toBe(false);
      }
    } finally {
      if (hostB) await killProcess(hostB);
      if (worker) await killProcess(worker);
      await mastra.shutdown();
      const cleanup = new PostgresStore({ id: `${schemaName}_cleanup`, schemaName, connectionString: POSTGRES });
      await cleanup.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await cleanup.close();
      rmSync(logFile, { force: true });
    }
  }, 180_000);
});
