import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { createAgentTestRun, createTestMessage } from '../utils';
import { createFaithfulnessScorer } from './faithfulness';
import { createHallucinationScorer } from './hallucination';

// Answers each judge call with the next scripted response: preprocess -> analyze -> reason.
function scriptedJudge(responses: string[]) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const text = responses[call] ?? responses.at(-1)!;
      call += 1;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r${call}`, modelId: 'scripted-judge', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

const claims = ['A', 'B', 'C', 'D'];
const claimsJson = JSON.stringify({ claims });
const verdicts = (vs: string[]) =>
  JSON.stringify({ verdicts: vs.map((v, i) => ({ claim: claims[i], statement: claims[i], verdict: v, reason: 'r' })) });
const run = createAgentTestRun({
  inputMessages: [createTestMessage({ id: 'u1', content: 'q', role: 'user' })],
  output: [createTestMessage({ id: 'a1', content: 'A. B. C. D.', role: 'assistant' })],
});
const context = ['A', 'B'];

describe('faithfulness score denominator', () => {
  it('counts claims without a verdict as unsupported', async () => {
    const scorer = createFaithfulnessScorer({
      model: scriptedJudge([claimsJson, verdicts(['yes', 'yes']), 'reason']),
      options: { context },
    });
    expect((await scorer.run(run)).score).toBe(0.5);
  });

  it('matches verdicts case-insensitively', async () => {
    const scorer = createFaithfulnessScorer({
      model: scriptedJudge([claimsJson, verdicts(['Yes', ' YES ', 'yes', 'Yes']), 'reason']),
      options: { context },
    });
    expect((await scorer.run(run)).score).toBe(1);
  });
});

describe('hallucination score denominator', () => {
  it('divides contradicted verdicts by the number of claims', async () => {
    const scorer = createHallucinationScorer({
      model: scriptedJudge([claimsJson, verdicts(['yes']), 'reason']),
      options: { context },
    });
    expect((await scorer.run(run)).score).toBe(0.25);
  });

  it('matches verdicts case-insensitively', async () => {
    const scorer = createHallucinationScorer({
      model: scriptedJudge([claimsJson, verdicts(['Yes', 'no', ' YES ', 'no']), 'reason']),
      options: { context },
    });
    expect((await scorer.run(run)).score).toBe(0.5);
  });
});
