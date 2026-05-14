import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_COMMANDS, executeDescriptor, registerApiCommand } from './index';

const fetchMock = vi.fn();
let stdout = '';
let stderr = '';

beforeEach(() => {
  registerApiCommand(new Command());
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

  it('exposes verbose trace and span trace commands', () => {
    const program = new Command();
    registerApiCommand(program);

    const api = program.commands.find(command => command.name() === 'api');
    const trace = api?.commands.find(command => command.name() === 'trace');
    const traceGet = trace?.commands.find(command => command.name() === 'get');

    expect(trace?.commands.find(command => command.name() === 'list')?.helpInformation()).toContain('--verbose');
    expect(traceGet?.helpInformation()).toContain('--verbose');
    expect(trace?.commands.find(command => command.name() === 'span')?.description()).toBe('Get a trace span');
    expect(API_COMMANDS.traceList).toMatchObject({ method: 'GET', path: '/observability/traces/light' });
    expect(API_COMMANDS.traceGet).toMatchObject({ method: 'GET', path: '/observability/traces/:traceId/light' });
    expect(API_COMMANDS.traceSpan).toMatchObject({
      method: 'GET',
      path: '/observability/traces/:traceId/spans/:spanId',
    });
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

  it('does not treat JSON input as an identity argument', async () => {
    const program = new Command();
    registerApiCommand(program);

    await program.parseAsync([
      'node',
      'mastra',
      'api',
      '--url',
      'https://example.com/api',
      'agent',
      'run',
      '{"messages":[{"role":"user","content":"hi"}]}',
    ]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(stderr)).toMatchObject({
      error: { code: 'MISSING_ARGUMENT', message: 'Missing required argument <agentId>' },
    });
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

  it('lists lightweight traces by default and full traces with --verbose', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          spans: [{ traceId: 'trace-1', spanId: 'span-1', name: 'agent' }],
          pagination: { total: 1, page: 0, perPage: 1, hasMore: false },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          spans: [{ traceId: 'trace-1', spanId: 'span-1', input: { value: 'hello' } }],
          pagination: { total: 1, page: 0, perPage: 1, hasMore: false },
        }),
      );

    await executeDescriptor(API_COMMANDS.traceList, [], '{"page":0,"perPage":1}', {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://observability.mastra.ai/api/observability/traces/light?page=0&perPage=1',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer token', 'X-Mastra-Project-Id': 'project-1' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(JSON.parse(stdout)).toEqual({
      data: [{ traceId: 'trace-1', spanId: 'span-1', name: 'agent' }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });

    stdout = '';

    await executeDescriptor(API_COMMANDS.traceList, [], '{"page":0,"perPage":1}', {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
      verbose: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://observability.mastra.ai/api/observability/traces?page=0&perPage=1',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer token', 'X-Mastra-Project-Id': 'project-1' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(JSON.parse(stdout)).toEqual({
      data: [{ traceId: 'trace-1', spanId: 'span-1', input: { value: 'hello' } }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
  });

  it('falls back to the verbose trace list when the lightweight route is missing on the server', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Not found' }, { status: 404 })).mockResolvedValueOnce(
      jsonResponse({
        spans: [{ traceId: 'trace-1', spanId: 'span-1', input: { value: 'hello' } }],
        pagination: { total: 1, page: 0, perPage: 1, hasMore: false },
      }),
    );

    await executeDescriptor(API_COMMANDS.traceList, [], '{"page":0,"perPage":1}', {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://observability.mastra.ai/api/observability/traces/light?page=0&perPage=1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://observability.mastra.ai/api/observability/traces?page=0&perPage=1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(stdout)).toEqual({
      data: [{ traceId: 'trace-1', spanId: 'span-1', input: { value: 'hello' } }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
  });

  it('gets lightweight trace details by default, full trace details with --verbose, and a specific trace span', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ traceId: 'trace-1', spans: [{ traceId: 'trace-1', spanId: 'span-1', name: 'agent' }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          traceId: 'trace-1',
          spans: [{ traceId: 'trace-1', spanId: 'span-1', input: { value: 'hello' } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ traceId: 'trace-1', spanId: 'span-2', input: { value: 'hello' } }));

    await executeDescriptor(API_COMMANDS.traceGet, ['trace-1'], undefined, {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://observability.mastra.ai/api/observability/traces/trace-1/light',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer token', 'X-Mastra-Project-Id': 'project-1' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(JSON.parse(stdout)).toEqual({
      data: { traceId: 'trace-1', spans: [{ traceId: 'trace-1', spanId: 'span-1', name: 'agent' }] },
    });

    stdout = '';

    await executeDescriptor(API_COMMANDS.traceGet, ['trace-1'], undefined, {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
      verbose: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://observability.mastra.ai/api/observability/traces/trace-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer token', 'X-Mastra-Project-Id': 'project-1' },
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(stdout)).toEqual({
      data: { traceId: 'trace-1', spans: [{ traceId: 'trace-1', spanId: 'span-1', input: { value: 'hello' } }] },
    });

    stdout = '';

    await executeDescriptor(API_COMMANDS.traceSpan, ['trace-1', 'span-2'], undefined, {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://observability.mastra.ai/api/observability/traces/trace-1/spans/span-2',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer token', 'X-Mastra-Project-Id': 'project-1' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(JSON.parse(stdout)).toEqual({ data: { traceId: 'trace-1', spanId: 'span-2', input: { value: 'hello' } } });
  });

  it('queries metric aggregates and discovery endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ value: 123 }))
      .mockResolvedValueOnce(jsonResponse({ series: [{ timestamp: '2026-05-13T00:00:00Z', value: 42 }] }))
      .mockResolvedValueOnce(jsonResponse({ names: ['latency_ms'] }));

    await executeDescriptor(API_COMMANDS.metricAggregate, [], '{"name":"latency_ms","aggregation":"avg"}', {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://observability.mastra.ai/api/observability/metrics/aggregate',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'X-Mastra-Project-Id': 'project-1',
          'content-type': 'application/json',
        },
        signal: expect.any(AbortSignal),
        body: JSON.stringify({ name: 'latency_ms', aggregation: 'avg' }),
      },
    );
    expect(JSON.parse(stdout)).toEqual({ data: { value: 123 } });

    stdout = '';

    await executeDescriptor(
      API_COMMANDS.metricTimeseries,
      [],
      '{"name":"latency_ms","aggregation":"avg","interval":"1h"}',
      {
        url: 'https://observability.mastra.ai',
        header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
        pretty: false,
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://observability.mastra.ai/api/observability/metrics/timeseries',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'X-Mastra-Project-Id': 'project-1',
          'content-type': 'application/json',
        },
        signal: expect.any(AbortSignal),
        body: JSON.stringify({ name: 'latency_ms', aggregation: 'avg', interval: '1h' }),
      },
    );
    expect(JSON.parse(stdout)).toEqual({
      data: [{ timestamp: '2026-05-13T00:00:00Z', value: 42 }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });

    stdout = '';

    await executeDescriptor(API_COMMANDS.metricNames, [], '{"prefix":"lat","limit":10}', {
      url: 'https://observability.mastra.ai',
      header: ['Authorization: Bearer token', 'X-Mastra-Project-Id: project-1'],
      pretty: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://observability.mastra.ai/api/observability/discovery/metric-names?prefix=lat&limit=10',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer token', 'X-Mastra-Project-Id': 'project-1' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(JSON.parse(stdout)).toEqual({
      data: ['latency_ms'],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
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
