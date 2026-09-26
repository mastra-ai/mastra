/**
 * https://github.com/mastra-ai/mastra/issues/22802
 *
 * Guards the MessageList invariant that a sealed message's signed reasoning is never copied into a
 * second message. Observational memory's own guards don't seal an assistant message while its tool
 * call is still pending, and no current path is known to do so, so this test seals the pending
 * approval message itself, using the same steps observational memory uses to seal a buffered chunk
 * (`createPendingApprovalSealer`). The resumed run then reloads the stored copy (call still pending)
 * next to the live copy (call resolved) under the same id. Anthropic rejects a thread whose latest
 * assistant message repeats a thinking block, so each signature must reach the model once.
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

// Seals the pending approval message with observational memory's buffering procedure
// (observation-turn/step.ts): mark it sealed, persist it, then move it into the memory source.
const createPendingApprovalSealer = (memory: Memory, threadId: string, resourceId: string): Processor => ({
  id: 'seal-pending-approval',
  processOutputStep: async ({ messageList }) => {
    const pending = messageList.get.all.db().filter(message => message.role === 'assistant' && hasPendingCall(message));
    if (pending.length === 0) return messageList;
    for (const message of pending) {
      message.content.metadata = {
        ...message.content.metadata,
        mastra: { ...(message.content.metadata?.mastra as object), sealed: true },
      };
      const lastPart = message.content.parts.at(-1)!;
      lastPart.metadata = { ...lastPart.metadata, mastra: { sealedAt: Date.now() } };
    }
    await memory.saveMessages({ messages: pending.map(message => ({ ...message, threadId, resourceId })) });
    messageList.removeByIds(pending.map(message => message.id));
    for (const message of pending) messageList.add(message, 'memory');
    return messageList;
  },
});

type PromptMessage = { role: string; content: Array<{ type: string; toolCallId?: string }> | string };

const OBSERVATION_CONFIGS = [
  ['async buffering', { messageTokens: 3000, bufferTokens: 0.2 }],
  ['synchronous observation', { messageTokens: 800, bufferTokens: false as const }],
] as const;

// Two turns, each: the model calls approveMe, the run suspends for approval, the call is approved.
async function runApprovalTurns({
  threadId,
  observation,
  sealPendingApproval,
}: {
  threadId: string;
  observation: (typeof OBSERVATION_CONFIGS)[number][1];
  sealPendingApproval: boolean;
}) {
  const prompts: PromptMessage[][] = [];
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
  const model = createActorModel(prompts as unknown[][]);
  const threadMemory = { thread: threadId, resource: 'resource-1' };
  const createAgent = () => {
    const agent = new Agent({
      id: 'agent',
      name: 'agent',
      instructions: 'Help the user.',
      model,
      memory,
      tools: { approveMe },
      outputProcessors: sealPendingApproval ? [createPendingApprovalSealer(memory, threadId, 'resource-1')] : [],
    });
    new Mastra({ agents: { agent }, logger: false, storage });
    return agent;
  };

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
  return prompts;
}

const carriesApprovedCall = (prompt: PromptMessage[], toolCallId: string) => {
  const parts = prompt.flatMap(message => (Array.isArray(message.content) ? message.content : []));
  return (
    parts.some(part => part.type === 'tool-call' && part.toolCallId === toolCallId) &&
    parts.some(part => part.type === 'tool-result' && part.toolCallId === toolCallId)
  );
};

describe('pending approval message sealed while suspended (simulated)', () => {
  // Observational memory keeps per-thread state in process-wide maps, so each case uses its own thread.
  it.each(OBSERVATION_CONFIGS)(
    'sends each signed reasoning block once with %s',
    async (label, observation) => {
      const prompts = await runApprovalTurns({
        threadId: `sealed-${label}`,
        observation,
        sealPendingApproval: true,
      });

      for (const prompt of prompts) {
        const signatures = JSON.stringify(prompt).match(/sig-\d+/g) ?? [];
        expect(signatures).toEqual([...new Set(signatures)]);
      }

      // The resumed request carries the approved call and its result, then nothing else.
      const resumedPrompt = prompts[1]!;
      expect(resumedPrompt.at(-2)?.content).toContainEqual(
        expect.objectContaining({ type: 'tool-call', toolCallId: 'call-1' }),
      );
      expect(resumedPrompt.at(-1)).toMatchObject({
        role: 'tool',
        content: [expect.objectContaining({ type: 'tool-result', toolCallId: 'call-1' })],
      });

      // The resolved call is re-saved even though the row is sealed, so the next turn still has it.
      expect(carriesApprovedCall(prompts[2]!, 'call-1')).toBe(true);
    },
    30_000,
  );

  // Control for the sealed cases above: nothing seals the pending message, so the approved call and
  // its result stay in the thread for the next turn through the ordinary (unsealed) save path.
  it.each(OBSERVATION_CONFIGS)(
    'keeps the approved call for the next turn with %s when nothing seals the pending message',
    async (label, observation) => {
      const prompts = await runApprovalTurns({
        threadId: `unsealed-${label}`,
        observation,
        sealPendingApproval: false,
      });

      expect(carriesApprovedCall(prompts[2]!, 'call-1')).toBe(true);
    },
    30_000,
  );
});
