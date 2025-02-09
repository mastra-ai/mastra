import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Metric } from '@mastra/core/eval';
import { describe, expect, it } from 'vitest';

import { evaluate } from './evaluation';

class TestMetric extends Metric {
  async measure() {
    return {
      score: 1,
      reason: 'test',
    };
  }
}

describe('evaluate', () => {
  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: openai('gpt-4o'),
    });

    const result = await evaluate(electionAgent, 'Who won the 2016 US presidential election?', new TestMetric());

    expect(result.score).toBe(1);
  }, 10000);
});
