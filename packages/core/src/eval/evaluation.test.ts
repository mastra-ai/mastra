import { Agent } from '../agent';
import { ModelConfig } from '../llm/types';

import { evaluate } from './evaluation';
import { Metric } from './metric';

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

it('should get a text response from the agent', async () => {
  const electionAgent = new Agent({
    name: 'US Election agent',
    instructions: 'You know about the past US elections',
    model: modelConfig,
  });

  const result = await evaluate(electionAgent, 'Who won the 2016 US presidential election?', new TestMetric());

  expect(result.score).toBe(1);
});
