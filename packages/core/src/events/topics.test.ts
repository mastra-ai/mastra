import { describe, it, expect } from 'vitest';
import { isRunLocalTopic } from './topics';

describe('isRunLocalTopic', () => {
  it('matches per-run workflow watch topics', () => {
    expect(isRunLocalTopic('workflow.events.v2.run-1')).toBe(true);
    expect(isRunLocalTopic('workflow.events.v2.d1e2f3-4567')).toBe(true);
  });

  it('does not match the shared workflow control topics', () => {
    expect(isRunLocalTopic('workflows')).toBe(false);
    expect(isRunLocalTopic('workflows-finish')).toBe(false);
  });

  it('does not match agent topics, which are replayed from the cache', () => {
    expect(isRunLocalTopic('agent.stream.run-1')).toBe(false);
    expect(isRunLocalTopic('agent.control.run-1')).toBe(false);
  });

  it('requires the trailing dot so the prefix cannot match a different topic', () => {
    expect(isRunLocalTopic('workflow.events.v2')).toBe(false);
    expect(isRunLocalTopic('workflow.events.v20.run-1')).toBe(false);
  });

  it('does not match when the prefix is not at the start', () => {
    expect(isRunLocalTopic('prefixed:workflow.events.v2.run-1')).toBe(false);
  });
});
