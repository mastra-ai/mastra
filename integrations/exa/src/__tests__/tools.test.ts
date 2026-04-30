import { describe, it, expect, vi } from 'vitest';

vi.mock('exa-js', () => {
  class FakeExa {
    headers = { set: vi.fn() };
    search = vi.fn();
    findSimilar = vi.fn();
    getContents = vi.fn();
    answer = vi.fn();
  }
  return { default: FakeExa };
});

import { createExaTools } from '../tools.js';

describe('createExaTools', () => {
  it('returns all four tools', () => {
    const tools = createExaTools({ apiKey: 'test-key' });

    expect(tools.exaSearch).toBeDefined();
    expect(tools.exaFindSimilar).toBeDefined();
    expect(tools.exaGetContents).toBeDefined();
    expect(tools.exaAnswer).toBeDefined();
  });

  it('creates tools with the correct ids', () => {
    const tools = createExaTools({ apiKey: 'test-key' });

    expect(tools.exaSearch.id).toBe('exa-search');
    expect(tools.exaFindSimilar.id).toBe('exa-find-similar');
    expect(tools.exaGetContents.id).toBe('exa-get-contents');
    expect(tools.exaAnswer.id).toBe('exa-answer');
  });

  it('every tool has a description, input schema, and output schema', () => {
    const tools = createExaTools({ apiKey: 'test-key' });

    for (const tool of Object.values(tools)) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    }
  });
});
