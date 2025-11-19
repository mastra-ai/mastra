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
    const run = await wf.createRun();
    expect(run.runId).toBe('r-123');
  });

  it('starts workflow run synchronously', async () => {
    const run = await wf.createRun();
    const startRes = await run.start({ inputData: { a: 1 } });
    expect(startRes).toEqual({ message: 'started' });
  });

  it('starts workflow run asynchronously', async () => {
    const run = await wf.createRun();
    const startAsyncRes = await run.startAsync({ inputData: { a: 1 } });
    expect(startAsyncRes).toEqual({ result: 'started-async' });
  });

  it('resumes workflow run synchronously', async () => {
    const run = await wf.createRun();
    const resumeRes = await run.resume({ step: 's1' });
    expect(resumeRes).toEqual({ message: 'resumed' });
  });

  it('resumes workflow run asynchronously', async () => {
    const run = await wf.createRun();
    const resumeAsyncRes = await run.resumeAsync({ step: 's1' });
    expect(resumeAsyncRes).toEqual({ result: 'resumed-async' });
  });

  it('streams workflow execution as parsed objects', async () => {
    const run = await wf.createRun();
    const stream = await run.stream({ inputData: { x: 1 } });
    const records: any[] = [];
    for await (const chunk of stream.fullStream) {
      records.push(chunk);
    }
    expect(records).toEqual([
      { type: 'log', payload: { msg: 'hello' } },
      { type: 'result', payload: { ok: true } },
    ]);
  });

  describe('MastraClientWorkflowOutput API', () => {
    beforeEach(() => {
      fetchMock = vi.fn((input: any) => {
        const url = String(input);
        if (url.includes('/create-run')) return Promise.resolve(createJsonResponse({ runId: 'r-123' }));
        if (url.includes('/stream?')) {
          const body = Workflow.createRecordStream([
            { type: 'workflow-start', payload: { workflowId: 'wf-1' } },
            { type: 'workflow-step-result', payload: { step: 'step1', result: 'done' } },
            {
              type: 'workflow-finish',
              payload: {
                workflowStatus: 'success',
                output: {
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
                metadata: { duration: 100 },
              },
            },
          ]);
          return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
        }
        return Promise.reject(new Error(`Unhandled fetch to ${url}`));
      });
      globalThis.fetch = fetchMock as any;
    });

    it('fullStream: should iterate over workflow chunks using async iterator', async () => {
      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      const receivedChunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        receivedChunks.push(chunk);
      }

      expect(receivedChunks).toHaveLength(3);
      expect(receivedChunks[0].type).toBe('workflow-start');
      expect(receivedChunks[1].type).toBe('workflow-step-result');
      expect(receivedChunks[2].type).toBe('workflow-finish');
    });

    it('usage: should resolve to usage from workflow-finish event', async () => {
      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      const usage = await stream.usage;

      expect(usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });

    it('status: should resolve to workflow status from workflow-finish event', async () => {
      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      const status = await stream.status;

      expect(status).toBe('success');
    });

    it('result: should resolve to workflow result from workflow-finish event', async () => {
      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      const result = await stream.result;

      expect(result).toEqual({
        workflowStatus: 'success',
        output: {
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
        metadata: { duration: 100 },
      });
    });

    it('should support both fullStream iteration and property awaiting simultaneously', async () => {
      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      // Start consuming fullStream
      const chunks: any[] = [];
      const streamPromise = (async () => {
        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }
      })();

      // Await properties simultaneously
      const [usage, status, result] = await Promise.all([stream.usage, stream.status, stream.result]);

      // Wait for stream to complete
      await streamPromise;

      // Verify both patterns worked
      expect(chunks).toHaveLength(3);
      expect(usage.totalTokens).toBe(15);
      expect(status).toBe('success');
      expect(result.workflowStatus).toBe('success');
    });

    it('should support manual reader iteration (regression test)', async () => {
      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      // Manual reader pattern - should still work since stream extends ReadableStream
      const reader = (stream as ReadableStream<any>).getReader();
      const records: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          records.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      expect(records).toHaveLength(3);
      expect(records[0].type).toBe('workflow-start');
      expect(records[1].type).toBe('workflow-step-result');
      expect(records[2].type).toBe('workflow-finish');
    });

    it('should handle workflow with different status', async () => {
      fetchMock = vi.fn((input: any) => {
        const url = String(input);
        if (url.includes('/create-run')) return Promise.resolve(createJsonResponse({ runId: 'r-123' }));
        if (url.includes('/stream?')) {
          const body = Workflow.createRecordStream([
            { type: 'workflow-start', payload: { workflowId: 'wf-1' } },
            {
              type: 'workflow-finish',
              payload: {
                workflowStatus: 'failed',
                output: {
                  usage: { totalTokens: 5 },
                },
              },
            },
          ]);
          return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
        }
        return Promise.reject(new Error(`Unhandled fetch to ${url}`));
      });
      globalThis.fetch = fetchMock as any;

      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      const status = await stream.status;
      expect(status).toBe('failed');
    });

    it('should handle workflow without usage data', async () => {
      fetchMock = vi.fn((input: any) => {
        const url = String(input);
        if (url.includes('/create-run')) return Promise.resolve(createJsonResponse({ runId: 'r-123' }));
        if (url.includes('/stream?')) {
          const body = Workflow.createRecordStream([
            { type: 'workflow-start', payload: { workflowId: 'wf-1' } },
            {
              type: 'workflow-finish',
              payload: {
                workflowStatus: 'success',
                output: {},
              },
            },
          ]);
          return Promise.resolve(new Response(body as unknown as ReadableStream, { status: 200 }));
        }
        return Promise.reject(new Error(`Unhandled fetch to ${url}`));
      });
      globalThis.fetch = fetchMock as any;

      const run = await wf.createRun();
      const stream = await run.stream({ inputData: { x: 1 } });

      const usage = await stream.usage;
      expect(usage).toBeUndefined();
    });
  });

  it('start uses provided runId', async () => {
    const res = await wf.start({ runId: 'r-x', inputData: { b: 2 } });
    expect(res).toEqual({ message: 'started' });
  });

  it('starts workflow run synchronously with tracingOptions', async () => {
    const run = await wf.createRun();
    const tracingOptions = { metadata: { foo: 'bar' } };
    const result = await run.start({ inputData: { a: 1 }, tracingOptions });
    expect(result).toEqual({ message: 'started' });

    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/start?runId='));
    expect(call).toBeTruthy();
    const options = call[1];
    const body = JSON.parse(options.body);
    expect(body.tracingOptions).toEqual(tracingOptions);
  });

  it('starts workflow run asynchronously with tracingOptions', async () => {
    const run = await wf.createRun();
    const tracingOptions = { metadata: { traceId: 't-1' } };
    const result = await run.startAsync({ inputData: { a: 1 }, tracingOptions });
    expect(result).toEqual({ result: 'started-async' });

    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/start-async'));
    expect(call).toBeTruthy();
    const options = call[1];
    const body = JSON.parse(options.body);
    expect(body.tracingOptions).toEqual(tracingOptions);
  });

  it('resumes workflow run synchronously with tracingOptions', async () => {
    const run = await wf.createRun();
    const tracingOptions = { metadata: { resume: true } };
    const result = await run.resume({ step: 's1', tracingOptions });
    expect(result).toEqual({ message: 'resumed' });

    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/resume?runId='));
    expect(call).toBeTruthy();
    const options = call[1];
    const body = JSON.parse(options.body);
    expect(body.tracingOptions).toEqual(tracingOptions);
  });

  it('resumes workflow run asynchronously with tracingOptions', async () => {
    const run = await wf.createRun();
    const tracingOptions = { metadata: { async: true } };
    const result = await run.resumeAsync({ step: 's1', tracingOptions });
    expect(result).toEqual({ result: 'resumed-async' });

    const call = fetchMock.mock.calls.find((args: any[]) => String(args[0]).includes('/resume-async'));
    expect(call).toBeTruthy();
    const options = call[1];
    const body = JSON.parse(options.body);
    expect(body.tracingOptions).toEqual(tracingOptions);
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
    const result = await client.listWorkflows();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/workflows`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get all workflows with requestContext', async () => {
    const mockResponse = {
      workflow1: { name: 'Workflow 1' },
      workflow2: { name: 'Workflow 2' },
    };
    const requestContext = { userId: '123', tenantId: 'tenant-456' };
    const expectedBase64 = btoa(JSON.stringify(requestContext));
    const expectedEncodedBase64 = encodeURIComponent(expectedBase64);

    mockFetchResponse(mockResponse);
    const result = await client.listWorkflows(requestContext);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/workflows?requestContext=${expectedEncodedBase64}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});
