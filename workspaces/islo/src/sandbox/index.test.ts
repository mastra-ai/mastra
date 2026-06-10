/**
 * Unit tests for IsloSandbox.
 *
 * The islo SDK + the global `fetch` are mocked so we can drive the lifecycle
 * and exec paths without hitting api.islo.dev. Live integration coverage is
 * in `index.integration.test.ts` and runs only when `ISLO_API_KEY` is set.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createSandboxMock = vi.fn();
const getSandboxMock = vi.fn();
const pauseSandboxMock = vi.fn();
const resumeSandboxMock = vi.fn();
const deleteSandboxMock = vi.fn();
const getTokenMock = vi.fn();
const isloApiClientConstructorMock = vi.fn();
const tokenProviderConstructorMock = vi.fn();

vi.mock('@islo-labs/sdk', () => {
  function MockIsloApiClient(this: unknown, options: unknown) {
    isloApiClientConstructorMock(options);
    Object.assign(this as object, {
      sandboxes: {
        createSandbox: createSandboxMock,
        getSandbox: getSandboxMock,
        pauseSandbox: pauseSandboxMock,
        resumeSandbox: resumeSandboxMock,
        deleteSandbox: deleteSandboxMock,
      },
    });
  }
  function MockTokenProvider(this: unknown, options: unknown) {
    tokenProviderConstructorMock(options);
    Object.assign(this as object, { getToken: getTokenMock });
  }
  return { IsloApiClient: MockIsloApiClient, TokenProvider: MockTokenProvider };
});

import { IsloSandbox } from './index';

const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.ISLO_API_KEY = 'ak_test';
  getTokenMock.mockResolvedValue('jwt-test');
  createSandboxMock.mockResolvedValue({ name: 'mastra-test', status: 'running', created_at: '2026-05-05T00:00:00Z' });
  resumeSandboxMock.mockResolvedValue({ name: 'mastra-test', status: 'running', created_at: '2026-05-05T00:00:00Z' });
  // Default to "not found" so start() takes the create path.
  getSandboxMock.mockRejectedValue({ statusCode: 404 });
  pauseSandboxMock.mockResolvedValue({});
  deleteSandboxMock.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = realFetch;
  delete process.env.ISLO_API_KEY;
  delete process.env.ISLO_CONTROL_URL;
  delete process.env.ISLO_COMPUTE_URL;
});

function streamFromString(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('IsloSandbox', () => {
  describe('constructor', () => {
    it('throws when ISLO_API_KEY is missing and no apiKey option is provided', () => {
      delete process.env.ISLO_API_KEY;
      expect(() => new IsloSandbox()).toThrow(/ISLO_API_KEY/);
    });

    it('uses an explicit apiKey option when env is unset', () => {
      delete process.env.ISLO_API_KEY;
      expect(() => new IsloSandbox({ apiKey: 'ak_inline' })).not.toThrow();
    });

    it('generates a sandbox name when none is supplied', () => {
      const sb = new IsloSandbox();
      expect(sb.name_).toMatch(/^mastra-/);
    });

    it('configures token exchange on control URL and sandbox calls on compute URL', () => {
      const sb = new IsloSandbox({
        controlUrl: 'https://control.example.com/',
        computeUrl: 'https://compute.example.com/',
      });
      expect(sb.processes).toBeUndefined();
      expect(tokenProviderConstructorMock).toHaveBeenCalledWith({
        apiKey: 'ak_test',
        baseUrl: 'https://control.example.com',
      });
      expect(isloApiClientConstructorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'https://compute.example.com',
          baseUrl: 'https://compute.example.com',
        }),
      );
    });

    it('resolves ISLO_CONTROL_URL and ISLO_COMPUTE_URL independently', () => {
      process.env.ISLO_CONTROL_URL = 'https://control.env.example.com/';
      process.env.ISLO_COMPUTE_URL = 'https://compute.env.example.com/';
      new IsloSandbox();
      expect(tokenProviderConstructorMock).toHaveBeenCalledWith({
        apiKey: 'ak_test',
        baseUrl: 'https://control.env.example.com',
      });
      expect(isloApiClientConstructorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'https://compute.env.example.com',
          baseUrl: 'https://compute.env.example.com',
        }),
      );
    });
  });

  describe('lifecycle', () => {
    it('start() creates a new sandbox when none exists', async () => {
      const sb = new IsloSandbox({ sandboxName: 'mastra-test', image: 'ubuntu:24.04' });
      await sb._start();
      expect(getSandboxMock).toHaveBeenCalledWith({ sandbox_name: 'mastra-test' });
      expect(createSandboxMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'mastra-test', image: 'ubuntu:24.04' }),
      );
      expect(sb.status).toBe('running');
    });

    it('start() reconnects to an existing live sandbox by name', async () => {
      getSandboxMock.mockResolvedValueOnce({
        name: 'mastra-test',
        status: 'running',
        created_at: '2026-05-04T00:00:00Z',
      });
      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      await sb._start();
      expect(createSandboxMock).not.toHaveBeenCalled();
      expect(sb.status).toBe('running');
    });

    it('start() resumes an existing paused sandbox by name', async () => {
      getSandboxMock.mockResolvedValueOnce({
        name: 'mastra-test',
        status: 'paused',
        created_at: '2026-05-04T00:00:00Z',
      });
      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      await sb._start();
      expect(createSandboxMock).not.toHaveBeenCalled();
      expect(resumeSandboxMock).toHaveBeenCalledWith({ sandbox_name: 'mastra-test' });
      expect(sb.status).toBe('running');
    });

    it('start() fails clearly for an existing stopped sandbox', async () => {
      getSandboxMock.mockResolvedValueOnce({ name: 'mastra-test', status: 'stopped' });
      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      await expect(sb._start()).rejects.toThrow(/stopped/);
      expect(createSandboxMock).not.toHaveBeenCalled();
    });

    it('stop() pauses the sandbox so it can be resumed later', async () => {
      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      await sb._stop();
      expect(pauseSandboxMock).toHaveBeenCalledWith({ sandbox_name: 'mastra-test' });
    });

    it('destroy() deletes sandboxes by default', async () => {
      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      await sb._start();
      await sb._destroy();
      expect(deleteSandboxMock).toHaveBeenCalledWith({ sandbox_name: 'mastra-test' });
    });

    it('destroy() skips deletion when deleteOnDestroy is false', async () => {
      getSandboxMock.mockResolvedValueOnce({ name: 'mastra-keep', status: 'running' });
      const sb = new IsloSandbox({ sandboxName: 'mastra-keep', deleteOnDestroy: false });
      await sb._start();
      await sb._destroy();
      expect(deleteSandboxMock).not.toHaveBeenCalled();
    });
  });

  describe('executeCommand', () => {
    it('streams stdout/stderr deltas and propagates the exit code', async () => {
      const sseBody = [
        'event: stdout',
        'data: hello',
        '',
        'event: stderr',
        'data: warn',
        '',
        'event: exit',
        'data: 0',
        '',
      ].join('\n');
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(streamFromString(sseBody), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ) as unknown as typeof fetch;

      const sb = new IsloSandbox({ sandboxName: 'mastra-test', computeUrl: 'https://compute.example.com' });
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      const result = await sb.executeCommand!('echo', ['hello'], {
        onStdout: (d) => stdoutChunks.push(d),
        onStderr: (d) => stderrChunks.push(d),
        cwd: '/workspace/app',
        env: { TEST_ENV: '1' },
        timeout: 12_345,
      });

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('warn');
      expect(stdoutChunks).toEqual(['hello']);
      expect(stderrChunks).toEqual(['warn']);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://compute.example.com/sandboxes/mastra-test/exec/stream');
      const init = fetchCall[1] as RequestInit;
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer jwt-test');
      expect(headers.accept).toBe('text/event-stream');
      expect(JSON.parse(init.body as string)).toEqual({
        args: ['echo', 'hello'],
        workdir: '/workspace/app',
        env_vars: { TEST_ENV: '1' },
        timeout_secs: 13,
      });
    });

    it('propagates a non-zero exit code', async () => {
      const sseBody = 'event: stdout\ndata: nope\n\nevent: exit\ndata: 7\n\n';
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(streamFromString(sseBody))) as unknown as typeof fetch;

      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      const result = await sb.executeCommand!('false');
      expect(result.exitCode).toBe(7);
      expect(result.success).toBe(false);
    });

    it('throws when the stream endpoint returns a non-2xx response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('boom', { status: 500, statusText: 'Internal Server Error' }),
      ) as unknown as typeof fetch;

      const sb = new IsloSandbox({ sandboxName: 'mastra-test' });
      await expect(sb.executeCommand!('echo', ['hi'])).rejects.toThrow(/500/);
    });

    it('marks the result as timedOut when the per-command timeout elapses', async () => {
      // Hang fetch indefinitely by returning a body that never closes.
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }) as unknown as typeof fetch;

      const sb = new IsloSandbox({ sandboxName: 'mastra-test', timeout: 25 });
      const result = await sb.executeCommand!('sleep', ['10']);
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });
  });
});
