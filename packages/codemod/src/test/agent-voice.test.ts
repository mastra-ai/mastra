import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/agent-voice';
import { testTransform, applyTransform } from './test-utils';

describe('agent-voice', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-voice');
  });

  it('does not transform voice methods on non-Agent variables', () => {
    const input = `
// Some other object, not from new Agent()
const agent = {
  speak: (text) => console.log(text),
  listen: () => {},
  getSpeakers: () => [],
};

// Should not be transformed
await agent.speak('Hello');
await agent.listen();
const speakers = agent.getSpeakers();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
