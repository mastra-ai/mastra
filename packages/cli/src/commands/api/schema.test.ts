import { describe, expect, it } from 'vitest';

import { API_COMMANDS } from './commands.js';
import { buildCommandExamples, buildCommandUsage } from './schema.js';

describe('buildCommandUsage', () => {
  it('shows positionals and required JSON input in CLI order', () => {
    expect(buildCommandUsage(API_COMMANDS.agentRun)).toBe('mastra api agent run <agentId> <input>');
  });

  it('shows optional JSON input for list commands', () => {
    expect(buildCommandUsage(API_COMMANDS.agentList)).toBe('mastra api agent list [input]');
  });
});

describe('buildCommandExamples', () => {
  it('uses page and perPage for generic list examples', () => {
    expect(buildCommandExamples(API_COMMANDS.scoreList)).toEqual([
      { description: 'List scores', command: 'mastra api score list \'{"page":0,"perPage":50}\'' },
    ]);
  });

  it('includes JSON identity path params in required GET input examples', () => {
    expect(buildCommandExamples(API_COMMANDS.memoryCurrentGet)).toEqual([
      {
        description: 'Read current working memory',
        command: 'mastra api memory current get \'{"threadId":"thread_abc123","agentId":"code-reviewer"}\'',
      },
    ]);
  });
});
