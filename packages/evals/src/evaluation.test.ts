import { Agent } from '@mastra/core/agent';
import { Metric } from '@mastra/core/eval';
import type { ModelConfig } from '@mastra/core/llm';
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

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
};

describe('evaluate', () => {
  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: modelConfig,
    });

    const result = await evaluate(electionAgent, 'Who won the 2016 US presidential election?', new TestMetric());

    expect(result.score).toBe(1);
  }, 10000);
});
