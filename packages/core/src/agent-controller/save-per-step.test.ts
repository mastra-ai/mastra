import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

describe('AgentController per-step persistence (#25538)', () => {
  it.each([undefined, false, true])('respects savePerStep=%s on initial and resumed runs', async savePerStep => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const persistedBeforeNextStep: boolean[] = [];
    let threadId: string;
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        if (calls === 2 || calls === 4) {
          const recalled = await memory.recall({ threadId, perPage: false });
          const progress = calls === 2 ? 'Initial progress' : 'Resumed progress';
          persistedBeforeNextStep.push(
            recalled.messages.some(message =>
              message.content.parts.some(part => part.type === 'text' && part.text === progress),
            ),
          );
        }
        const toolCall = calls === 2;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(toolCall
              ? [{ type: 'tool-call' as const, toolCallId: 'confirm-1', toolName: 'confirm', input: '{}' }]
              : [
                  { type: 'text-start' as const, id: `text-${calls}` },
                  {
                    type: 'text-delta' as const,
                    id: `text-${calls}`,
                    delta: calls === 1 ? 'Initial progress' : calls === 3 ? 'Resumed progress' : 'Done',
                  },
                  { type: 'text-end' as const, id: `text-${calls}` },
                ]),
            {
              type: 'finish',
              finishReason: toolCall ? 'tool-calls' : calls === 4 ? 'stop' : 'other',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });
    const agent = new Agent({
      id: 'controller-step-save',
      name: 'controller-step-save',
      instructions: 'Continue until done.',
      model,
      memory,
      defaultOptions: savePerStep === undefined ? {} : { savePerStep },
      tools: {
        confirm: createTool({
          id: 'confirm',
          description: 'Confirm',
          inputSchema: z.object({}),
          suspendSchema: z.object({ question: z.string() }),
          resumeSchema: z.object({ approved: z.boolean() }),
          execute: async (_input, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({ question: 'Continue?' });
            return 'confirmed';
          },
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, storage, logger: false });
    const controller = new AgentController({
      id: 'save-controller',
      storage,
      workspace: createMockWorkspace(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: mastra.getAgent('agent') }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'save-session', ownerId: 'user' });
    await session.thread.create();
    threadId = session.thread.requireId();
    await session.permissions.setForTool({ toolName: 'confirm', policy: 'allow' });
    const events: AgentControllerEvent[] = [];
    const unsubscribe = session.subscribe(event => events.push(event));
    try {
      await session.sendMessage({ content: 'Start' });
      expect(events.some(event => event.type === 'tool_suspended')).toBe(true);
      events.length = 0;
      await session.respondToToolSuspension({ toolCallId: 'confirm-1', resumeData: { approved: true } });
      await vi.waitFor(() =>
        expect(events.some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(true),
      );
      expect(persistedBeforeNextStep).toEqual([savePerStep === true, savePerStep === true]);
      expect(calls).toBe(4);
    } finally {
      unsubscribe();
    }
  });
});
