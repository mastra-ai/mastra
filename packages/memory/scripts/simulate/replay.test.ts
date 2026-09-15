import { describe, expect, it } from 'vitest';

import { assertDistinctReplayDatabases } from './replay';

describe('assertDistinctReplayDatabases', () => {
  it('refuses identical input and target URLs before any destructive statement', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:5439/mastra_observational_memory';
    expect(() => assertDistinctReplayDatabases(url, url)).toThrow(/same database/);
  });

  it('refuses loopback-equivalent URLs that name the same database', () => {
    expect(() =>
      assertDistinctReplayDatabases(
        'postgresql://postgres:postgres@localhost:5439/mastra_observational_memory',
        'postgresql://postgres:postgres@127.0.0.1:5439/mastra_observational_memory?sslmode=disable',
      ),
    ).toThrow(/same database/);
  });

  it('allows a different database name or port on the same server', () => {
    const input = 'postgresql://postgres:postgres@127.0.0.1:5439/mastra_observational_memory';
    expect(() =>
      assertDistinctReplayDatabases(input, 'postgresql://postgres:postgres@127.0.0.1:5439/replay_a'),
    ).not.toThrow();
    expect(() =>
      assertDistinctReplayDatabases(input, 'postgresql://postgres:postgres@127.0.0.1:5440/mastra_observational_memory'),
    ).not.toThrow();
  });
});
