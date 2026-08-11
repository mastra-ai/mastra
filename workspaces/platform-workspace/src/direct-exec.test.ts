import { describe, expect, it, vi } from 'vitest';
import type { DirectExecWebSocket, DirectExecWebSocketFactory, ExecLease } from './direct-exec.js';
import { execViaLease } from './direct-exec.js';

const LEASE: ExecLease = {
  jwt: 'jwt.value.here',
  wsEndpoint: 'wss://ssh.railway.com:2226/ws/exec',
  subprotocol: 'railway-shell',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

/**
 * In-memory fake WebSocket that lets tests drive the connect → frame → exit
 * state machine deterministically. The direct-exec client only touches the
 * subset of the WebSocket API declared on {@link DirectExecWebSocket}, so
 * this is a full implementation of what the module uses.
 */
class FakeSocket implements DirectExecWebSocket {
  binaryType: 'blob' | 'arraybuffer' = 'blob';
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  constructor(
    readonly endpoint: string,
    readonly subprotocols: string[],
  ) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCalls.push({ ...(code !== undefined && { code }), ...(reason !== undefined && { reason }) });
  }

  // Test helpers ------------------------------------------------------------

  fireOpen(): void {
    this.onopen?.({});
  }

  fireBinary(prefix: number, payload: string): void {
    const bytes = new TextEncoder().encode(payload);
    const framed = new Uint8Array(bytes.length + 1);
    framed[0] = prefix;
    framed.set(bytes, 1);
    // Copy into a fresh ArrayBuffer so `instanceof ArrayBuffer` succeeds
    // regardless of the underlying buffer type.
    const buffer = framed.buffer.slice(framed.byteOffset, framed.byteOffset + framed.byteLength) as ArrayBuffer;
    this.onmessage?.({ data: buffer });
  }

  fireText(text: string): void {
    this.onmessage?.({ data: text });
  }

  fireClose(code = 1000, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

function scriptedFactory(driver: (socket: FakeSocket) => void): {
  factory: DirectExecWebSocketFactory;
  sockets: FakeSocket[];
} {
  const sockets: FakeSocket[] = [];
  const factory: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
    const socket = new FakeSocket(endpoint, subprotocols);
    sockets.push(socket);
    // Drive the socket on the microtask queue so callers get a chance to
    // attach their onopen/onmessage listeners first, matching a real WS.
    queueMicrotask(() => driver(socket));
    return socket;
  };
  return { factory, sockets };
}

describe('execViaLease', () => {
  it('opens with subprotocols [subprotocol, jwt] to the lease endpoint', async () => {
    const { factory, sockets } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    await execViaLease(LEASE, { command: 'echo ok', webSocketFactory: factory });

    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.endpoint).toBe(LEASE.wsEndpoint);
    expect(sockets[0]!.subprotocols).toEqual([LEASE.subprotocol, LEASE.jwt]);
    expect(sockets[0]!.binaryType).toBe('arraybuffer');
  });

  it('sends init_exec + stdin_close on open, then resolves on exit frame', async () => {
    const { factory, sockets } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireBinary(1, 'hello ');
      socket.fireBinary(1, 'world');
      socket.fireBinary(3, 'oops');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    const result = await execViaLease(LEASE, {
      command: 'echo hi',
      cwd: '/w',
      env: { FOO: 'bar' },
      webSocketFactory: factory,
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'hello world',
      stderr: 'oops',
      truncated: false,
      timedOut: false,
      opened: true,
    });

    const [init, stdinClose] = sockets[0]!.sent.map(s => JSON.parse(s));
    expect(init).toEqual({ type: 'init_exec', data: { command: 'echo hi', cwd: '/w', env: { FOO: 'bar' } } });
    expect(stdinClose).toEqual({ type: 'stdin_close' });
    // Socket was closed after exit via settle() — code 1000, reason ''.
    expect(sockets[0]!.closeCalls).toEqual([{ code: 1000, reason: '' }]);
  });

  it('omits cwd and env from init_exec when not provided', async () => {
    const { factory, sockets } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    await execViaLease(LEASE, { command: 'echo ok', webSocketFactory: factory });

    const init = JSON.parse(sockets[0]!.sent[0]!) as { data: Record<string, unknown> };
    expect(init.data).toEqual({ command: 'echo ok' });
  });

  it('omits env when the caller passes an empty object (matches SDK behavior)', async () => {
    const { factory, sockets } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    await execViaLease(LEASE, { command: 'echo ok', env: {}, webSocketFactory: factory });

    const init = JSON.parse(sockets[0]!.sent[0]!) as { data: Record<string, unknown> };
    expect(init.data.env).toBeUndefined();
  });

  it('streams stdout/stderr chunks to onStdout/onStderr callbacks', async () => {
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireBinary(1, 'out1');
      socket.fireBinary(3, 'err1');
      socket.fireBinary(1, 'out2');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    await execViaLease(LEASE, { command: ':', onStdout, onStderr, webSocketFactory: factory });

    expect(onStdout.mock.calls.map(c => c[0])).toEqual(['out1', 'out2']);
    expect(onStderr.mock.calls.map(c => c[0])).toEqual(['err1']);
  });

  it('resolves with nonzero exit code from the exit frame', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireBinary(3, 'boom');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 137 } }));
    });

    const result = await execViaLease(LEASE, { command: 'false', webSocketFactory: factory });
    expect(result.exitCode).toBe(137);
    expect(result.stderr).toBe('boom');
  });

  it('defaults exit code to 0 when exit frame has no exit_code (matches SDK)', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireText(JSON.stringify({ type: 'exit', data: {} }));
    });
    const result = await execViaLease(LEASE, { command: ':', webSocketFactory: factory });
    expect(result.exitCode).toBe(0);
  });

  it('resolves with exitCode=null when the socket closes without an exit frame', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireBinary(1, 'partial');
      socket.fireClose(1006, 'connection lost');
    });

    const result = await execViaLease(LEASE, { command: 'sleep 5', webSocketFactory: factory });
    expect(result).toEqual({
      exitCode: null,
      stdout: 'partial',
      stderr: '',
      truncated: false,
      timedOut: false,
      closeCode: 1006,
      closeReason: 'connection lost',
      opened: true,
    });
  });

  it('resolves with exitCode=null and empty output when the socket never opens', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireClose(1006, 'handshake rejected');
    });

    const result = await execViaLease(LEASE, { command: ':', webSocketFactory: factory });
    expect(result).toEqual({
      exitCode: null,
      stdout: '',
      stderr: '',
      truncated: false,
      timedOut: false,
      closeCode: 1006,
      closeReason: 'handshake rejected',
      opened: false,
    });
  });

  it('enforces a handshake deadline when no caller timeout is set, so a stalled connect cannot hang the promise', async () => {
    vi.useFakeTimers();
    try {
      // Factory returns a socket that NEVER fires onopen/onmessage/onclose —
      // the caller has no timeoutMs, so only the internal handshake deadline
      // can unblock the promise. If it's missing, the promise hangs forever.
      const { factory } = scriptedFactory(() => {
        /* deliberately do nothing */
      });

      const promise = execViaLease(LEASE, { command: 'never', webSocketFactory: factory });
      // Advance past the 30s handshake deadline defined in direct-exec.ts.
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await promise;

      // Handshake deadline is transport failure, NOT timeout — timedOut stays
      // false so the caller can distinguish "stalled connect" from "ran too long".
      // No closeCode/closeReason because the socket never fired onclose.
      expect(result).toEqual({
        exitCode: null,
        stdout: '',
        stderr: '',
        truncated: false,
        timedOut: false,
        opened: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the handshake deadline once the socket opens (no false transport failure on long-running exec without timeout)', async () => {
    vi.useFakeTimers();
    try {
      const { factory, sockets } = scriptedFactory(socket => {
        socket.fireOpen();
        // Never send an exit frame — a real long-running exec might legitimately
        // take longer than the handshake deadline. If we forgot to clear the
        // deadline in onopen, this would resolve with exitCode=null after 30s.
      });

      const promise = execViaLease(LEASE, { command: 'sleep 3600', webSocketFactory: factory });
      // Push well past the handshake deadline; the promise must NOT settle.
      await vi.advanceTimersByTimeAsync(60_000);
      // Race with a microtask sentinel so we can assert `promise` is still pending.
      const sentinel = Symbol('pending');
      const winner = await Promise.race([promise, Promise.resolve(sentinel)]);
      expect(winner).toBe(sentinel);
      // Clean up: fire exit so the promise resolves before the test tears down fake timers.
      sockets[0]!.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
      await promise;
    } finally {
      vi.useRealTimers();
    }
  });

  it('enforces timeoutMs by closing the socket and returning timedOut=true, exit=124', async () => {
    vi.useFakeTimers();
    try {
      const { factory, sockets } = scriptedFactory(socket => {
        socket.fireOpen();
        // Never emit an exit frame; leave the exec "running".
      });

      const promise = execViaLease(LEASE, { command: 'sleep 999', timeoutMs: 500, webSocketFactory: factory });

      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
      // Timeout path closes the socket to unwind the server side.
      expect(sockets[0]!.closeCalls.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores durable_session frames on the one-shot exec path', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireText(JSON.stringify({ type: 'durable_session', data: { durable_session_name: 'sess_1' } }));
      socket.fireBinary(1, 'ok');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    const result = await execViaLease(LEASE, { command: ':', webSocketFactory: factory });
    expect(result.stdout).toBe('ok');
    expect(result.exitCode).toBe(0);
  });

  it('ignores malformed text frames instead of rejecting', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireText('not-json');
      socket.fireBinary(1, 'ok');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    const result = await execViaLease(LEASE, { command: ':', webSocketFactory: factory });
    expect(result.stdout).toBe('ok');
    expect(result.exitCode).toBe(0);
  });

  it('drops zero-length binary frames without touching output', async () => {
    const { factory } = scriptedFactory(socket => {
      socket.fireOpen();
      // A frame with only the tag byte and no payload should be a no-op.
      socket.onmessage?.({ data: new ArrayBuffer(1) });
      socket.fireBinary(1, 'ok');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
    });

    const result = await execViaLease(LEASE, { command: ':', webSocketFactory: factory });
    expect(result.stdout).toBe('ok');
  });

  it('is a no-op when exit and close both arrive (idempotent settle)', async () => {
    const { factory, sockets } = scriptedFactory(socket => {
      socket.fireOpen();
      socket.fireBinary(1, 'hi');
      socket.fireText(JSON.stringify({ type: 'exit', data: { exit_code: 0 } }));
      // Server-initiated close after exit — settle() should be idempotent.
      socket.fireClose(1000, '');
    });

    const result = await execViaLease(LEASE, { command: ':', webSocketFactory: factory });
    expect(result).toEqual({
      exitCode: 0,
      stdout: 'hi',
      stderr: '',
      truncated: false,
      timedOut: false,
      opened: true,
    });
    // Only one close() call should have originated from our side.
    expect(sockets[0]!.closeCalls).toEqual([{ code: 1000, reason: '' }]);
  });
});
