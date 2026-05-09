/**
 * Lifecycle regression for #15244 / #15274: client-side tools (no server `execute`)
 * return a tool call on one request; the client sends the tool result on a later
 * request. Observational Memory must not drop the assistant message that still
 * carries the tool *call* while a separate message carries the *result*, or the
 * second request's model context loses the pairing.
 *
 * This is an agent + Memory + OM integration test (Vitest), not Playwright.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const TOOL_NAME = 'clientSideTool';
const TOOL_CALL_ID = 'tc-15244-e2e';
const SECOND_TURN_SECRET = 'E2E_CLIENT_TOOL_RESULT_ACK_15244';

const longPreamble = `I understand your request completely. Let me use the client tool as you asked.
This preamble is intentionally long so observational memory's low token threshold can fire during the
same generate() turn (mirrors packages/memory mock OM agent integration tests).`;

function createMockObserverModel() {
  const text = `<observations>
## Thread snapshot
- User asked to run a client-side tool
</observations>
<current-task>Wait for client tool result</current-task>
<suggested-response>Continue after tool output arrives.</suggested-response>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate — OM should use the stream path');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: 'obs-1',
          modelId: 'mock-observer-model',
          timestamp: new Date(),
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createMockReflectorModel() {
  const text = `<observations>
## Condensed
- Client tool flow
</observations>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate — OM should use the stream path');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: 'ref-1',
          modelId: 'mock-reflector-model',
          timestamp: new Date(),
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** Actor model: first LLM call = long text + client tool call; second = secret text after tool result exists. */
function createClientToolActorModel() {
  /**
   * `phase === 'first'`: first HTTP session (ends with pending client tool call).
   * `phase === 'second'`: later HTTP request after the client persisted the tool result.
   */
  let phase: 'first' | 'second' = 'first';

  const firstGenerate = () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'tool-calls' as const,
    usage: { inputTokens: 80, outputTokens: 120, totalTokens: 200 },
    text: longPreamble,
    content: [
      { type: 'text' as const, text: longPreamble },
      {
        type: 'tool-call' as const,
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: { query: 'client-e2e' },
      },
    ],
    warnings: [],
  });

  const continuationAfterToolResultGenerate = (messages: any[]) => {
    const hasCall = messages.some(m =>
      getParts(m).some(
        p =>
          ((p as { type?: string }).type === 'tool-invocation' &&
            (p as { toolInvocation?: { state?: string; toolCallId?: string } }).toolInvocation?.toolCallId ===
              TOOL_CALL_ID &&
            (p as { toolInvocation?: { state?: string } }).toolInvocation?.state === 'call') ||
          ((p as { type?: string }).type === 'tool-call' && (p as { toolCallId?: string }).toolCallId === TOOL_CALL_ID),
      ),
    );

    if (!hasCall) {
      throw new Error(`E2E_TEST_FAILURE: tool call ${TOOL_CALL_ID} missing from context in second turn`);
    }

    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
      text: SECOND_TURN_SECRET,
      content: [{ type: 'text' as const, text: SECOND_TURN_SECRET }],
      warnings: [],
    };
  };

  const model = new MockLanguageModelV2({
    // `createStream` may call `doGenerate` multiple times (retries) — keep `phase === 'first'` idempotent.
    doGenerate: async ({ prompt }) =>
      phase === 'second' ? continuationAfterToolResultGenerate(prompt) : firstGenerate(),
    doStream: async ({ prompt }) => {
      if (phase === 'second') {
        continuationAfterToolResultGenerate(prompt);
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'actor-2',
              modelId: 'mock-actor',
              timestamp: new Date(),
            },
            { type: 'text-start', id: 'answer' },
            { type: 'text-delta', id: 'answer', delta: SECOND_TURN_SECRET },
            { type: 'text-end', id: 'answer' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
            },
          ]),
        };
      }

      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'actor-1',
            modelId: 'mock-actor',
            timestamp: new Date(),
          },
          { type: 'text-start', id: 'preamble' },
          { type: 'text-delta', id: 'preamble', delta: longPreamble },
          { type: 'text-end', id: 'preamble' },
          {
            type: 'tool-call',
            id: TOOL_CALL_ID,
            toolCallId: TOOL_CALL_ID,
            toolName: TOOL_NAME,
            args: JSON.stringify({ query: 'client-e2e' }),
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 80, outputTokens: 120, totalTokens: 200 },
          },
        ]),
      };
    },
  });

  return {
    model,
    setPhase: (next: 'first' | 'second') => {
      phase = next;
    },
  };
}

function getParts(msg: MastraDBMessage): unknown[] {
  const c = msg.content as unknown;
  if (typeof c === 'string' || c == null) return [];
  if (Array.isArray(c)) return c;
  if (typeof c === 'object' && c !== null && 'parts' in c) {
    const parts = (c as { parts?: unknown }).parts;
    return Array.isArray(parts) ? parts : [];
  }
  return [];
}

describe('Client-side tool + Observational Memory lifecycle (#15244)', () => {
  let store: InMemoryStore;
  let memory: Memory;
  let agent: Agent;
  let setActorPhase: (next: 'first' | 'second') => void;

  beforeEach(() => {
    store = new InMemoryStore();

    memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: createMockObserverModel() as any,
            messageTokens: 20,
            bufferTokens: false,
          },
          reflection: {
            model: createMockReflectorModel() as any,
            observationTokens: 50000,
          },
        },
      },
    });

    const { model, setPhase } = createClientToolActorModel();
    setActorPhase = setPhase;

    agent = new Agent({
      id: 'client-tool-om-agent',
      name: 'Client tool OM agent',
      instructions: 'You help the user. When you receive a client tool result, acknowledge it clearly.',
      model: model as any,
      memory,
    });
  });

  it('second request sees tool result after OM observed the call message (pairing)', async () => {
    const threadId = `thread-15244-e2e-${Date.now()}`;
    const resourceId = 'resource-15244-e2e';

    const clientSideToolDef = {
      id: 'client-side-tool',
      description: 'Client-executed tool (no server execute)',
      inputSchema: z.object({ query: z.string() }),
    };

    // Request 1 — pending client tool (same finishReason as a real HTTP response that returns tool calls).
    const first = await agent.generate('Please run the client tool.', {
      memory: { thread: threadId, resource: resourceId },
      clientTools: { [TOOL_NAME]: clientSideToolDef },
      maxSteps: 1,
    });

    expect(first.finishReason).toBe('tool-calls');
    expect(first.steps.length).toBeGreaterThanOrEqual(1);

    const memoryStore = await store.getStore('memory');
    expect(memoryStore).toBeTruthy();
    const record = await memoryStore.getObservationalMemory(threadId, resourceId);
    expect(record).toBeTruthy();

    const afterFirst = await memory.recall({ threadId, resourceId, perPage: 50 });
    const callCarrier = afterFirst.messages.find(m => {
      if (m.role !== 'assistant') return false;
      return getParts(m).some(
        p =>
          ((p as { type?: string }).type === 'tool-invocation' &&
            (p as { toolInvocation?: { state?: string; toolCallId?: string } }).toolInvocation?.state === 'call' &&
            (p as { toolInvocation?: { toolCallId?: string } }).toolInvocation?.toolCallId === TOOL_CALL_ID) ||
          ((p as { type?: string }).type === 'tool-call' && (p as { toolCallId?: string }).toolCallId === TOOL_CALL_ID),
      );
    });
    expect(callCarrier?.id, 'assistant message with tool call should be persisted').toBeTruthy();
    const callMessageId = callCarrier?.id;
    if (!callMessageId) {
      throw new Error('expected assistant tool-call message id');
    }

    const observed = new Set(record?.observedMessageIds ?? []);
    if (observed.size > 0) {
      expect(observed.has(callMessageId), 'when OM has observed ids, the call message should be among them').toBe(true);
    }

    const tResult = new Date();
    const tPart = Date.parse('2025-06-01T12:00:00.000Z');

    await memory.saveMessages({
      messages: [
        {
          id: `assistant-tool-result-${threadId}`,
          threadId,
          resourceId,
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                createdAt: tPart,
                toolInvocation: {
                  state: 'result',
                  toolCallId: TOOL_CALL_ID,
                  toolName: TOOL_NAME,
                  args: { query: 'client-e2e' },
                  result: { ok: true, fromClient: true },
                },
              },
            ],
          },
          createdAt: tResult,
        } as MastraDBMessage,
      ],
    });

    setActorPhase('second');

    // Request 2 — same thread; model should still see call + result pairing in context.
    const second = await agent.generate('Continue now that the tool finished.', {
      memory: { thread: threadId, resource: resourceId },
      clientTools: { [TOOL_NAME]: clientSideToolDef },
      maxSteps: 2,
    });

    expect(second.text).toContain(SECOND_TURN_SECRET);

    const finalThread = await memory.recall({ threadId, resourceId, perPage: 50 });
    const stillHasCall = finalThread.messages.some(
      m =>
        m.role === 'assistant' &&
        getParts(m).some(
          p =>
            ((p as { type?: string }).type === 'tool-invocation' &&
              (p as { toolInvocation?: { state?: string; toolCallId?: string } }).toolInvocation?.toolCallId ===
                TOOL_CALL_ID &&
              (p as { toolInvocation?: { state?: string } }).toolInvocation?.state === 'call') ||
            ((p as { type?: string }).type === 'tool-call' &&
              (p as { toolCallId?: string }).toolCallId === TOOL_CALL_ID),
        ),
    );
    expect(stillHasCall, 'stored thread should still include the tool-call side of the pair').toBe(true);
  });
});
