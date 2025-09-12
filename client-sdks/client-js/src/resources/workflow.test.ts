import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastraClient } from '../client';
import type { ClientOptions } from '../types';
import { Workflow } from './workflow';

const createJsonResponse = (data: any) => ({ ok: true, json: async () => data });

describe('Workflow (fetch-mocked)', () => {
  let fetchMock: any;
  let wf: Workflow;

  beforeEach(() => {
    fetchMock = vi.fn((input: any) => {
      const url = String(input);
      if (url.includes('/create-run')) return Promise.resolve(createJsonResponse({ runId: 'r-123' }));
      if (url.includes('/start?runId=')) return Promise.resolve(createJsonResponse({ message: 'started' }));
      if (url.includes('/start-async')) return Promise.resolve(createJsonResponse({ result: 'started-async' }));
      if (url.includes('/resume?runId=')) return Promise.resolve(createJsonResponse({ message: 'resumed' }));
      if (url.includes('/resume-async')) return Promise.resolve(createJsonResponse({ result: 'resumed-async' }));
      if (url.includes('/watch?')) {
        const body = Workflow.createRecordStream([
          { type: 'transition', payload: { step: 's1' } },
          { type: 'transition', payload: { step: 's2' } },
        ]);
        return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
      }
      if (url.includes('/stream?')) {
        const body = Workflow.createRecordStream([
          { type: 'log', payload: { msg: 'hello' } },
          { type: 'result', payload: { ok: true } },
        ]);
        return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
      }
      return Promise.reject(new Error(`Unhandled fetch to ${url}`));
    });
    globalThis.fetch = fetchMock as any;

    const options: ClientOptions = { baseUrl: 'http://localhost', retries: 0 } as any;
    wf = new Workflow(options, 'wf-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns runId when creating new run', async () => {
    const run = await wf.createRunAsync();
    expect(run.runId).toBe('r-123');
  });

  it('starts workflow run synchronously', async () => {
    const run = await wf.createRunAsync();
    const startRes = await run.start({ inputData: { a: 1 } });
    expect(startRes).toEqual({ message: 'started' });
  });

  it('starts workflow run asynchronously', async () => {
    const run = await wf.createRunAsync();
    const startAsyncRes = await run.startAsync({ inputData: { a: 1 } });
    expect(startAsyncRes).toEqual({ result: 'started-async' });
  });

  it('resumes workflow run synchronously', async () => {
    const run = await wf.createRunAsync();
    const resumeRes = await run.resume({ step: 's1' });
    expect(resumeRes).toEqual({ message: 'resumed' });
  });

  it('resumes workflow run asynchronously', async () => {
    const run = await wf.createRunAsync();
    const resumeAsyncRes = await run.resumeAsync({ step: 's1' });
    expect(resumeAsyncRes).toEqual({ result: 'resumed-async' });
  });

  it('watches workflow transitions and yields parsed records', async () => {
    const run = await wf.createRunAsync();
    const seen: any[] = [];
    await run.watch(rec => {
      seen.push(rec);
    });
    expect(seen).toEqual([
      { type: 'transition', payload: { step: 's1' } },
      { type: 'transition', payload: { step: 's2' } },
    ]);
  });

  it('streams workflow execution as parsed objects', async () => {
    const run = await wf.createRunAsync();
    const stream = await run.stream({ inputData: { x: 1 } });
    const reader = (stream as ReadableStream<any>).getReader();
    const records: any[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      records.push(value);
    }
    expect(records).toEqual([
      { type: 'log', payload: { msg: 'hello' } },
      { type: 'result', payload: { ok: true } },
    ]);
  });

  it('start uses provided runId', async () => {
    const res = await wf.start({ runId: 'r-x', inputData: { b: 2 } });
    expect(res).toEqual({ message: 'started' });
  });
});

// Mock fetch globally for client tests
global.fetch = vi.fn();

describe('Workflow Client Methods', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('should get all workflows', async () => {
    const mockResponse = {
      workflow1: { name: 'Workflow 1' },
      workflow2: { name: 'Workflow 2' },
    };
    mockFetchResponse(mockResponse);
    const result = await client.getWorkflows();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/workflows`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get all workflows with runtimeContext', async () => {
    const mockResponse = {
      workflow1: { name: 'Workflow 1' },
      workflow2: { name: 'Workflow 2' },
    };
    const runtimeContext = { userId: '123', tenantId: 'tenant-456' };
    const expectedBase64 = btoa(JSON.stringify(runtimeContext));
    const expectedEncodedBase64 = encodeURIComponent(expectedBase64);

    mockFetchResponse(mockResponse);
    const result = await client.getWorkflows(runtimeContext);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/workflows?runtimeContext=${expectedEncodedBase64}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});
