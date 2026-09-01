import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

/**
 * A sub-agent delegation must not take the resume path just because the model
 * populated `resumeData`.
 *
 * `resumeData` is an always-exposed optional field on the generated sub-agent tool
 * schema, while the instruction explaining it is only injected when a suspension
 * actually exists. Models therefore fill it unprompted — and the delegation step
 * then called resumeGenerate/resumeStream with an undefined runId, which threw
 * AGENT_RESUME_NO_SNAPSHOT_FOUND before the sub-agent ever ran.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/21608
 */

let subAgentCalls = 0;

function buildSubAgent() {
  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      subAgentCalls += 1;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: 'work done' }],
      };
    },
    doStream: async () => {
      subAgentCalls += 1;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'sub-t' },
          { type: 'text-delta', id: 'sub-t', delta: 'work done' },
          { type: 'text-end', id: 'sub-t' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Does the work.',
    instructions: 'Do the work described in the prompt.',
    model,
  });
}

/**
 * Supervisor whose first turn emits a single delegation carrying model-authored
 * `resumeData` and no `suspendedToolRunId` — nothing is suspended anywhere.
 */
function buildSupervisor() {
  let step = 0;
  const delegationInput = JSON.stringify({
    prompt: 'do the work',
    resumeData: { fileUrl: ['https://example.com/f.pdf'] },
  });
  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      step += 1;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: step === 1 ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content:
          step === 1
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'sup-tc-1',
                  toolName: 'agent-subAgent',
                  input: delegationInput,
                },
              ]
            : [{ type: 'text' as const, text: 'all done' }],
      };
    },
    doStream: async () => {
      step += 1;
      const chunks =
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-1',
                toolName: 'agent-subAgent',
                input: delegationInput,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'sup-t' },
              { type: 'text-delta', id: 'sup-t', delta: 'all done' },
              { type: 'text-end', id: 'sup-t' },
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

  const supervisor = new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate to the sub agent.',
    model,
    agents: { subAgent: buildSubAgent() },
  });

  const mastra = new Mastra({ agents: { supervisor }, logger: false, storage: new InMemoryStore() });
  return mastra.getAgent('supervisor');
}

function mentionsNoSnapshotError(value: unknown): boolean {
  return JSON.stringify(value ?? '')?.includes('AGENT_RESUME_NO_SNAPSHOT_FOUND') ?? false;
}

describe('sub-agent delegation with model-authored resumeData and no suspended run', () => {
  beforeEach(() => {
    subAgentCalls = 0;
  });

  it('runs the sub-agent instead of resuming (stream)', async () => {
    const supervisor = buildSupervisor();

    const result = await supervisor.stream('do the work', { maxSteps: 3 });

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    expect(chunks.some(mentionsNoSnapshotError)).toBe(false);
    expect(subAgentCalls).toBe(1);
  });

  it('runs the sub-agent instead of resuming (generate)', async () => {
    const supervisor = buildSupervisor();

    const result = await supervisor.generate('do the work', { maxSteps: 3 });

    expect(mentionsNoSnapshotError(result.toolResults)).toBe(false);
    expect(subAgentCalls).toBe(1);
  });
});
