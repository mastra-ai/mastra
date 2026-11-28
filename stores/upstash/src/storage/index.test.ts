import { randomUUID } from 'node:crypto';
import {
  createTestSuite,
  createConfigValidationTests,
  createClientAcceptanceTests,
  createDomainDirectTests,
} from '@internal/storage-test-utils';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { Redis } from '@upstash/redis';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StoreMemoryUpstash } from './domains/memory';
import { ScoresUpstash } from './domains/scores';
import { getKey } from './domains/utils';
import { WorkflowsUpstash } from './domains/workflows';
import { UpstashStore } from './index';

vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const TEST_CONFIG = {
  url: 'http://localhost:8079',
  token: 'test_token',
};

// Helper to create a fresh client for each test
const createTestClient = () =>
  new Redis({
    url: TEST_CONFIG.url,
    token: TEST_CONFIG.token,
  });

const createThread = (resourceId = `resource-${randomUUID()}`): StorageThreadType => ({
  id: `thread-${randomUUID()}`,
  resourceId,
  title: 'Test Thread',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createMessage = (thread: StorageThreadType, overrides: Partial<MastraDBMessage> = {}): MastraDBMessage => ({
  id: overrides.id ?? randomUUID(),
  threadId: overrides.threadId ?? thread.id,
  resourceId: overrides.resourceId ?? thread.resourceId,
  role: overrides.role ?? 'user',
  createdAt: overrides.createdAt ?? new Date(),
  content: overrides.content ?? {
    format: 2,
    parts: [{ type: 'text', text: 'Test message' }],
    content: 'Test message',
  },
});

const createWorkflowSnapshot = (runId: string, status: WorkflowRunState['status']): WorkflowRunState => ({
  runId,
  status,
  value: {},
  context: {},
  activePaths: [],
  suspendedPaths: {},
  activeStepsPath: {},
  serializedStepGraph: [],
  waitingPaths: {},
  resumeLabels: {},
  timestamp: Date.now(),
});

// The key a workflow snapshot is stored under. `resourceId` is the legacy
// resource-suffixed variant; the canonical key omits it.
const snapshotKey = (workflowName: string, runId: string, resourceId?: string) =>
  getKey(TABLE_WORKFLOW_SNAPSHOT, {
    namespace: 'workflows',
    workflow_name: workflowName,
    run_id: runId,
    ...(resourceId ? { resourceId } : {}),
  });

// Writes a snapshot record straight to a raw key, as a pre-canonical Upstash
// release would have, so tests can seed legacy-shaped records.
const seedWorkflowRecord = async (
  client: Redis,
  {
    key,
    workflowName,
    runId,
    resourceId,
    status,
    createdAt,
    updatedAt,
  }: {
    key: string;
    workflowName: string;
    runId: string;
    resourceId?: string;
    status: WorkflowRunState['status'];
    createdAt: Date;
    updatedAt: Date;
  },
) => {
  await client.set(
    key,
    JSON.stringify({
      namespace: 'workflows',
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
      snapshot: createWorkflowSnapshot(runId, status),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    }),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

createTestSuite(
  new UpstashStore({
    id: 'upstash-test-store',
    ...TEST_CONFIG,
  }),
  { deterministicScorePagination: true, workflowResultsNoopWhenRunMissing: false },
);

// Configuration validation tests
createConfigValidationTests({
  storeName: 'UpstashStore',
  createStore: config => new UpstashStore(config as any),
  validConfigs: [
    {
      description: 'URL/token config',
      config: { id: 'test-store', url: 'http://localhost:8079', token: 'test-token' },
    },
    { description: 'pre-configured client', config: { id: 'test-store', client: createTestClient() } },
    {
      description: 'disableInit with URL config',
      config: { id: 'test-store', url: 'http://localhost:8079', token: 'test-token', disableInit: true },
    },
    {
      description: 'disableInit with client config',
      config: { id: 'test-store', client: createTestClient(), disableInit: true },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty url',
      config: { id: 'test-store', url: '', token: 'test-token' },
      expectedError: /url is required/i,
    },
    {
      description: 'empty token',
      config: { id: 'test-store', url: 'http://localhost:8079', token: '' },
      expectedError: /token is required/i,
    },
  ],
});

// Pre-configured client acceptance tests
createClientAcceptanceTests({
  storeName: 'UpstashStore',
  expectedStoreName: 'Upstash',
  createStoreWithClient: () =>
    new UpstashStore({
      id: 'upstash-client-test',
      client: createTestClient(),
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'Upstash',
  createMemoryDomain: () => new StoreMemoryUpstash({ client: createTestClient() }),
  createWorkflowsDomain: () => new WorkflowsUpstash({ client: createTestClient() }),
  createScoresDomain: () => new ScoresUpstash({ client: createTestClient() }),
});

// Additional Upstash-specific tests
describe('Upstash Domain with URL/token config', () => {
  it('should allow domains to use url/token config directly', async () => {
    const memoryDomain = new StoreMemoryUpstash({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    expect(memoryDomain).toBeDefined();
    await memoryDomain.init();

    const thread = {
      id: `thread-url-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test URL Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await memoryDomain.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    await memoryDomain.deleteThread({ threadId: thread.id });
  });
});

describe('saveMessages uses msg-idx index instead of scanning', () => {
  it('uses index lookup instead of scan when moving a message between threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    // Save message to source thread (creates msg-idx entry)
    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    await new Promise(resolve => setTimeout(resolve, 10));

    const client = (memoryDomain as any).client as Redis;
    const scanSpy = vi.spyOn(client, 'scan');

    // Move same message ID to target thread
    const movedMessage = createMessage(targetThread, {
      id: originalMessage.id,
      resourceId: targetThread.resourceId,
    });
    await memoryDomain.saveMessages({ messages: [movedMessage] });

    // Should not scan — used msg-idx index
    expect(scanSpy).not.toHaveBeenCalled();

    // Message should be removed from source and exist in target
    const { messages: sourceMessages } = await memoryDomain.listMessages({ threadId: sourceThread.id });
    const { messages: targetMessages } = await memoryDomain.listMessages({ threadId: targetThread.id });
    expect(sourceMessages.find(m => m.id === originalMessage.id)).toBeUndefined();
    expect(targetMessages.find(m => m.id === originalMessage.id)?.threadId).toBe(targetThread.id);
  });

  it('does not scan for new messages without an index entry', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const thread = createThread();
    await memoryDomain.saveThread({ thread });

    const client = (memoryDomain as any).client as Redis;
    const scanSpy = vi.spyOn(client, 'scan');

    // Save a brand new message
    const message = createMessage(thread);
    await memoryDomain.saveMessages({ messages: [message] });

    // Should not scan — new message, no index, just skip
    expect(scanSpy).not.toHaveBeenCalled();

    // Message should exist
    const { messages } = await memoryDomain.listMessages({ threadId: thread.id });
    expect(messages.find(m => m.id === message.id)?.threadId).toBe(thread.id);
  });

  it('updates both touched thread timestamps when moving a message between threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    const beforeMoveSourceThread = await memoryDomain.getThreadById({ threadId: sourceThread.id });
    const beforeMoveTargetThread = await memoryDomain.getThreadById({ threadId: targetThread.id });

    await new Promise(resolve => setTimeout(resolve, 10));

    const movedMessage = createMessage(targetThread, {
      id: originalMessage.id,
      resourceId: targetThread.resourceId,
    });
    await memoryDomain.saveMessages({ messages: [movedMessage] });

    const afterMoveSourceThread = await memoryDomain.getThreadById({ threadId: sourceThread.id });
    const afterMoveTargetThread = await memoryDomain.getThreadById({ threadId: targetThread.id });

    expect(new Date(afterMoveSourceThread!.updatedAt).getTime()).toBeGreaterThan(
      new Date(beforeMoveSourceThread!.updatedAt).getTime(),
    );
    expect(new Date(afterMoveTargetThread!.updatedAt).getTime()).toBeGreaterThan(
      new Date(beforeMoveTargetThread!.updatedAt).getTime(),
    );
  });

  it('rejects the batch when any target thread does not exist', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const existingThread = createThread();
    const missingThread = createThread(existingThread.resourceId);
    await memoryDomain.saveThread({ thread: existingThread });

    const validMessage = createMessage(existingThread);
    const invalidMessage = createMessage(missingThread);

    await expect(
      memoryDomain.saveMessages({
        messages: [validMessage, invalidMessage],
      }),
    ).rejects.toThrow(`Thread ${missingThread.id} not found`);

    const { messages } = await memoryDomain.listMessages({ threadId: existingThread.id });
    expect(messages).toHaveLength(0);
  });
});

describe('updateMessages keeps msg-idx index in sync', () => {
  it('updates the index and returns the moved message when a message changes threads', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const targetThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });
    await memoryDomain.saveThread({ thread: targetThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    const updatedMessages = await memoryDomain.updateMessages({
      messages: [{ id: originalMessage.id, threadId: targetThread.id }],
    });

    expect(updatedMessages).toHaveLength(1);
    expect(updatedMessages[0]!.threadId).toBe(targetThread.id);

    const client = (memoryDomain as any).client as Redis;
    expect(await client.get<string>(`msg-idx:${originalMessage.id}`)).toBe(targetThread.id);

    const { messages } = await memoryDomain.listMessagesById({ messageIds: [originalMessage.id] });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.threadId).toBe(targetThread.id);
  });

  it('rejects moving a message to a missing thread without mutating stored data', async () => {
    const memoryDomain = new StoreMemoryUpstash({ client: createTestClient() });
    await memoryDomain.init();

    const sourceThread = createThread();
    const missingThread = createThread(sourceThread.resourceId);
    await memoryDomain.saveThread({ thread: sourceThread });

    const originalMessage = createMessage(sourceThread);
    await memoryDomain.saveMessages({ messages: [originalMessage] });

    await expect(
      memoryDomain.updateMessages({
        messages: [{ id: originalMessage.id, threadId: missingThread.id }],
      }),
    ).rejects.toThrow(`Thread ${missingThread.id} not found`);

    const client = (memoryDomain as any).client as Redis;
    expect(await client.get<string>(`msg-idx:${originalMessage.id}`)).toBe(sourceThread.id);

    const { messages } = await memoryDomain.listMessages({ threadId: sourceThread.id });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.threadId).toBe(sourceThread.id);
  });
});

describe('StoreMemoryUpstash error propagation (no empty-on-error)', () => {
  // These reads used to swallow DB errors and return an empty page, so an outage
  // looked exactly like "no data". They should throw instead.
  const createFailingDomain = () => {
    const client = {
      // listThreads scans keys first
      scan: vi.fn().mockRejectedValue(new Error('simulated backend outage')),
      // listMessages reads the thread's sorted set first
      zrange: vi.fn().mockRejectedValue(new Error('simulated backend outage')),
      pipeline: vi.fn(),
    };
    return new StoreMemoryUpstash({ client: client as any });
  };

  // Also check the cause is the original error, so a broken mock can't pass as
  // a real outage.
  const expectOutage = async (promise: Promise<unknown>, idPattern: RegExp) => {
    const err: any = await promise.then(
      () => {
        throw new Error('expected the read to reject, but it resolved');
      },
      e => e,
    );
    expect(err).toMatchObject({ id: expect.stringMatching(idPattern) });
    expect(String(err?.cause?.message ?? err?.message)).toContain('simulated backend outage');
  };

  it('listThreads re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listThreads({}), /LIST_THREADS.*FAILED/);
  });

  it('listMessages re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listMessages({ threadId: 'thread-err' }), /LIST_MESSAGES.*FAILED/);
  });
});

describe('WorkflowsUpstash.persistWorkflowSnapshot', () => {
  it('preserves, loads, and deletes a resource-scoped workflow run', async () => {
    const workflowsDomain = new WorkflowsUpstash({ client: createTestClient() });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const resourceId = `resource-${randomUUID()}`;
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const updatedAt = new Date('2024-06-01T12:00:00.000Z');

    await workflowsDomain.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId,
      snapshot: createWorkflowSnapshot(runId, 'running'),
      createdAt,
      updatedAt: createdAt,
    });

    await workflowsDomain.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId,
      snapshot: createWorkflowSnapshot(runId, 'success'),
      updatedAt,
    });

    const loaded = await workflowsDomain.loadWorkflowSnapshot({ namespace: 'workflows', workflowName, runId });
    expect(loaded?.status).toBe('success');

    const fetched = await workflowsDomain.getWorkflowRunById({ runId, workflowName });
    expect(fetched?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(fetched?.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    expect(fetched?.resourceId).toBe(resourceId);

    await workflowsDomain.deleteWorkflowRunById({ runId, workflowName });

    await expect(
      workflowsDomain.loadWorkflowSnapshot({ namespace: 'workflows', workflowName, runId }),
    ).resolves.toBeNull();
    await expect(workflowsDomain.getWorkflowRunById({ runId, workflowName })).resolves.toBeNull();
  });

  it('leaves no record behind across the reported issue sequence', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const resourceId = `resource-${randomUUID()}`;
    const canonicalKey = snapshotKey(workflowName, runId);
    const legacyKey = snapshotKey(workflowName, runId, resourceId);

    await workflowsDomain.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId,
      snapshot: createWorkflowSnapshot(runId, 'running'),
    });

    // Each update used to write a different key than persist did, splitting the run.
    await workflowsDomain.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 'step-1',
      result: { status: 'success' } as any,
      requestContext: { key: 'value' },
    });

    await workflowsDomain.updateWorkflowState({
      workflowName,
      runId,
      opts: { status: 'success' },
    });

    await workflowsDomain.deleteWorkflowRunById({ runId, workflowName });

    await expect(
      workflowsDomain.loadWorkflowSnapshot({ namespace: 'workflows', workflowName, runId }),
    ).resolves.toBeNull();
    await expect(workflowsDomain.getWorkflowRunById({ runId, workflowName })).resolves.toBeNull();

    const filtered = await workflowsDomain.listWorkflowRuns({ workflowName, resourceId });
    expect(filtered.runs).toHaveLength(0);
    expect(filtered.total).toBe(0);

    const unfiltered = await workflowsDomain.listWorkflowRuns({ workflowName });
    expect(unfiltered.runs).toHaveLength(0);
    expect(unfiltered.total).toBe(0);

    expect(await client.get(canonicalKey)).toBeNull();
    expect(await client.get(legacyKey)).toBeNull();
  });

  it('migrates a legacy-only record to the canonical key on update', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const resourceId = `resource-${randomUUID()}`;
    const createdAt = new Date('2024-02-01T00:00:00.000Z');
    const updatedAt = new Date('2024-03-01T00:00:00.000Z');

    // updateWorkflowResults against a record that only exists under the legacy key.
    const resultsRunId = `run-${randomUUID()}`;
    await seedWorkflowRecord(client, {
      key: snapshotKey(workflowName, resultsRunId, resourceId),
      workflowName,
      runId: resultsRunId,
      resourceId,
      status: 'running',
      createdAt,
      updatedAt,
    });

    await workflowsDomain.updateWorkflowResults({
      workflowName,
      runId: resultsRunId,
      stepId: 'step-1',
      result: { status: 'success' } as any,
      requestContext: {},
    });

    const resultsCanonical = (await client.get(snapshotKey(workflowName, resultsRunId))) as any;
    expect(resultsCanonical).not.toBeNull();
    expect(resultsCanonical.createdAt).toBe(createdAt.toISOString());
    expect(resultsCanonical.resourceId).toBe(resourceId);
    expect(resultsCanonical.snapshot.context['step-1']).toEqual({ status: 'success' });
    expect(await client.get(snapshotKey(workflowName, resultsRunId, resourceId))).toBeNull();

    // updateWorkflowState against a separate legacy-only record.
    const stateRunId = `run-${randomUUID()}`;
    await seedWorkflowRecord(client, {
      key: snapshotKey(workflowName, stateRunId, resourceId),
      workflowName,
      runId: stateRunId,
      resourceId,
      status: 'running',
      createdAt,
      updatedAt,
    });

    const updated = await workflowsDomain.updateWorkflowState({
      workflowName,
      runId: stateRunId,
      opts: { status: 'success' },
    });
    expect(updated?.status).toBe('success');

    const stateCanonical = (await client.get(snapshotKey(workflowName, stateRunId))) as any;
    expect(stateCanonical).not.toBeNull();
    expect(stateCanonical.createdAt).toBe(createdAt.toISOString());
    expect(stateCanonical.resourceId).toBe(resourceId);
    expect(await client.get(snapshotKey(workflowName, stateRunId, resourceId))).toBeNull();
  });

  it('treats existing canonical and legacy copies as one run', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const resourceId = `resource-${randomUUID()}`;
    const canonicalKey = snapshotKey(workflowName, runId);
    const legacyKey = snapshotKey(workflowName, runId, resourceId);
    const createdAt = new Date('2024-04-01T00:00:00.000Z');

    await seedWorkflowRecord(client, {
      key: canonicalKey,
      workflowName,
      runId,
      resourceId,
      status: 'success',
      createdAt,
      updatedAt: new Date('2024-05-02T00:00:00.000Z'),
    });
    await seedWorkflowRecord(client, {
      key: legacyKey,
      workflowName,
      runId,
      resourceId,
      status: 'failed',
      createdAt,
      updatedAt: new Date('2024-05-01T00:00:00.000Z'),
    });

    // Point reads prefer the canonical copy.
    const loaded = await workflowsDomain.loadWorkflowSnapshot({ namespace: 'workflows', workflowName, runId });
    expect(loaded?.status).toBe('success');
    const fetched = await workflowsDomain.getWorkflowRunById({ runId, workflowName });
    expect((fetched?.snapshot as WorkflowRunState).status).toBe('success');

    // Lists show the run once, with the canonical copy's data.
    const runs = await workflowsDomain.listWorkflowRuns({ workflowName });
    expect(runs.runs).toHaveLength(1);
    expect(runs.total).toBe(1);
    expect((runs.runs[0]!.snapshot as WorkflowRunState).status).toBe('success');

    const byResource = await workflowsDomain.listWorkflowRuns({ workflowName, resourceId });
    expect(byResource.total).toBe(1);
    expect((byResource.runs[0]!.snapshot as WorkflowRunState).status).toBe('success');

    // Deletion clears both copies.
    await workflowsDomain.deleteWorkflowRunById({ runId, workflowName });
    expect(await client.get(canonicalKey)).toBeNull();
    expect(await client.get(legacyKey)).toBeNull();
    await expect(workflowsDomain.getWorkflowRunById({ runId, workflowName })).resolves.toBeNull();
  });

  it('re-persisting a raw legacy record writes canonical and drops the legacy key', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const resourceId = `resource-${randomUUID()}`;
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const legacyKey = snapshotKey(workflowName, runId, resourceId);

    await seedWorkflowRecord(client, {
      key: legacyKey,
      workflowName,
      runId,
      resourceId,
      status: 'running',
      createdAt,
      updatedAt: createdAt,
    });

    await workflowsDomain.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId,
      snapshot: createWorkflowSnapshot(runId, 'success'),
      updatedAt: new Date('2024-06-01T12:00:00.000Z'),
    });

    const canonical = (await client.get(snapshotKey(workflowName, runId))) as any;
    expect(canonical).not.toBeNull();
    expect((canonical.snapshot as WorkflowRunState).status).toBe('success');
    expect(canonical.createdAt).toBe(createdAt.toISOString());
    expect(canonical.resourceId).toBe(resourceId);
    expect(await client.get(legacyKey)).toBeNull();
  });

  it('deletes every legacy copy even when no canonical key was ever written', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const firstResource = `resource-${randomUUID()}`;
    const secondResource = `resource-${randomUUID()}`;
    const createdAt = new Date('2024-07-01T00:00:00.000Z');

    // The same run written by two pre-canonical releases, under two resource-suffixed keys.
    for (const resourceId of [firstResource, secondResource]) {
      await seedWorkflowRecord(client, {
        key: snapshotKey(workflowName, runId, resourceId),
        workflowName,
        runId,
        resourceId,
        status: 'running',
        createdAt,
        updatedAt: createdAt,
      });
    }

    await workflowsDomain.deleteWorkflowRunById({ runId, workflowName });

    expect(await client.get(snapshotKey(workflowName, runId))).toBeNull();
    expect(await client.get(snapshotKey(workflowName, runId, firstResource))).toBeNull();
    expect(await client.get(snapshotKey(workflowName, runId, secondResource))).toBeNull();
    expect((await workflowsDomain.listWorkflowRuns({ workflowName })).total).toBe(0);
  });

  it('finds and migrates a run split across a resource-less canonical copy and a legacy copy', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const resourceId = `resource-${randomUUID()}`;
    const canonicalKey = snapshotKey(workflowName, runId);
    const legacyKey = snapshotKey(workflowName, runId, resourceId);
    const createdAt = new Date('2024-08-01T00:00:00.000Z');

    // The pre-fix split: an update wrote the canonical key without knowing the
    // resourceId, while the original legacy copy still carries it.
    await seedWorkflowRecord(client, {
      key: canonicalKey,
      workflowName,
      runId,
      status: 'success',
      createdAt,
      updatedAt: new Date('2024-08-03T00:00:00.000Z'),
    });
    await seedWorkflowRecord(client, {
      key: legacyKey,
      workflowName,
      runId,
      resourceId,
      status: 'running',
      createdAt,
      updatedAt: new Date('2024-08-02T00:00:00.000Z'),
    });

    // A resource-scoped listing must still see the run (resourceId adopted from
    // the legacy sibling), collapsed to a single entry.
    const byResource = await workflowsDomain.listWorkflowRuns({ workflowName, resourceId });
    expect(byResource.total).toBe(1);
    expect(byResource.runs).toHaveLength(1);
    expect(byResource.runs[0]!.resourceId).toBe(resourceId);

    // An update must fold the legacy copy into the canonical one, adopting the
    // resourceId and dropping the legacy key.
    await workflowsDomain.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 'step-1',
      result: { status: 'success' } as any,
      requestContext: { key: 'value' },
    });

    const canonical = (await client.get(canonicalKey)) as any;
    expect(canonical).not.toBeNull();
    expect(canonical.resourceId).toBe(resourceId);
    expect(await client.get(legacyKey)).toBeNull();

    const afterUpdate = await workflowsDomain.listWorkflowRuns({ workflowName, resourceId });
    expect(afterUpdate.total).toBe(1);
    expect((afterUpdate.runs[0]!.snapshot as WorkflowRunState).status).toBe('success');
  });

  it('does not delete other runs when the runId contains a glob character', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const victimRunId = `run-${randomUUID()}`;
    const victimResource = `resource-${randomUUID()}`;
    const createdAt = new Date('2024-09-01T00:00:00.000Z');

    await seedWorkflowRecord(client, {
      key: snapshotKey(workflowName, victimRunId, victimResource),
      workflowName,
      runId: victimRunId,
      resourceId: victimResource,
      status: 'running',
      createdAt,
      updatedAt: createdAt,
    });

    // Every glob metacharacter must be matched literally, so deleting these runs
    // (which do not exist) leaves the victim untouched.
    for (const runId of ['*', '?', '[a]', 'run-*-?', `${victimRunId.slice(0, 6)}*`]) {
      await workflowsDomain.deleteWorkflowRunById({ runId, workflowName });
    }

    expect(await client.get(snapshotKey(workflowName, victimRunId, victimResource))).not.toBeNull();
    expect((await workflowsDomain.listWorkflowRuns({ workflowName })).total).toBe(1);

    // Deleting the victim by its own runId still removes every copy.
    await workflowsDomain.deleteWorkflowRunById({ runId: victimRunId, workflowName });
    expect(await client.get(snapshotKey(workflowName, victimRunId, victimResource))).toBeNull();
  });

  it('does not delete a run whose id has the deleted runId as a strict prefix', async () => {
    const client = createTestClient();
    const workflowsDomain = new WorkflowsUpstash({ client });
    await workflowsDomain.init();

    const workflowName = `workflow-${randomUUID()}`;
    const createdAt = new Date('2024-09-01T00:00:00.000Z');

    // Each victim's id extends a shorter run id, so only an exact (not prefix)
    // match may delete it.
    const victimRunId = `run-${randomUUID()}`;
    const victimResource = `resource-${randomUUID()}`;
    const backslashRunId = `${victimRunId.slice(0, 10)}\\x`;
    const backslashResource = `resource-${randomUUID()}`;

    for (const [runId, resourceId] of [
      [victimRunId, victimResource],
      [backslashRunId, backslashResource],
    ] as const) {
      await seedWorkflowRecord(client, {
        key: snapshotKey(workflowName, runId, resourceId),
        workflowName,
        runId,
        resourceId,
        status: 'running',
        createdAt,
        updatedAt: createdAt,
      });
    }

    // Deleting a run whose id is a strict prefix of each victim, including one
    // ending in a backslash, must leave both victims untouched: the deleted key
    // has to end at a key boundary, not part-way through another run's id.
    await workflowsDomain.deleteWorkflowRunById({ runId: victimRunId.slice(0, -1), workflowName });
    await workflowsDomain.deleteWorkflowRunById({ runId: backslashRunId.slice(0, -1), workflowName });
    await workflowsDomain.deleteWorkflowRunById({ runId: victimRunId.slice(0, 10), workflowName });

    expect((await workflowsDomain.listWorkflowRuns({ workflowName })).total).toBe(2);
    expect(await client.get(snapshotKey(workflowName, victimRunId, victimResource))).not.toBeNull();
    expect(await client.get(snapshotKey(workflowName, backslashRunId, backslashResource))).not.toBeNull();
  });
});
