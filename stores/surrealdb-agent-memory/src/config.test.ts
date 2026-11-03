import type { AgentMemory } from '@surrealdb/memory';
import { describe, expect, it } from 'vitest';
import { isAgentMemoryInstanceConfig } from './config';

describe('isAgentMemoryInstanceConfig', () => {
  it('returns true when a pre-built client is provided', () => {
    expect(isAgentMemoryInstanceConfig({ agentMemory: {} as AgentMemory })).toBe(true);
  });

  it('returns false for credentials config', () => {
    expect(
      isAgentMemoryInstanceConfig({
        endpoint: 'https://api.example.com',
        context: 'acme',
        apiKey: 'sp-key',
      }),
    ).toBe(false);
  });
});
