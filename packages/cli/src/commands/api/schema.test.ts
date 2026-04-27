import { describe, expect, it } from 'vitest';

import { API_COMMANDS } from './commands.js';
import { buildCommandExamples, buildCommandUsage } from './schema.js';

describe('buildCommandUsage', () => {
  it('shows positionals and required JSON input in CLI order', () => {
    expect(buildCommandUsage(API_COMMANDS.agentRun)).toBe('mastra api agent run <agentId> <input>');
  });

  it('uses route path param names for positionals', () => {
    expect(buildCommandUsage(API_COMMANDS.mcpGet)).toBe('mastra api mcp get <id>');
  });

  it('shows optional JSON input for list commands', () => {
    expect(buildCommandUsage(API_COMMANDS.agentList)).toBe('mastra api agent list [input]');
  });
});

describe('buildCommandExamples', () => {
  it('includes an agent memory example for persisting messages to a thread', () => {
    expect(buildCommandExamples(API_COMMANDS.agentRun)).toContainEqual({
      description: 'Run an agent and persist messages to a thread',
      command:
        'mastra api agent run weather-agent \'{"messages":"What is the weather in London?","memory":{"thread":"thread_abc123","resource":"user_123"}}\'',
    });
  });

  it('uses page and perPage for generic list examples', () => {
    expect(buildCommandExamples(API_COMMANDS.scoreList)).toEqual([
      { description: 'List scores', command: 'mastra api score list \'{"page":0,"perPage":50}\'' },
    ]);
  });

  it('uses route path param names in generic positional examples', () => {
    expect(buildCommandExamples(API_COMMANDS.mcpGet)).toEqual([
      { description: 'Get MCP server details', command: 'mastra api mcp get id_123' },
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
