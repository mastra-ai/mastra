import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Reproduction of a UI-facing collision between a delegated sub-agent's plain
 * (non-approval) `suspend()` and the delegation wrapper's own eventual completion.
 *
 * When a sub-agent's own tool calls `context.agent.suspend()`, the delegation wrapper
 * (`agent-<subAgentId>`) forwards that as its own suspend, reusing ITS OWN toolCallId for
 * both the native `tool-<name>` UI part and the `data-tool-call-suspended` data part. A
 * client answers via that toolCallId (e.g. AI SDK's `addToolOutput`), which mutates the
 * native part's `output` to the answer. But once the sub-agent actually finishes, the
 * delegation wrapper's OWN unrelated completion (`{ text, subAgentToolResults, ... }`)
 * later lands as a genuine `tool-result` for that SAME toolCallId, overwriting the
 * client-written answer with the wrapper's own output.
 *
 * Fix: on resume, also emit a live `tool-call-suspended` chunk (marked `resumed: true`)
 * for the delegation call's toolCallId, mirroring the storage-only marker
 * `removeToolMetadata` already writes. A `data-tool-call-suspended` UI part collapses by
 * `(type, toolCallId)`, so a client keying its "already answered" check off this field
 * gets a signal that survives the later native-part overwrite.
 */

const ORDER_ID = 'ord_AAA';

function buildSubAgent() {
  const askUserQuestionTool = createTool({
    id: 'ask-user-question',
    description: 'Ask the user a question.',
    inputSchema: z.object({ question: z.string() }),
    outputSchema: z.object({ answer: z.string() }),
    execute: async (inputData: { question: string }, context?: any) => {
      const resumeData = context?.agent?.resumeData;
      if (resumeData !== undefined) {
        return { answer: resumeData.answer };
      }
      const suspend = context?.agent?.suspend;
      if (suspend) {
        return await suspend({ question: inputData.question });
      }
      return { answer: '[no user]' };
    },
  });

  let subStep = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      subStep += 1;
      const chunks =
        subStep === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sub-inner-call-1',
                toolName: 'ask-user-question',
                input: JSON.stringify({ question: 'Which locale should this order use?' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 't-done' },
              { type: 'text-delta', id: 't-done', delta: `Order ${ORDER_ID} confirmed for en-US.` },
              { type: 'text-end', id: 't-done' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Confirms a single order, asking the user for missing details.',
    instructions: 'Confirm the order in the prompt, asking the user for any missing details via ask-user-question.',
    model,
    tools: { askUserQuestionTool },
  });
}

function buildSupervisor(subAgent: Agent) {
  let step = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      step += 1;
      const chunks =
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-A',
                toolName: 'agent-subAgent',
                input: JSON.stringify({ prompt: `Confirm order ${ORDER_ID}.`, maxSteps: 3 }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'sup-final-t' },
              { type: 'text-delta', id: 'sup-final-t', delta: `Order ${ORDER_ID} is confirmed.` },
              { type: 'text-end', id: 'sup-final-t' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate order confirmation to the sub agent.',
    model,
    agents: { subAgent },
  });
}

function buildSupervisorAgent() {
  const sup = buildSupervisor(buildSubAgent());
  const mastra = new Mastra({ agents: { supervisor: sup }, logger: false, storage: new InMemoryStore() });
  return mastra.getAgent('supervisor');
}

describe('delegated plain suspend/resume: live resumed-ack chunk', () => {
  it('emits one tool-call-suspended chunk for the delegation toolCallId when the sub-agent asks a question', async () => {
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Confirm the order.', {
      maxSteps: 6,
      memory: { resource: 'rep_suspend', thread: 'thread-suspend' },
    });

    const suspensions: Array<{ toolCallId: string; toolName: string; resumed?: boolean }> = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspensions.push({
          toolCallId: (chunk as any).payload.toolCallId,
          toolName: (chunk as any).payload.toolName,
          resumed: (chunk as any).payload.resumed,
        });
      }
    }

    expect(suspensions).toHaveLength(1);
    expect(suspensions[0]).toMatchObject({ toolCallId: 'sup-tc-A', toolName: 'agent-subAgent', resumed: undefined });
  });

  it('emits a SECOND tool-call-suspended chunk marked resumed:true, for the SAME toolCallId, once resumed', async () => {
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Confirm the order.', {
      maxSteps: 6,
      memory: { resource: 'rep_suspend', thread: 'thread-suspend-ack' },
    });

    let suspendedToolCallId: string | undefined;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspendedToolCallId = (chunk as any).payload.toolCallId;
      }
    }
    expect(suspendedToolCallId).toBe('sup-tc-A');

    const resumed = await supervisor.resumeStream(
      { answer: 'en-US' },
      { runId: stream.runId, toolCallId: suspendedToolCallId },
    );

    const resumedSuspensions: Array<{ toolCallId: string; resumed?: boolean }> = [];
    let sawRealToolResultForSameId = false;
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        resumedSuspensions.push({
          toolCallId: (chunk as any).payload.toolCallId,
          resumed: (chunk as any).payload.resumed,
        });
      }
      if (chunk.type === 'tool-result' && (chunk as any).payload.toolCallId === suspendedToolCallId) {
        sawRealToolResultForSameId = true;
      }
    }

    // The live resumed-ack: same toolCallId as the original suspension, explicitly marked.
    expect(resumedSuspensions).toEqual([{ toolCallId: 'sup-tc-A', resumed: true }]);

    // Confirms the collision this fix guards against actually happens: the delegation call's
    // own genuine completion DOES land as a tool-result for the same id, after the ack.
    expect(sawRealToolResultForSameId).toBe(true);
  });
});
