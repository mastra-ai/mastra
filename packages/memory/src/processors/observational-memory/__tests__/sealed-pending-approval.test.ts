/**
 * https://github.com/mastra-ai/mastra/issues/22802
 *
 * Guards the MessageList invariant that a sealed message's signed reasoning is never copied into a
 * second message. Observational memory's own guards don't seal an assistant message while its tool
 * call is still pending, and no current path is known to do so, so this test seals the pending
 * approval message itself (`createPendingApprovalSealer`). If such a message is sealed while the
 * run is suspended, the resumed run reloads the stored copy (call still pending) next to the live
 * copy (call resolved) under the same id. Anthropic rejects a thread whose latest assistant message
 * repeats a thinking block, so each signature must reach the model once.
 *
 * Only the resumed request is checked for the approved call. Observational memory doesn't re-save a
 * sealed message without an observation marker, so the stored row keeps the pending call and later
 * turns don't see its result. That is a consequence of sealing a pending call at all, not of the
 * duplicate this test guards against.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { Processor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const FILLER = ' lorem ipsum dolor sit amet'.repeat(40);
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createActorModel(prompts: unknown[][]) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      call++;
      const signature = `sig-${call}`;
      const afterToolResult = prompt.at(-1)?.role === 'tool';
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'reasoning-start', id: `r${call}` },
          {
            type: 'reasoning-delta',
            id: `r${call}`,
            delta: `thinking ${call}`,
            providerMetadata: { anthropic: { signature } },
          },
          { type: 'reasoning-end', id: `r${call}`, providerMetadata: { anthropic: { signature } } },
          { type: 'text-start', id: `t${call}` },
          { type: 'text-delta', id: `t${call}`, delta: `reply ${call}${FILLER}` },
          { type: 'text-end', id: `t${call}` },
          ...(afterToolResult
            ? [{ type: 'finish' as const, finishReason: 'stop' as const, usage }]
            : [
                { type: 'tool-call' as const, toolCallId: `call-${call}`, toolName: 'approveMe', input: '{"n":1}' },
                { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
              ]),
        ]),
      };
    },
  });
}

function createObserverModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'o' },
        { type: 'text-delta', id: 'o', delta: '<observations>\n- 🔴 User asked for work\n</observations>' },
        { type: 'text-end', id: 'o' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

const hasPendingCall = (message: MastraDBMessage) =>
  message.content.parts.some(part => part.type === 'tool-invocation' && part.toolInvocation.state === 'call');

// Marks the pending approval message sealed with the same metadata observational memory writes.
const createPendingApprovalSealer = (): Processor => ({
  id: 'seal-pending-approval',
  processOutputStep: async ({ messageList }) => {
    for (const message of messageList.get.all.db()) {
      if (message.role !== 'assistant' || !hasPendingCall(message)) continue;
      message.content.metadata = {
        ...message.content.metadata,
        mastra: { ...(message.content.metadata?.mastra as object), sealed: true },
      };
      const lastPart = message.content.parts.at(-1)!;
      lastPart.metadata = { ...lastPart.metadata, mastra: { sealedAt: Date.now() } };
    }
    return messageList;
  },
});

describe('pending approval message sealed while suspended (simulated)', () => {
  it.each([
    ['async buffering', { messageTokens: 3000, bufferTokens: 0.2 }],
    ['synchronous observation', { messageTokens: 800, bufferTokens: false as const }],
  ])(
    'sends each signed reasoning block once with %s',
    async (label, observation) => {
      const prompts: unknown[][] = [];
      const storage = new InMemoryStore();
      const memory = new Memory({
        storage,
        options: {
          lastMessages: 20,
          observationalMemory: {
            enabled: true,
            observation: { model: createObserverModel(), ...observation },
            reflection: { model: createObserverModel(), observationTokens: 50_000 },
          },
        },
      });
      const approveMe = createTool({
        id: 'approveMe',
        description: 'Needs approval',
        inputSchema: z.object({ n: z.number() }),
        requireApproval: true,
        execute: async () => ({ ok: true, details: FILLER }),
      });
      const model = createActorModel(prompts);
      const createAgent = () => {
        const agent = new Agent({
          id: 'agent',
          name: 'agent',
          instructions: 'Help the user.',
          model,
          memory,
          tools: { approveMe },
          outputProcessors: [createPendingApprovalSealer()],
        });
        new Mastra({ agents: { agent }, logger: false, storage });
        return agent;
      };
      // Observational memory keeps per-thread state in process-wide maps, so each case needs its own thread.
      const threadMemory = { thread: `thread-${label}`, resource: 'resource-1' };

      for (let turn = 0; turn < 2; turn++) {
        const stream = await createAgent().stream(`turn ${turn}`, { memory: threadMemory });
        let toolCallId: string | undefined;
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
        }
        expect(toolCallId).toBeDefined();

        const resumed = await createAgent().approveToolCall({
          runId: stream.runId,
          toolCallId: toolCallId!,
          memory: threadMemory,
        });
        for await (const _chunk of resumed.fullStream) {
          // drain
        }
      }

      expect(prompts).toHaveLength(4);
      for (const prompt of prompts) {
        const signatures = JSON.stringify(prompt).match(/sig-\d+/g) ?? [];
        expect(signatures).toEqual([...new Set(signatures)]);
      }

      // The resumed request carries the approved call and its result, then nothing else.
      const resumedPrompt = prompts[1] as Array<{
        role: string;
        content: Array<{ type: string; toolCallId?: string }>;
      }>;
      expect(resumedPrompt.at(-2)?.content).toContainEqual(
        expect.objectContaining({ type: 'tool-call', toolCallId: 'call-1' }),
      );
      expect(resumedPrompt.at(-1)).toMatchObject({
        role: 'tool',
        content: [expect.objectContaining({ type: 'tool-result', toolCallId: 'call-1' })],
      });
    },
    30_000,
  );
});
