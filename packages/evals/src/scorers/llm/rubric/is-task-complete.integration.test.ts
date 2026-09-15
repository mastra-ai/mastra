import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';
import type { RubricAnalysisResult } from './prompts';
import { createRubricScorer } from '.';

/** A judge model that returns a different analysis on each call (to model fix → re-grade). */
function sequencedJudge(analyses: RubricAnalysisResult[]) {
  let call = 0;
  const next = () => {
    const analysis = analyses[Math.min(call, analyses.length - 1)];
    call++;
    return JSON.stringify(analysis);
  };

  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text: next() }],
      warnings: [],
    }),
    doStream: async () => {
      const text = next();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

/** A supervisor model that produces a text response per iteration. */
function supervisorModel(onCall: () => void) {
  const make = (n: number) => `Iteration ${n} response.`;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      onCall();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: make(1) }],
        warnings: [],
      };
    },
    doStream: async () => {
      onCall();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: make(1) },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

describe('Rubric scorer in isTaskComplete', () => {
  it('keeps iterating while a required criterion is unmet, then stops once satisfied', async () => {
    let modelCallCount = 0;

    const rubricScorer = createRubricScorer({
      model: sequencedJudge([
        // First grade: required criterion unmet → not complete.
        {
          criteria: [
            {
              criterion: 'Includes recommendations',
              satisfied: false,
              required: true,
              reasoning: 'no recommendations yet',
            },
          ],
          overallAssessment: 'Missing recommendations',
        },
        // Second grade: satisfied → complete.
        {
          criteria: [
            {
              criterion: 'Includes recommendations',
              satisfied: true,
              required: true,
              reasoning: 'recommendations present',
            },
          ],
          overallAssessment: 'Complete',
        },
      ]),
      criteria: [{ description: 'Includes recommendations' }],
    });

    const agent = new Agent({
      id: 'rubric-supervisor',
      name: 'Rubric Supervisor',
      instructions: 'You complete tasks iteratively.',
      model: supervisorModel(() => {
        modelCallCount++;
      }),
    });

    const events: any[] = [];
    const stream = await agent.stream('Research a topic and recommend next steps', {
      maxSteps: 5,
      isTaskComplete: { scorers: [rubricScorer], strategy: 'all' },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        events.push(chunk);
      }
    }

    // The model ran at least twice: the failed grade fed feedback back and triggered a re-run.
    expect(modelCallCount).toBeGreaterThanOrEqual(2);

    // Two grading events: first failed, last passed.
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].payload.passed).toBe(false);
    expect(events[events.length - 1].payload.passed).toBe(true);
  });
});
