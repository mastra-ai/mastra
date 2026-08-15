import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

/**
 * Regression tests for delegation crashing when the model authors `resumeData`
 * but nothing is suspended.
 *
 * `resumeData` is an optional field on the generated sub-agent tool schema, so a
 * model can populate it at any time — including on a first delegation, where no
 * suspended run exists. The auto-resume system-message suffix is only injected
 * when `suspendedTools.length > 0`, so in that situation the model was never
 * even instructed to use it.
 *
 * The delegation step used to select the resume path on `resumeData` alone and
 * call `resumeStream`/`resumeGenerate` with `runId: suspendedToolRunId`, which
 * is `undefined` when the suspended-run lookup finds nothing. That resolves to
 * an unsatisfiable snapshot lookup and throws AGENT_RESUME_NO_SNAPSHOT_FOUND
 * before the sub-agent ever runs.
 *
 * Note this is distinct from resumeStream/resumeGenerate throwing when called
 * directly with an explicit-but-unknown runId — that behaviour is correct and is
 * covered by resume-stream-no-snapshot.test.ts. The bug is the delegation step
 * *choosing* the resume path when it has no run id to resume.
 */

const DELEGATION_PROMPT = 'Bulk admit the patients in the attached file.';
const SUB_AGENT_RESPONSE = 'Processing the attached file now.';

function makeSubAgentModel(invocations: { count: number }) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      invocations.count++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        text: SUB_AGENT_RESPONSE,
        content: [{ type: 'text' as const, text: SUB_AGENT_RESPONSE }],
        warnings: [],
      };
    },
    doStream: async () => {
      invocations.count++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: SUB_AGENT_RESPONSE },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
      };
    },
  });
}

/**
 * Emits a delegation tool call carrying `resumeData` and no `suspendedToolRunId`,
 * exactly as an LLM does when it treats a follow-up message as resume input.
 */
function makeSupervisorModel() {
  const delegationInput = JSON.stringify({
    prompt: DELEGATION_PROMPT,
    resumeData: { fileUrl: ['https://example.com/patients.csv'] },
  });
  let generateCallCount = 0;
  let streamCallCount = 0;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      generateCallCount++;
      if (generateCallCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'supervisor-call-1',
              toolName: 'agent-subAgent',
              input: delegationInput,
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        text: 'Done',
        content: [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
    doStream: async () => {
      streamCallCount++;
      if (streamCallCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'supervisor-call-1',
              toolName: 'agent-subAgent',
              input: delegationInput,
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
          { type: 'text-delta', id: 'text-1', delta: 'Done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

function buildSupervisor(invocations: { count: number }) {
  const subAgent = new Agent({
    id: 'sub-agent-resume-without-suspension',
    name: 'Sub Agent',
    description: 'A sub-agent that starts work from a delegation prompt',
    instructions: 'Do the work.',
    model: makeSubAgentModel(invocations),
  });

  return new Agent({
    id: 'supervisor-resume-without-suspension',
    name: 'Supervisor',
    instructions: 'Delegate to the sub-agent.',
    model: makeSupervisorModel(),
    agents: { subAgent },
  });
}

describe('sub-agent delegation with model-authored resumeData and no suspended run', () => {
  it('runs the sub-agent instead of attempting a resume (stream)', async () => {
    const invocations = { count: 0 };
    const supervisor = buildSupervisor(invocations);

    const streamResult = await supervisor.stream(DELEGATION_PROMPT, { maxSteps: 3 });
    const chunks: unknown[] = [];
    for await (const chunk of streamResult.fullStream) {
      chunks.push(chunk);
    }

    expect(invocations.count).toBeGreaterThan(0);
    expect(JSON.stringify(chunks)).not.toContain('AGENT_RESUME_NO_SNAPSHOT_FOUND');
  });

  it('runs the sub-agent instead of attempting a resume (generate)', async () => {
    const invocations = { count: 0 };
    const supervisor = buildSupervisor(invocations);

    const result = await supervisor.generate(DELEGATION_PROMPT, { maxSteps: 3 });

    expect(invocations.count).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('AGENT_RESUME_NO_SNAPSHOT_FOUND');
  });
});
