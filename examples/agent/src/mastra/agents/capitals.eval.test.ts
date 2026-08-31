import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { createKeywordCoverageScorer } from '@mastra/evals/scorers/prebuilt';
import { getTextContentFromMastraDBMessage } from '@mastra/evals/scorers/utils';
import { evalTest } from '@mastra/evals/vitest';

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

evalTest('capitals agent answers with the expected city', {
  target: capitalsAgent,
  data: [
    { input: 'What is the capital of France?', groundTruth: 'Paris' },
    { input: 'What is the capital of Japan?', groundTruth: 'Tokyo' },
    { input: 'What is the capital of Australia?', groundTruth: 'Canberra' },
  ],
  gates: [containsGroundTruth],
  scorers: [{ scorer: createKeywordCoverageScorer(), threshold: 0.4 }],
});
