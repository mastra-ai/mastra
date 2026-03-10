/**
 * Reproduction: Agent without Mastra instance fails to resume stream after tool approval suspension.
 *
 * Root cause: The Agent's resumeStream/resumeGenerate methods rely on
 * `this.#mastra?.getStorage()?.getStore('workflows')` to load workflow snapshots.
 * When an Agent is used standalone (without being registered via a Mastra instance),
 * `#mastra` is undefined, so snapshots are never persisted during suspension and
 * can never be loaded during resumption.
 *
 * This means:
 *   1. The initial stream suspends and emits a `tool-call-approval` chunk — this works.
 *   2. `approveToolCall()` / `declineToolCall()` call `resumeStream()` internally.
 *   3. `resumeStream()` tries to load the snapshot: `workflowsStore?.loadWorkflowSnapshot(...)`.
 *   4. `workflowsStore` is `undefined` because `this.#mastra` is `undefined`.
 *   5. `existingSnapshot` is `undefined`, so `#execute()` receives no resume context.
 *   6. The resumed execution starts fresh with empty messages and no snapshot — it does NOT
 *      continue from where it left off.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

describe('tool approval: standalone Agent (no Mastra) vs Agent with Mastra', () => {
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
      id: 'Find user tool',
      description: 'Returns the name and email of a user',
      inputSchema: z.object({ name: z.string() }),
      requireApproval: true,
      execute: async input => {
        return mockFindUser(input) as Promise<Record<string, any>>;
      },
    });
  }

  function createMockModel() {
    let callCount = 0;
    return new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          // First call: model asks to call the tool
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
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
        } else {
          // After approval: model returns text response
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'User found: Dero Israel (dero@mail.com)' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
      },
    });
  }

  it('WITH Mastra: approveToolCall correctly resumes the stream', async () => {
    mockFindUser.mockClear();

    const findUserTool = createFindUserTool();
    const mockModel = createMockModel();

    const userAgent = new Agent({
      id: 'user-agent',
      name: 'User Agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: mockModel,
      tools: { findUserTool },
    });

    // Key: use Mastra with storage — this gives the Agent access to snapshot persistence
    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const agent = mastra.getAgent('userAgent');

    // Step 1: Start stream → should suspend for tool approval
    const stream = await agent.stream('Find the user with name - Dero Israel', {
      requireToolApproval: true,
    });

    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
      }
    }

    expect(toolCallId).toBeTruthy();

    // Step 2: Approve the tool call — no delay needed, snapshot is persisted before stream closes
    const resumeStream = await agent.approveToolCall({ runId: stream.runId, toolCallId });

    for await (const _chunk of resumeStream.fullStream) {
      // consume the stream
    }

    // Step 3: Verify the tool was executed
    const toolResults = await resumeStream.toolResults;
    expect(toolResults.length).toBeGreaterThan(0);

    const toolCall = toolResults.find((r: any) => r.payload.toolName === 'findUserTool')?.payload;
    expect(toolCall?.result?.name).toBe('Dero Israel');
    expect(mockFindUser).toHaveBeenCalledTimes(1);
  }, 30000);

  it('WITHOUT Mastra initially: manually registering Mastra with storage fixes resume', async () => {
    mockFindUser.mockClear();

    const findUserTool = createFindUserTool();
    const mockModel = createMockModel();

    // Agent is created standalone — no Mastra instance
    const agent = new Agent({
      id: 'user-agent',
      name: 'User Agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: mockModel,
      tools: { findUserTool },
    });

    // Fix: manually register a minimal Mastra with storage
    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
    });
    agent.__registerMastra(mastra);

    // Step 1: Start stream → should suspend for tool approval
    const stream = await agent.stream('Find the user with name - Dero Israel', {
      requireToolApproval: true,
    });

    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
      }
    }

    expect(toolCallId).toBeTruthy();

    // Step 2: Approve the tool call — no delay needed, snapshot is persisted before stream closes
    const resumeStream = await agent.approveToolCall({ runId: stream.runId, toolCallId });

    for await (const _chunk of resumeStream.fullStream) {
      // consume the stream
    }

    // Step 3: Verify the tool was executed
    const toolResults = await resumeStream.toolResults;
    expect(toolResults.length).toBeGreaterThan(0);

    const toolCall = toolResults.find((r: any) => r.payload.toolName === 'findUserTool')?.payload;
    expect(toolCall?.result?.name).toBe('Dero Israel');
    expect(mockFindUser).toHaveBeenCalledTimes(1);
  }, 30000);
});
