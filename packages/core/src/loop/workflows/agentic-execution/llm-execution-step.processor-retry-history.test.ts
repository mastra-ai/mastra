/**
 * Regression for GitHub issue #22291.
 *
 * When an output processor forces a mid-turn retry, the retry path at
 * `llm-execution-step.ts` removes the in-flight assistant message wholesale
 * (`messageList.removeByIds([outputStream.messageId])`). Because the assistant
 * message id is stable across retry iterations, that delete also takes the
 * parts produced by earlier, *accepted* steps of the same turn — the reasoning
 * item (`rs_…`) and the tool invocation (`fc_…`).
 *
 * The retry then rebuilds the message from the retry attempt's parts alone, so
 * the persisted assistant message carries an OpenAI text `itemId` (`msg_…`)
 * with zero reasoning parts. On the next turn the AI SDK replays it as an
 * `item_reference` and OpenAI returns a non-retryable 400:
 *
 *   Item 'msg_…' of type 'message' was provided without its required
 *   'reasoning' item
 *
 * The rollback must be narrowed to the last step boundary: the rejected
 * attempt's parts still go (PR #12799's intent — the model must not re-see the
 * answer a processor just rejected), but accepted prior steps survive.
 *
 * @see https://github.com/mastra-ai/mastra/issues/22291
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockLanguageModelV2, convertArrayToReadableStream } from '../../../agent/__tests__/mock-model';
import { Agent } from '../../../agent/agent';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';

const REASONING_ITEM_ID = 'rs_1';
const TOOL_ITEM_ID = 'fc_1';
const REJECTED_ITEM_ID = 'msg_2';
const ACCEPTED_ITEM_ID = 'msg_3';

const REJECTED_TEXT = 'REJECTED answer that the processor rejects';
const ACCEPTED_TEXT = 'ACCEPTED answer after the retry';

const openaiMeta = (itemId: string) => ({ openai: { itemId, reasoningEncryptedContent: null } });

const echoTool = createTool({
  id: 'echo',
  description: 'Echo the input back.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => ({ text }),
});

/**
 * Turn-1 model. Three scripted calls:
 *   1. the ACCEPTED step — reasoning `rs_1` + tool call `fc_1`
 *   2. the REJECTED attempt — text `msg_2`
 *   3. the accepted retry — text `msg_3`
 */
function createTurn1Model() {
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
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock-reasoning', timestamp: new Date(0) },
            { type: 'reasoning-start', id: 'reasoning-1', providerMetadata: openaiMeta(REASONING_ITEM_ID) },
            {
              type: 'reasoning-delta',
              id: 'reasoning-1',
              delta: 'I should call the echo tool first.',
              providerMetadata: openaiMeta(REASONING_ITEM_ID),
            },
            { type: 'reasoning-end', id: 'reasoning-1', providerMetadata: openaiMeta(REASONING_ITEM_ID) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'echo',
              input: JSON.stringify({ text: 'hi' }),
              providerExecuted: false,
              providerMetadata: openaiMeta(TOOL_ITEM_ID),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }

      const isRejectedAttempt = callCount === 2;
      const itemId = isRejectedAttempt ? REJECTED_ITEM_ID : ACCEPTED_ITEM_ID;
      const text = isRejectedAttempt ? REJECTED_TEXT : ACCEPTED_TEXT;

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `resp-${callCount}`, modelId: 'mock-reasoning', timestamp: new Date(0) },
          { type: 'text-start', id: `text-${callCount}`, providerMetadata: openaiMeta(itemId) },
          { type: 'text-delta', id: `text-${callCount}`, delta: text, providerMetadata: openaiMeta(itemId) },
          { type: 'text-end', id: `text-${callCount}`, providerMetadata: openaiMeta(itemId) },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

/** Turn-2 model. Emits nothing interesting; it exists to capture the replayed prompt. */
function createSpyModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-spy', modelId: 'spy', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-spy' },
        { type: 'text-delta', id: 'text-spy', delta: 'Follow-up.' },
        { type: 'text-end', id: 'text-spy' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

/** All content parts across every assistant entry of a prompt, flattened. */
function assistantParts(prompt: any[]): any[] {
  return prompt.filter(m => m.role === 'assistant').flatMap(m => (m.content as any[]) ?? []);
}

function itemIdsOf(parts: any[]): string[] {
  return parts.map(p => p.providerOptions?.openai?.itemId ?? p.providerMetadata?.openai?.itemId).filter(Boolean);
}

describe('#22291 — processor-forced retry must not destroy accepted steps', () => {
  it('preserves reasoning and tool-invocation parts from accepted steps across a mid-turn retry', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const mockMemory = new MockMemory();

    const turn1Model = createTurn1Model();

    const rejectOnce = {
      id: 'reject-once',
      name: 'Reject Once',
      processOutputStep: async ({ text, abort, retryCount, messageList }: any) => {
        if (retryCount === 0 && (text ?? '').includes('REJECTED')) {
          abort('Rejected answer, please regenerate', { retry: true });
        }
        // Returning the same `messageList` is the no-op result. Returning `[]` would be
        // read by the runner as "delete every message" (runner.ts:2212-2219).
        return messageList;
      },
    };

    const agent1 = new Agent({
      id: 'orphan-item-id-agent',
      name: 'Orphan Item Id Agent',
      instructions: 'You are a helpful assistant.',
      model: turn1Model,
      tools: { echo: echoTool },
      memory: mockMemory,
      outputProcessors: [rejectOnce],
      maxProcessorRetries: 3,
    });

    const resp1 = await agent1.stream('Use the echo tool and then answer.', {
      memory: { thread: threadId, resource: resourceId },
    });
    await resp1.consumeStream();

    // Sanity: the retry actually happened — three model calls on turn 1.
    expect(turn1Model.doStreamCalls).toHaveLength(3);

    // ---- Prompt A: the input to the retry that immediately follows the rejection ----
    const promptA = turn1Model.doStreamCalls[2]!.prompt as any[];
    const promptAParts = assistantParts(promptA);
    const promptAIds = itemIdsOf(promptAParts);

    // A1 — the model must NOT re-see the answer the processor just rejected (PR #12799).
    expect(promptAIds).not.toContain(REJECTED_ITEM_ID);
    expect(JSON.stringify(promptA)).not.toContain(REJECTED_TEXT);

    // A2 — the accepted step survived into the retry.
    expect(promptAIds).toContain(REASONING_ITEM_ID);
    expect(promptAIds).toContain(TOOL_ITEM_ID);

    // ---- Prompt B: the turn-2 replay, i.e. what OpenAI actually rejects in #22291 ----
    const spyModel = createSpyModel();
    const agent2 = new Agent({
      id: 'orphan-item-id-agent',
      name: 'Orphan Item Id Agent',
      instructions: 'You are a helpful assistant.',
      model: spyModel,
      tools: { echo: echoTool },
      memory: mockMemory,
    });

    const resp2 = await agent2.stream('Tell me more.', {
      memory: { thread: threadId, resource: resourceId, options: { lastMessages: 10 } },
    });
    await resp2.consumeStream();

    const promptB = spyModel.doStreamCalls[0]!.prompt as any[];
    const promptBParts = assistantParts(promptB);
    const promptBIds = itemIdsOf(promptBParts);

    // B3 — reasoning from the accepted step survived persistence.
    expect(promptBIds).toContain(REASONING_ITEM_ID);
    expect(promptBParts.some(p => p.type === 'reasoning')).toBe(true);

    // B4 — the tool invocation survived, with its matching result.
    expect(promptBIds).toContain(TOOL_ITEM_ID);
    const toolCall = promptBParts.find(p => p.type === 'tool-call');
    expect(toolCall).toBeDefined();
    const toolResults = promptB.flatMap(m => (m.content as any[]) ?? []).filter(p => p.type === 'tool-result');
    expect(toolResults.some(r => r.toolCallId === toolCall!.toolCallId)).toBe(true);

    // B5 — the rejected attempt is still absent from the replay.
    expect(promptBIds).not.toContain(REJECTED_ITEM_ID);
    expect(JSON.stringify(promptB)).not.toContain(REJECTED_TEXT);

    // B6 — the accepted retry answer is present.
    expect(promptBIds).toContain(ACCEPTED_ITEM_ID);

    // B7 — the orphan condition from #22291, stated as OpenAI actually evaluates it:
    // the turn's reasoning item must appear in the replayed conversation *before* the
    // text item that references it. An orphan is a text itemId whose reasoning item is
    // nowhere ahead of it, which is what produces the non-retryable 400.
    //
    // Deliberately not asserting same-entry co-location: a turn containing a tool call
    // is split by the tool-result entry into `assistant[reasoning, tool-call]` →
    // `tool[tool-result]` → `assistant[text]`, which is also exactly the shape a turn
    // that never retried produces. Requiring co-location would fail on healthy history.
    const flatB = promptB.flatMap(m =>
      (Array.isArray(m.content) ? (m.content as any[]) : []).map(p => ({
        type: p.type,
        itemId: p.providerOptions?.openai?.itemId ?? p.providerMetadata?.openai?.itemId,
      })),
    );
    const textIndex = flatB.findIndex(p => p.itemId === ACCEPTED_ITEM_ID);
    const reasoningIndex = flatB.findIndex(p => p.type === 'reasoning' && p.itemId === REASONING_ITEM_ID);
    expect(textIndex).toBeGreaterThan(-1);
    expect(reasoningIndex).toBeGreaterThan(-1);
    expect(reasoningIndex).toBeLessThan(textIndex);
  });
});
