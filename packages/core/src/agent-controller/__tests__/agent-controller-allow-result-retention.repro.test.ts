/**
 * Regression for #19814: sequential auto-approved (`allow`) tool calls in a
 * non-yolo AgentController run must keep each tool-call/result pair visible to
 * the next model prompt.
 *
 * Without the fix, resume hydrates MessageList from the previous suspended
 * snapshot, so updateToolInvocation() misses allow-call-2 and model call 3
 * sees neither the assistant tool-call nor the tool result.
 */
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';

import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

const SENTINEL = 'RESULT_REACHED_MODEL_7F3A';

function createAllowToolCallStream(toolCallId: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: `id-${toolCallId}`,
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName: 'ping',
        input: '{}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-final',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function promptContainsToolCall(prompt: unknown, toolCallId: string): boolean {
  return JSON.stringify(prompt).includes(toolCallId);
}

function promptContainsToolResult(prompt: unknown, toolCallId: string, sentinel: string): boolean {
  const serialized = JSON.stringify(prompt);
  return serialized.includes(toolCallId) && serialized.includes(sentinel);
}

describe('AgentController: sequential allow auto-approval retains tool results (#19814)', () => {
  it('keeps allow-call-2 + result in the third model prompt after two auto-approved tools', async () => {
    let toolExecutions = 0;
    const pingTool = createTool({
      id: 'ping',
      description: 'A simple tool that returns a sentinel',
      inputSchema: z.object({}),
      execute: async () => {
        toolExecutions += 1;
        return { value: SENTINEL };
      },
    });

    let callCount = 0;
    const model = new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount += 1;
        if (callCount === 1) {
          return { stream: createAllowToolCallStream('allow-call-1') };
        }
        if (callCount === 2) {
          return { stream: createAllowToolCallStream('allow-call-2') };
        }
        return { stream: createTextStream() };
      },
    });

    const agent = new Agent({
      id: 'allow-retention-agent',
      name: 'Allow Retention Agent',
      instructions: 'Use the ping tool when asked.',
      model,
      tools: { ping: pingTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'allow-retention-agent': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('allow-retention-agent');
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'allow-retention-controller',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      // non-yolo so requireToolApproval stays true and allow-policy auto-approves
      initialState: { yolo: false } as any,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'allow-retention-session', ownerId: 'test-owner' });

    const events: { type: string }[] = [];
    session.subscribe(event => {
      events.push(event as { type: string });
    });

    await session.thread.create();
    await session.permissions.setForTool({ toolName: 'ping', policy: 'allow' });
    await session.sendMessage({ content: 'Ping twice' });

    expect(toolExecutions).toBe(2);
    expect(callCount).toBe(3);
    expect(events.some(e => e.type === 'tool_approval_required')).toBe(false);

    const thirdPrompt = model.doStreamCalls[2]?.prompt;
    expect(thirdPrompt).toBeDefined();
    expect(promptContainsToolCall(thirdPrompt, 'allow-call-2')).toBe(true);
    expect(promptContainsToolResult(thirdPrompt, 'allow-call-2', SENTINEL)).toBe(true);
  });
});
