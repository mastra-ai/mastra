import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_COMMANDS } from './commands.js';
import { buildCommandExamples, buildCommandUsage, getCommandSchema } from './schema.js';

const commands = (key: keyof typeof API_COMMANDS) =>
  buildCommandExamples(API_COMMANDS[key]).map(example => example.command);

describe('buildCommandUsage', () => {
  it.each([
    ['required JSON input after positionals', 'agentRun', 'mastra api agent run <agentId> <input>'],
    ['route path param positionals', 'mcpGet', 'mastra api mcp get <id>'],
    ['optional JSON input', 'agentList', 'mastra api agent list [input]'],
  ] as const)('%s', (_case, key, usage) => {
    expect(buildCommandUsage(API_COMMANDS[key])).toBe(usage);
  });
});

describe('buildCommandExamples', () => {
  it('documents agent run thread persistence', () => {
    expect(commands('agentRun')).toContain(
      'mastra api agent run weather-agent \'{"messages":"What is the weather in London?","memory":{"thread":"thread_abc123","resource":"user_123"}}\'',
    );
  });

  it('documents raw and explicit data wrapper tool execution input', () => {
    expect(commands('toolExecute')).toEqual([
      'mastra api tool execute get-weather \'{"location":"San Francisco"}\'',
      'mastra api tool execute get-weather \'{"data":{"location":"San Francisco"}}\'',
    ]);
    expect(commands('mcpToolExecute')).toEqual([
      'mastra api mcp tool execute my-server calculator \'{"num1":2,"num2":3,"operation":"add"}\'',
      'mastra api mcp tool execute my-server calculator \'{"data":{"num1":2,"num2":3,"operation":"add"}}\'',
    ]);
  });

  it('uses server query/body shapes for memory and thread examples', () => {
    expect(commands('memorySearch')).toEqual([
      'mastra api memory search \'{"agentId":"weather-agent","resourceId":"user_123","searchQuery":"caching strategy","limit":10}\'',
    ]);
    expect(commands('memoryCurrentGet')).toEqual([
      'mastra api memory current get \'{"threadId":"thread_abc123","agentId":"code-reviewer"}\'',
    ]);
    expect(commands('memoryCurrentUpdate')).toEqual([
      'mastra api memory current update \'{"threadId":"thread_abc123","agentId":"code-reviewer","workingMemory":"Remember the user prefers concise responses."}\'',
    ]);
    expect(commands('threadCreate')).toEqual([
      'mastra api thread create \'{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123","title":"Support conversation"}\'',
    ]);
    expect(commands('threadUpdate')).toEqual([
      'mastra api thread update thread_abc123 \'{"agentId":"weather-agent","title":"Updated title"}\'',
    ]);
    expect(commands('threadDelete')).toEqual([
      'mastra api thread delete thread_abc123 \'{"agentId":"weather-agent","resourceId":"user_123"}\'',
    ]);
  });

  it('documents required/optional observability query filters', () => {
    expect(commands('memoryStatus')).toEqual([
      'mastra api memory status \'{"agentId":"weather-agent"}\'',
      'mastra api memory status \'{"agentId":"weather-agent","resourceId":"user_123","threadId":"thread_abc123"}\'',
    ]);
    expect(commands('logList')).toEqual([
      'mastra api log list',
      'mastra api log list \'{"level":"info","page":0,"perPage":50}\'',
    ]);
  });

  it('uses observability score route shapes', () => {
    expect(commands('scoreCreate')).toEqual([
      'mastra api score create \'{"score":{"scoreId":"score_123","scorerId":"quality","score":0.95,"runId":"run_123","entityType":"agent","entityId":"weather-agent"}}\'',
    ]);
    expect(commands('scoreList')).toEqual([
      'mastra api score list \'{"page":0,"perPage":50}\'',
      'mastra api score list \'{"runId":"run_123","page":0,"perPage":50}\'',
    ]);
    expect(commands('scoreGet')).toEqual(['mastra api score get score_123']);
  });

  it('builds generic examples from descriptor metadata', () => {
    expect(commands('mcpGet')).toEqual(['mastra api mcp get id_123']);
    expect(commands('datasetCreate')).toEqual(['mastra api dataset create \'{"name":"weather-eval"}\'']);
    expect(commands('experimentRun')).toEqual(['mastra api experiment run dataset_123 \'{"name":"baseline"}\'']);
  });
});

describe('getCommandSchema', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails clearly when the target returns an invalid manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: {} }), { status: 200 })));

    await expect(
      getCommandSchema(API_COMMANDS.agentRun, { baseUrl: 'https://example.com', headers: {}, timeoutMs: 1000 }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'SCHEMA_UNAVAILABLE',
        details: { reason: 'invalid_manifest' },
      }),
    );
  });
});
