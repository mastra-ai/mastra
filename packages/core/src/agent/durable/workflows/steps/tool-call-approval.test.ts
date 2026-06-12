import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../../../background-tasks/create', () => ({
  createBackgroundTask: vi.fn(),
}));
vi.mock('../../../../background-tasks/resolve-config', () => ({
  resolveBackgroundConfig: vi.fn(),
}));
vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-approval-1';
const AGENT_ID = 'agent-1';
const TOOL_NAME = 'delete-file';
const TOOL_CALL_ID = 'call-approval-1';

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

function baseInput() {
  return {
    toolCallId: TOOL_CALL_ID,
    toolName: TOOL_NAME,
    args: { path: '/tmp/test.txt' },
  };
}

function makeInitData(overrides: Record<string, any> = {}) {
  return {
    runId: RUN_ID,
    agentId: AGENT_ID,
    options: { requireToolApproval: true },
    state: {
      threadId: 'thread-1',
      resourceId: 'user-1',
      memoryConfig: undefined,
      threadExists: false,
    },
    ...overrides,
  };
}

function makeMessageList() {
  return {
    updateToolInvocation: vi.fn().mockReturnValue(true),
    add: vi.fn(),
  };
}

function makeSaveQueueManager() {
  return { flushMessages: vi.fn().mockResolvedValue(undefined) };
}

function setupRegistry(overrides: Record<string, any> = {}) {
  const messageList = makeMessageList();
  const saveQueueManager = makeSaveQueueManager();
  const entry = {
    tools: {
      [TOOL_NAME]: {
        execute: vi.fn().mockResolvedValue({ deleted: true }),
      },
    },
    model: {} as any,
    messageList,
    saveQueueManager,
    ...overrides,
  };
  globalRunRegistry.set(RUN_ID, entry as any);
  return { messageList, saveQueueManager, entry };
}

function executeStep(pubsub: any, initData: any, input: any, resumeData?: any) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: input,
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    resumeData,
    requestContext: new Map(),
    getInitData: () => initData,
    [PUBSUB_SYMBOL]: pubsub,
  });
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) {
    globalRunRegistry.delete(RUN_ID);
  }
  vi.clearAllMocks();
});

describe('durable tool-call approval round-trip', () => {
  it('returns a structured approval object (no result) when the tool call is declined', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    const output = await executeStep(pubsub, initData, baseInput(), { approved: false });

    expect(output.result).toBeUndefined();
    expect(output.approval).toEqual({
      id: TOOL_CALL_ID,
      approved: false,
      reason: 'Tool call was not approved by the user',
    });
  });

  it('returns an approval: { approved: true } alongside the result when the tool call is approved', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    const output = await executeStep(pubsub, initData, baseInput(), { approved: true });

    expect(output.result).toEqual({ deleted: true });
    expect(output.approval).toEqual({
      id: TOOL_CALL_ID,
      approved: true,
    });
  });
});
