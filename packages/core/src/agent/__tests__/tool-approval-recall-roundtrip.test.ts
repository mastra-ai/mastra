/**
 * Reproduction for issue #17218:
 * "Approved/declined tool approvals don't round-trip as v6 UI parts on recall"
 *
 * After a user approves or declines a `requireApproval` tool call, the LIVE stream
 * is correct, but the PERSISTED / RECALLED messages lose the approval decision:
 *
 *   - Decline: recalled tool part is `state: 'output-available'` with
 *     `output: 'Tool call was not approved by the user'` (indistinguishable from a
 *     tool that successfully returned that string) and NO `approval` field.
 *     It should be `state: 'output-denied'` + `approval: { approved: false, reason }`.
 *
 *   - Approve: recalled tool part is `state: 'output-available'` with the tool
 *     output but NO `approval` field. It should carry `approval: { approved: true }`.
 *
 * This is a WRITE-PATH gap. The read path (AIV6Adapter) already supports
 * `output-denied` + `approval` — see message-list-v6.test.ts. The agent loop never
 * writes those states today:
 *   - tool-call-step.ts decline branch returns `{ result: '...' }` with no `approval`.
 *   - llm-mapping-step.ts persists every resolved tool call as `state: 'result'`.
 *   - schema.ts `toolCallOutputSchema` has no `approval` field (Zod strips it).
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';
import { MessageList } from '../message-list';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const TOOL_CALL_ID = 'call-1';
const DECLINE_REASON = 'Tool call was not approved by the user';

const mockFindUser = vi.fn().mockImplementation(async (data: { name: string }) => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
  ];
  const userInfo = list.find(({ name }) => name === data.name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

function createFindUserTool() {
  return createTool({
    id: 'findUserTool',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async input => mockFindUser(input) as Promise<Record<string, any>>,
  });
}

/**
 * First model call asks to call findUserTool; every later call (after the
 * approval decision) returns a plain text response so the loop can finish.
 */
function createMockModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: TOOL_CALL_ID,
              toolName: 'findUserTool',
              input: '{"name":"Dero Israel"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'All done.' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

/** Recall persisted messages and pull the stored tool invocation for a toolCallId. */
function findStoredToolInvocation(messages: MastraDBMessage[], toolCallId: string) {
  for (const message of messages) {
    for (const part of message.content.parts ?? []) {
      if (part.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        return part.toolInvocation;
      }
    }
  }
  return undefined;
}

/** Project recalled messages to AI SDK v6 UI parts and pull the part for a toolCallId. */
function findV6ToolPart(messages: MastraDBMessage[], toolCallId: string) {
  const uiMessages = new MessageList().add(messages, 'memory').get.all.aiV6.ui();
  for (const uiMessage of uiMessages) {
    for (const part of uiMessage.parts) {
      if ('toolCallId' in part && part.toolCallId === toolCallId) {
        return part as Record<string, any>;
      }
    }
  }
  return undefined;
}

async function runApprovalFlow(decision: 'approve' | 'decline') {
  mockFindUser.mockClear();

  const agent = new Agent({
    id: 'user-agent',
    name: 'User Agent',
    instructions: 'You are an agent that can get list of users using findUserTool.',
    model: createMockModel(),
    tools: { findUserTool: createFindUserTool() },
    memory: new MockMemory(),
  });

  const mastra = new Mastra({ agents: { userAgent: agent }, logger: false, storage: new InMemoryStore() });
  const registered = mastra.getAgent('userAgent');

  const threadId = `thread-${decision}`;
  const stream = await registered.stream('Find the user with name - Dero Israel', {
    requireToolApproval: true,
    memory: { resource: 'user-1', thread: { id: threadId } },
  });

  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
    }
  }
  expect(toolCallId).toBe(TOOL_CALL_ID);

  const resumeStream =
    decision === 'approve'
      ? await registered.approveToolCall({ runId: stream.runId, toolCallId })
      : await registered.declineToolCall({ runId: stream.runId, toolCallId });

  for await (const _chunk of resumeStream.fullStream) {
    // drain so the resumed turn persists
  }

  const memory = (await registered.getMemory())!;
  const { messages } = await memory.recall({ threadId, perPage: false });
  return { messages, stored: findStoredToolInvocation(messages, toolCallId), v6: findV6ToolPart(messages, toolCallId) };
}

describe('issue #17218: tool approval decisions round-trip on recall', () => {
  it('decline persists as output-denied + approval and recalls as a v6 output-denied part', async () => {
    const { stored, v6 } = await runApprovalFlow('decline');
    expect(mockFindUser).toHaveBeenCalledTimes(0);

    // Stored MastraToolInvocation should be a denial, not a plain successful result.
    expect(stored).toBeDefined();
    expect(stored?.state).toBe('output-denied');
    expect(stored?.approval).toMatchObject({ approved: false, reason: DECLINE_REASON });

    // Recalled v6 UI part should reflect the denial.
    expect(v6).toBeDefined();
    expect(v6?.state).toBe('output-denied');
    expect(v6?.approval).toMatchObject({ approved: false, reason: DECLINE_REASON });
  }, 30000);

  it('approve persists the approval and recalls it on the v6 output-available part', async () => {
    const { stored, v6 } = await runApprovalFlow('approve');
    expect(mockFindUser).toHaveBeenCalledTimes(1);

    expect(stored).toBeDefined();
    expect(stored?.state).toBe('result');
    expect(stored?.approval).toMatchObject({ approved: true });

    expect(v6).toBeDefined();
    expect(v6?.state).toBe('output-available');
    expect(v6?.approval).toMatchObject({ approved: true });
  }, 30000);
});
