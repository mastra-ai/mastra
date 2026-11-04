import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createScorer } from '../../../../evals';
import { StreamErrorRetryProcessor } from '../../../../processors';
import { useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A team tracks what their evals cost from the judge usage on a scorer result. A dropped connection
 * forces the judge to retry. The score is still right, so the cost of the attempt that reported
 * must stay on the result. The judge is always a plain agent, whichever engine the scored agent
 * used, so this runs once.
 */

const midStreamDrop = { chunkSize: 5, latency: 20, disconnectAfterMs: 150 };

describe('Scorer judge usage after a retry recovers a call', () => {
  const getMock = useLoopScenarioAimock();

  it('a judge reply cut off and retried keeps the score and the counts of the attempt that reported', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { content: JSON.stringify({ relevance: 0.8, notes: 'on topic and answers the question' }) },
      midStreamDrop,
    );
    llm.on(
      { endpoint: 'chat', sequenceIndex: 1 },
      {
        content: JSON.stringify({ relevance: 0.8, notes: 'on topic' }),
        usage: { input_tokens: 100, output_tokens: 20 },
      },
    );
    const onFinish = vi.fn();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const scorer = createScorer({
      id: 'relevance-after-retry',
      description: 'Scores how relevant a reply is',
      judge: {
        model: openai(SCENARIO_MODEL_ID),
        instructions: 'Rate the relevance of the reply.',
        errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2 })],
        onFinish,
      },
    })
      .analyze({
        description: 'Rate the reply',
        outputSchema: z.object({ relevance: z.number(), notes: z.string() }),
        createPrompt: ({ run }) => `Rate this reply: ${JSON.stringify(run.output)}`,
      })
      .generateScore(({ results }) => results.analyzeStepResult.relevance);

    const result = await scorer.run({
      input: [{ role: 'user', content: 'Where is my order?' }],
      output: { role: 'assistant', text: 'It ships today.' },
    });

    expect(llm.getRequests()).toHaveLength(2);
    expect(result.score).toBe(0.8);
    expect(result.judge?.analyze?.executions).toHaveLength(1);
    expect(result.judge?.analyze?.executions[0]).toMatchObject({
      status: 'success',
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    });

    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onFinish.mock.calls[0]![0].totalUsage).toMatchObject({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    });
  });
});
