import { describe, expect, it, vi } from 'vitest';
import { execViaPrivateNetwork, PrivateNetExecHttpError, type PrivateNetFetch } from './private-net-exec.js';

/**
 * Build a fake fetch that returns a streaming Response driven by the frames
 * pushed onto the returned `push`/`end` handles. Lets tests drive the NDJSON
 * frame protocol chunk-by-chunk without a real HTTP server.
 */
function streamingFetch(): {
  fetch: PrivateNetFetch;
  push: (chunk: string) => void;
  end: () => void;
  fail: (err: Error) => void;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const encoder = new TextEncoder();
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  const fetch: PrivateNetFetch = async (input, init) => {
    calls.push({ url: String(input), init });
    // Honor upstream aborts by erroring the stream — matches how a real
    // fetch surfaces `AbortController.abort()` to a mid-stream reader.
    init?.signal?.addEventListener('abort', () => {
      try {
        controllerRef?.error(new Error('aborted'));
      } catch {
        /* already closed */
      }
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/plain' } });
  };

  return {
    fetch,
    push: chunk => controllerRef!.enqueue(encoder.encode(chunk)),
    end: () => controllerRef!.close(),
    fail: err => controllerRef!.error(err),
    calls,
  };
}

describe('execViaPrivateNetwork', () => {
  it('posts to `<instanceUrl>/exec` with a JSON envelope and parses NDJSON frames end-to-end', async () => {
    const { fetch, push, end, calls } = streamingFetch();

    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', {
      command: 'echo hi',
      cwd: '/workspace',
      env: { A: '1' },
      fetch,
    });

    // Drive the response stream.
    push('{"type":"stdout","data":"hi\\n"}\n');
    push('{"type":"exit","code":0}\n');
    end();

    const result = await promise;
    expect(result).toEqual({
      exitCode: 0,
      stdout: 'hi\n',
      stderr: '',
      timedOut: false,
      opened: true,
      status: 200,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://[fd00::1]:47000/exec');
    const body = JSON.parse(calls[0]!.init!.body as string);
    expect(body).toEqual({ command: 'echo hi', cwd: '/workspace', env: { A: '1' } });
    // No auth header when bearerToken is not supplied — private-network is
    // the auth boundary.
    const headers = new Headers(calls[0]!.init!.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('forwards a bearer token when supplied', async () => {
    const { fetch, push, end, calls } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', {
      command: 'true',
      bearerToken: 'secret-xyz',
      fetch,
    });
    push('{"type":"exit","code":0}\n');
    end();
    await promise;
    const headers = new Headers(calls[0]!.init!.headers);
    expect(headers.get('authorization')).toBe('Bearer secret-xyz');
  });

  it('handles frames that arrive split across chunks (partial NDJSON lines)', async () => {
    const { fetch, push, end } = streamingFetch();
    const chunks: string[] = [];
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', {
      command: 'echo split',
      onStdout: c => chunks.push(c),
      fetch,
    });

    push('{"type":"stdout","data":"hel');
    push('lo\\n"}\n{"type":"std');
    push('out","data":"world\\n"}\n');
    push('{"type":"exit","code":0}\n');
    end();

    const result = await promise;
    expect(result.stdout).toBe('hello\nworld\n');
    expect(chunks).toEqual(['hello\n', 'world\n']);
    expect(result.exitCode).toBe(0);
  });

  it('accumulates stderr frames separately from stdout', async () => {
    const { fetch, push, end } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', {
      command: 'runit',
      fetch,
    });
    push('{"type":"stdout","data":"out"}\n');
    push('{"type":"stderr","data":"err"}\n');
    push('{"type":"exit","code":2}\n');
    end();

    const result = await promise;
    expect(result).toMatchObject({ stdout: 'out', stderr: 'err', exitCode: 2, timedOut: false });
  });

  it('returns opened=false and transportErrorMessage when the connection is refused', async () => {
    const fetch: PrivateNetFetch = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    const result = await execViaPrivateNetwork('http://[fd00::1]:47000', { command: 'x', fetch });
    expect(result).toMatchObject({
      opened: false,
      exitCode: null,
      timedOut: false,
      transportErrorMessage: expect.stringContaining('ECONNREFUSED'),
    });
  });

  it('throws PrivateNetExecHttpError on a non-2xx response from the sidecar', async () => {
    const fetch: PrivateNetFetch = async () =>
      new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } });
    await expect(execViaPrivateNetwork('http://[fd00::1]:47000', { command: 'x', fetch })).rejects.toBeInstanceOf(
      PrivateNetExecHttpError,
    );
  });

  it('returns exitCode=null with opened=true when the stream closes without an exit frame', async () => {
    const { fetch, push, end } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', { command: 'x', fetch });
    push('{"type":"stdout","data":"partial\\n"}\n');
    end();
    const result = await promise;
    expect(result).toMatchObject({
      exitCode: null,
      stdout: 'partial\n',
      opened: true,
      timedOut: false,
    });
  });

  it('returns timedOut=true with exitCode=124 when timeoutMs elapses before the exit frame', async () => {
    vi.useFakeTimers();
    try {
      const { fetch, push } = streamingFetch();
      const promise = execViaPrivateNetwork('http://[fd00::1]:47000', {
        command: 'sleep',
        timeoutMs: 50,
        fetch,
      });
      // Push some stdout but never an exit frame.
      push('{"type":"stdout","data":"..."}\n');
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores unknown frame types (forward-compat)', async () => {
    const { fetch, push, end } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', { command: 'x', fetch });
    push('{"type":"progress","pct":50}\n');
    push('{"type":"stdout","data":"ok\\n"}\n');
    push('{"type":"exit","code":0}\n');
    end();
    const result = await promise;
    expect(result).toMatchObject({ stdout: 'ok\n', exitCode: 0 });
  });

  it('tolerates malformed JSON lines without crashing the parser', async () => {
    const { fetch, push, end } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', { command: 'x', fetch });
    push('not-json\n');
    push('{"type":"stdout","data":"ok\\n"}\n');
    push('{"type":"exit","code":0}\n');
    end();
    const result = await promise;
    expect(result).toMatchObject({ stdout: 'ok\n', exitCode: 0 });
  });

  it('strips a trailing slash from the base URL before appending /exec', async () => {
    const { fetch, push, end, calls } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000/', { command: 'x', fetch });
    push('{"type":"exit","code":0}\n');
    end();
    await promise;
    expect(calls[0]!.url).toBe('http://[fd00::1]:47000/exec');
  });

  it('processes a final line that arrives without a trailing newline (EOF flush)', async () => {
    const { fetch, push, end } = streamingFetch();
    const promise = execViaPrivateNetwork('http://[fd00::1]:47000', { command: 'x', fetch });
    push('{"type":"stdout","data":"ok\\n"}\n');
    // Last frame with no trailing newline — depends on the EOF flush path.
    push('{"type":"exit","code":7}');
    end();
    const result = await promise;
    expect(result.exitCode).toBe(7);
    expect(result.stdout).toBe('ok\n');
  });
});
