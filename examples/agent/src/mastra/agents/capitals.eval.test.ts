import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { createKeywordCoverageScorer } from '@mastra/evals/scorers/prebuilt';
import { getTextContentFromMastraDBMessage } from '@mastra/evals/scorers/utils';
import { expectEval, expectEvals } from '@mastra/evals/vitest';
import { test } from 'vitest';

// Live evals require an OpenAI key; skip when it's not set (e.g. in CI).
const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

// Uses OPENAI_API_KEY from .env (loaded in vitest.config.ts).
const capitalsAgent = new Agent({
  id: 'capitals-eval-agent',
  name: 'Capitals Eval Agent',
  instructions: 'You are a geography assistant. Answer questions about capital cities concisely, in one sentence.',
  model: 'openai/gpt-5.4-mini',
});

// Gate: the answer must contain the expected capital (groundTruth). Score 1.0 or the run fails.
const containsGroundTruth = createScorer({
  id: 'contains-ground-truth',
  name: 'Contains ground truth',
  description: 'Checks that the agent output mentions the expected answer.',
}).generateScore(({ run }) => {
  const output = (run.output ?? [])
    .map((message: any) => getTextContentFromMastraDBMessage(message))
    .join(' ')
    .toLowerCase();
  return output.includes(String(run.groundTruth).toLowerCase()) ? 1 : 0;
});

test.skipIf(!hasOpenAIKey)('capitals agent answers with the expected city', { timeout: 60_000 }, async () => {
  await expectEvals({
    target: capitalsAgent,
    data: [
      { input: 'What is the capital of France?', groundTruth: 'Paris' },
      { input: 'What is the capital of Japan?', groundTruth: 'Tokyo' },
      { input: 'What is the capital of Australia?', groundTruth: 'Canberra' },
    ],
    gates: [containsGroundTruth],
    scorers: [{ scorer: createKeywordCoverageScorer(), threshold: 0.4 }],
  }).toPass(0.8);
});

// Matrix variant: one test (and one reporter entry) per item.
test.skipIf(!hasOpenAIKey).for([
  { input: 'What is the capital of France?', groundTruth: 'Paris' },
  { input: 'What is the capital of Japan?', groundTruth: 'Tokyo' },
  { input: 'What is the capital of Australia?', groundTruth: 'Canberra' },
])('capitals agent: $input', { timeout: 60_000 }, async item => {
  await expectEval({
    target: capitalsAgent,
    data: item,
    gates: [containsGroundTruth],
  }).toPass();
});
