import { describe, expect, it } from 'vitest';
import { phaseStreamOptions } from './phase-stream-options.js';

describe('phaseStreamOptions', () => {
  it('leaves the agent alone when the phase picks nothing', () => {
    expect(phaseStreamOptions({})).toEqual({});
    expect(phaseStreamOptions({}, 'mastra/openai/gpt-5.1')).toEqual({});
  });

  it("routes the phase's model through the gateway and asks it for the phase's thinking", () => {
    expect(phaseStreamOptions({ model: 'openai/gpt-5.1', thinking: 'high' })).toEqual({
      model: 'mastra/openai/gpt-5.1',
      providerOptions: { openai: { reasoningEffort: 'high' } },
    });
  });

  it("maps thinking alone against the agent's model", () => {
    expect(phaseStreamOptions({ thinking: 'low' }, 'mastra/openai/gpt-5.1')).toEqual({
      providerOptions: { openai: { reasoningEffort: 'low' } },
    });
  });
});
