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

  it('forwards --header values to API requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'agent-1' }]));

    await executeDescriptor(API_COMMANDS.agentList, [], undefined, {
      url: 'https://example.com',
      header: ['Authorization: Bearer cli-test-token', 'X-Test-Run: auth-smoke'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/agents', {
      method: 'GET',
      headers: { Authorization: 'Bearer cli-test-token', 'X-Test-Run': 'auth-smoke' },
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(stdout)).toEqual({
      data: [{ id: 'agent-1' }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
  });

  it('runs an agent with JSON body and writes concise normalized output', async () => {
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
      header: [],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/agents/agent-1/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect(JSON.parse(stdout)).toEqual({ data: { text: 'hello', usage: { totalTokens: 12 }, spanId: 'span-1' } });
  });

  it('wraps raw tool execution input in data before sending the request body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ temperature: 72 }));

    await executeDescriptor(API_COMMANDS.toolExecute, ['get-weather'], '{"location":"Berlin"}', {
      url: 'https://example.com',
      header: [],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/tools/get-weather/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ data: { location: 'Berlin' } }),
    });
  });

  it('does not double-wrap explicit tool execution data input', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ temperature: 72 }));

    await executeDescriptor(API_COMMANDS.toolExecute, ['get-weather'], '{"data":{"location":"Berlin"}}', {
      url: 'https://example.com',
      header: [],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/tools/get-weather/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ data: { location: 'Berlin' } }),
    });
  });

  it('splits non-GET JSON input into route-defined query params and request body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'thread-1', resourceId: 'user-1' }));

    await executeDescriptor(
      API_COMMANDS.threadCreate,
      [],
      '{"agentId":"weather-agent","resourceId":"user-1","threadId":"thread-1","title":"Test thread"}',
      {
        url: 'https://example.com',
        header: [],
        pretty: false,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/memory/threads?agentId=weather-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ resourceId: 'user-1', threadId: 'thread-1', title: 'Test thread' }),
    });
  });

  it('encodes DELETE JSON input as query params when the route has no body schema', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: 'Thread deleted' }));

    await executeDescriptor(
      API_COMMANDS.threadDelete,
      ['thread-1'],
      '{"agentId":"weather-agent","resourceId":"user-1"}',
      {
        url: 'https://example.com',
        header: [],
        pretty: false,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/memory/threads/thread-1?agentId=weather-agent&resourceId=user-1',
      {
        method: 'DELETE',
        headers: {},
        signal: expect.any(AbortSignal),
      },
    );
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
