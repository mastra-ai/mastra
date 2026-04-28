import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_COMMANDS } from './commands';
import { executeDescriptor, registerApiCommand } from './index';

const fetchMock = vi.fn();
let stdout = '';
let stderr = '';

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  stdout = '';
  stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderr += String(chunk);
    return true;
  });
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

describe('API_COMMANDS', () => {
  it('composes CLI specs with generated route metadata', () => {
    expect(API_COMMANDS.agentList).toMatchObject({
      method: 'GET',
      path: '/agents',
      positionals: [],
      acceptsInput: true,
      list: true,
      responseShape: { kind: 'record' },
    });
    expect(API_COMMANDS.memoryCurrentGet).toMatchObject({
      method: 'GET',
      path: '/memory/threads/:threadId/working-memory',
      positionals: [],
      acceptsInput: true,
      inputRequired: true,
    });
    expect(API_COMMANDS.workflowRunResume.positionals).toEqual(['workflowId', 'runId']);
    expect(API_COMMANDS.workflowRunStart.defaultTimeoutMs).toBe(120_000);
    expect(API_COMMANDS.workflowRunResume.defaultTimeoutMs).toBe(120_000);
  });
});

describe('api command registration', () => {
  it('only exposes --schema on commands that accept JSON input', () => {
    const program = new Command();
    registerApiCommand(program);

    const api = program.commands.find(command => command.name() === 'api');
    const agent = api?.commands.find(command => command.name() === 'agent');
    const agentList = agent?.commands.find(command => command.name() === 'list');
    const agentGet = agent?.commands.find(command => command.name() === 'get');
    const agentRun = agent?.commands.find(command => command.name() === 'run');

    expect(api?.helpInformation()).not.toContain('--schema');
    expect(agentList?.helpInformation()).toContain('--schema');
    expect(agentRun?.helpInformation()).toContain('--schema');
    expect(agentGet?.helpInformation()).not.toContain('--schema');
  });

  it('adds shared examples to command help output', () => {
    const program = new Command();
    let help = '';
    program.configureOutput({ writeOut: value => (help += value) });
    registerApiCommand(program);

    const api = program.commands.find(command => command.name() === 'api');
    const agent = api?.commands.find(command => command.name() === 'agent');
    const agentRun = agent?.commands.find(command => command.name() === 'run');

    agentRun?.outputHelp();

    expect(help).toContain('Examples:');
    expect(help).toContain('mastra api agent run weather-agent');
  });
});

describe('api command executor', () => {
  it('sends explicit URL requests without implicit auth and wraps list output', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'agent-1' }]));

    await executeDescriptor(API_COMMANDS.agentList, [], undefined, {
      url: 'https://example.com',
      header: [],
      timeout: '5000',
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/agents', {
      method: 'GET',
      headers: {},
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(stdout)).toEqual({
      data: [{ id: 'agent-1' }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
    expect(stderr).toBe('');
    expect(process.exitCode).toBeUndefined();
  });

  it('parses custom headers and sends JSON body for mutating requests', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        text: 'hello',
        totalUsage: { totalTokens: 12 },
        spanId: 'span-1',
        messages: [{ role: 'assistant', content: 'hello' }],
        dbMessages: [{ role: 'assistant', content: 'hello' }],
      }),
    );

    await executeDescriptor(API_COMMANDS.agentRun, ['agent-1'], '{"messages":[{"role":"user","content":"hi"}]}', {
      url: 'https://example.com/api',
      header: ['X-Test: yes'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/agents/agent-1/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Test': 'yes' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect(JSON.parse(stdout)).toEqual({ data: { text: 'hello', usage: { totalTokens: 12 }, spanId: 'span-1' } });
  });

  it('encodes GET input with page/perPage query params', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ scores: [], pagination: { total: 125, page: 2, perPage: 50, hasMore: true } }),
    );

    await executeDescriptor(
      API_COMMANDS.scoreList,
      [],
      '{"runId":"run-1","page":2,"perPage":50,"filters":{"a":true}}',
      {
        url: 'https://example.com',
        header: [],
        pretty: false,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/observability/scores?runId=run-1&page=2&perPage=50&filters=%7B%22a%22%3Atrue%7D',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(stdout)).toEqual({ data: [], page: { total: 125, page: 2, perPage: 50, hasMore: true } });
  });

  it('prints invalid JSON errors to stderr only', async () => {
    await executeDescriptor(API_COMMANDS.toolExecute, ['weather'], '{bad', {
      url: 'https://example.com',
      header: [],
      pretty: false,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stdout).toBe('');
    expect(JSON.parse(stderr)).toMatchObject({ error: { code: 'INVALID_JSON' } });
    expect(process.exitCode).toBe(1);
  });

  it('normalizes workflow run status values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ runId: 'run-1', status: 'completed' }));

    await executeDescriptor(API_COMMANDS.workflowRunGet, ['workflow-1', 'run-1'], undefined, {
      url: 'https://example.com',
      header: [],
      pretty: false,
    });

    expect(JSON.parse(stdout)).toEqual({ data: { runId: 'run-1', status: 'success' } });
  });

  it('passes workflow run resume runId as query and keeps JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ runId: 'run-1', status: 'running' }));

    await executeDescriptor(API_COMMANDS.workflowRunResume, ['workflow-1', 'run-1'], '{"resumeData":{"ok":true}}', {
      url: 'https://example.com',
      header: [],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/workflows/workflow-1/resume-async?runId=run-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ resumeData: { ok: true } }),
    });
  });

  it('uses longer default timeout for workflow execution unless overridden', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    await executeDescriptor(API_COMMANDS.workflowRunStart, ['workflow-1'], '{"inputData":{"city":"seoul"}}', {
      url: 'https://example.com',
      header: [],
      pretty: false,
    });

    expect(JSON.parse(stderr)).toMatchObject({
      error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out after 120000ms', details: { timeoutMs: 120_000 } },
    });

    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    stdout = '';
    stderr = '';
    process.exitCode = undefined;

    await executeDescriptor(API_COMMANDS.workflowRunStart, ['workflow-1'], '{"inputData":{"city":"seoul"}}', {
      url: 'https://example.com',
      header: [],
      timeout: '5000',
      pretty: false,
    });

    expect(JSON.parse(stderr)).toMatchObject({
      error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out after 5000ms', details: { timeoutMs: 5_000 } },
    });
  });

  it('prints schema from target manifest without requiring JSON input', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        routes: [
          {
            method: 'POST',
            path: '/tools/:toolId/execute',
            pathParamSchema: { type: 'object' },
            bodySchema: { type: 'object', properties: { input: { type: 'object' } } },
          },
        ],
      }),
    );

    await executeDescriptor(API_COMMANDS.toolExecute, ['weather'], undefined, {
      url: 'https://example.com',
      header: [],
      schema: true,
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/system/api-schema',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(stdout)).toMatchObject({
      command: 'mastra api tool execute <toolId> <input>',
      description: 'Execute a tool with JSON input',
      method: 'POST',
      path: '/tools/:toolId/execute',
      positionals: [{ name: 'toolId', required: true }],
      input: {
        required: true,
        source: 'body',
        schema: { type: 'object', properties: { input: { type: 'object' } } },
      },
      schemas: {
        pathParams: { type: 'object' },
        body: { type: 'object', properties: { input: { type: 'object' } } },
      },
      examples: [
        {
          description: 'Execute a tool with parameters',
          command: 'mastra api tool execute weather \'{"params":{"city":"San Francisco"}}\'',
        },
      ],
    });
    expect(stderr).toBe('');
    expect(process.exitCode).toBeUndefined();
  });

  it('prints schema for JSON-identity commands without requiring path params from input', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        routes: [
          {
            method: 'GET',
            path: '/memory/threads/:threadId/working-memory',
            pathParamSchema: { type: 'object', properties: { threadId: { type: 'string' } } },
            queryParamSchema: { type: 'object', properties: { agentId: { type: 'string' } } },
          },
        ],
      }),
    );

    await executeDescriptor(API_COMMANDS.memoryCurrentGet, [], undefined, {
      url: 'https://example.com',
      header: [],
      schema: true,
      pretty: false,
    });

    expect(JSON.parse(stdout)).toMatchObject({
      command: 'mastra api memory current get <input>',
      method: 'GET',
      path: '/memory/threads/:threadId/working-memory',
      positionals: [],
      input: {
        required: true,
        source: 'query',
        schema: { type: 'object', properties: { agentId: { type: 'string' } } },
      },
      schemas: {
        pathParams: { type: 'object', properties: { threadId: { type: 'string' } } },
        query: { type: 'object', properties: { agentId: { type: 'string' } } },
      },
      examples: [
        {
          description: 'Read current working memory',
          command: 'mastra api memory current get \'{"threadId":"thread_abc123","agentId":"code-reviewer"}\'',
        },
      ],
    });
    expect(stderr).toBe('');
    expect(process.exitCode).toBeUndefined();
  });

  it('allows schema discovery commands without identity positionals', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        routes: [
          {
            method: 'POST',
            path: '/agents/:agentId/generate',
            pathParamSchema: { type: 'object', properties: { agentId: { type: 'string' } } },
            bodySchema: { type: 'object', properties: { messages: { type: 'array' } } },
          },
        ],
      }),
    );

    const program = new Command();
    program.exitOverride();
    registerApiCommand(program);

    await program.parseAsync(['node', 'mastra', 'api', '--url', 'https://example.com', 'agent', 'run', '--schema']);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/system/api-schema',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(stdout)).toMatchObject({
      command: 'mastra api agent run <agentId> <input>',
      method: 'POST',
      path: '/agents/:agentId/generate',
      positionals: [{ name: 'agentId', required: true, schema: { type: 'string' } }],
      input: {
        required: true,
        source: 'body',
        schema: { type: 'object', properties: { messages: { type: 'array' } } },
      },
      examples: [
        {
          description: 'Run an agent with a text prompt',
          command: 'mastra api agent run weather-agent \'{"messages":"What is the weather in London?"}\'',
        },
        {
          description: 'Run an agent and persist messages to a thread',
          command:
            'mastra api agent run weather-agent \'{"messages":"What is the weather in London?","memory":{"thread":"thread_abc123","resource":"user_123"}}\'',
        },
      ],
    });
    expect(stderr).toBe('');
    expect(process.exitCode).toBeUndefined();
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
