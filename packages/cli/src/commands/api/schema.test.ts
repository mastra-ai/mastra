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

  it('uses observability score shapes for score examples', () => {
    expect(buildCommandExamples(API_COMMANDS.scoreCreate)).toEqual([
      {
        description: 'Create an observability score',
        command:
          'mastra api score create \'{"score":{"scoreId":"score_123","scorerId":"quality","score":0.95,"runId":"run_123","entityType":"agent","entityId":"weather-agent"}}\'',
      },
    ]);
    expect(buildCommandExamples(API_COMMANDS.scoreList)).toEqual([
      {
        description: 'List observability scores with pagination',
        command: 'mastra api score list \'{"page":0,"perPage":50}\'',
      },
      {
        description: 'List observability scores for a run',
        command: 'mastra api score list \'{"runId":"run_123","page":0,"perPage":50}\'',
      },
    ]);
    expect(buildCommandExamples(API_COMMANDS.scoreGet)).toEqual([
      { description: 'Get an observability score by ID', command: 'mastra api score get score_123' },
    ]);
  });

  it('uses route path param names in generic positional examples', () => {
    expect(buildCommandExamples(API_COMMANDS.mcpGet)).toEqual([
      { description: 'Get MCP server details', command: 'mastra api mcp get id_123' },
    ]);
  });

  it('uses the server query shape for memory search examples', () => {
    expect(buildCommandExamples(API_COMMANDS.memorySearch)).toEqual([
      {
        description: 'Search long-term memory',
        command:
          'mastra api memory search \'{"agentId":"weather-agent","resourceId":"user_123","searchQuery":"caching strategy","limit":10}\'',
      },
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

  it('includes memory status examples for required agentId and optional resource/thread scope', () => {
    expect(buildCommandExamples(API_COMMANDS.memoryStatus)).toEqual([
      {
        description: 'Get memory status for an agent',
        command: 'mastra api memory status \'{"agentId":"weather-agent"}\'',
      },
      {
        description: 'Get memory status for an agent, resource, and thread',
        command:
          'mastra api memory status \'{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123"}\'',
      },
    ]);
  });

  it('includes log list examples for the observability logs route', () => {
    expect(buildCommandExamples(API_COMMANDS.logList)).toEqual([
      {
        description: 'List recent logs',
        command: 'mastra api log list',
      },
      {
        description: 'List info logs with pagination',
        command: 'mastra api log list \'{"level":"info","page":0,"perPage":50}\'',
      },
    ]);
  });
});
