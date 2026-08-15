import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Regression tests for issue #21608: when a model fills the optional
 * `resumeData` field on a sub-agent delegation tool call while no run is
 * actually suspended, the delegation must not attempt a resume (there is no
 * `suspendedToolRunId` to load, and resuming a non-existent snapshot throws
 * AGENT_RESUME_NO_SNAPSHOT_FOUND, surfacing as an opaque delegation failure).
 * It must fall back to a fresh stream.
 */

function makeSubAgent() {
  const subAgentModel = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-id-0', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'sub-text-1' },
        { type: 'text-delta', id: 'sub-text-1', delta: 'sub-agent response' },
        { type: 'text-end', id: 'sub-text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
    }),
  });

  return new Agent({
    id: 'sub-agent',
    name: 'sub-agent',
    description: 'A sub-agent.',
    instructions: 'You answer briefly.',
    model: subAgentModel,
  });
}

function makeSupervisorModelWithResumeData() {
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
            { type: 'response-metadata', id: 'sup-id-0', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'sup-call-1',
              toolName: 'agent-subAgent',
              // resumeData present, suspendedToolRunId absent -- the model
              // invented resumeData because the schema always exposes it.
              input: JSON.stringify({
                prompt: 'do the thing',
                resumeData: { someKey: 'someValue' },
              }),
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
          { type: 'response-metadata', id: 'sup-id-1', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'sup-text-1' },
          { type: 'text-delta', id: 'sup-text-1', delta: 'all done' },
          { type: 'text-end', id: 'sup-text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

describe('Sub-agent delegation: resumeData without a suspended run (issue #21608)', () => {
  it('runs the sub-agent fresh instead of resuming a non-existent snapshot', async () => {
    const subAgent = makeSubAgent();
    const resumeSpy = vi.spyOn(subAgent, 'resumeStream').mockImplementation(
      (() => Promise.reject(new Error('resumeStream must not be called'))) as never,
    );
    const streamSpy = vi.spyOn(subAgent, 'stream').mockImplementation(
      (async () => {
        const original = makeSubAgent();
        return (original as any).stream('irrelevant');
      }) as never,
    );

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModelWithResumeData(),
      agents: { subAgent },
    });

    new Mastra({
      agents: { supervisor },
      storage: new InMemoryStore(),
    });

    const stream = await supervisor.stream('Please delegate', { maxSteps: 5 });
    for await (const _chunk of stream.fullStream) {
      // drain
    }

    // The delegation fell back to a fresh stream instead of trying to resume
    // a snapshot that does not exist (which would throw
    // AGENT_RESUME_NO_SNAPSHOT_FOUND before the sub-agent ever runs).
    expect(streamSpy).toHaveBeenCalled();
    expect(resumeSpy).not.toHaveBeenCalled();
  });
});
