/**
 * Direct exec client — opens Railway's tcp-proxy exec WebSocket directly using
 * a short-lived JWT minted by the workspace proxy's exec-lease endpoint. This
 * removes the platform data plane from the exec stdout/stderr path entirely
 * (see `docs/factory/direct-sandbox-connection.md` in the Platform repo),
 * cutting payload-scaled Cloud Run egress and RTT for commands like
 * `pnpm install` that stream tens of MB of output.
 *
 * The frame protocol below mirrors `connectExecWs()` in `railway@3.5.5`
 * (`workspaces/railway/node_modules/railway/dist/index.js`). The `railway`
 * SDK's version is pinned on both sides (platform + here); a version bump
 * signals the protocol may have drifted and this module must be revisited.
 */

/** Byte-0 tag on binary WS frames for stdout output. */
const STDOUT_FRAME = 1;
/** Byte-0 tag on binary WS frames for stderr output. */
const STDERR_FRAME = 3;
/**
 * Upper bound on how long we'll wait for the WebSocket to open when the
 * caller didn't supply a `timeoutMs`. Guards against a stalled TLS/WS
 * handshake leaving the promise unresolved forever. Not applied once the
 * socket has opened — a caller with no timeout has opted in to unbounded
 * command runtime, just not to unbounded connection setup.
 */
const HANDSHAKE_DEADLINE_MS = 30_000;

/**
 * Minimal WebSocket surface this module depends on. Matches both the browser
 * `WebSocket` global and Node 22+'s built-in `WebSocket`. Extracted so tests
 * can inject a fake without pulling in `ws` or jsdom.
 */
export interface DirectExecWebSocket {
  binaryType: 'blob' | 'arraybuffer';
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/**
 * Factory that opens a WebSocket to `endpoint` with the given subprotocols.
 * Defaults to the global `WebSocket` when omitted, which works on Node 22+
 * (the package's minimum) and in the browser. Tests inject a fake here.
 */
export type DirectExecWebSocketFactory = (endpoint: string, subprotocols: string[]) => DirectExecWebSocket;

/** Lease payload returned by `POST /v1/:provider/projects/:projectId/sandbox/:sandboxId/exec-lease`. */
export interface ExecLease {
  jwt: string;
  wsEndpoint: string;
  subprotocol: string;
  /** ISO-8601 UTC. Null when the provider issues a JWT without an `exp` claim. */
  expiresAt: string | null;
}

/** Inputs to a direct exec invocation. Mirrors the shape of the `/exec` route body. */
export interface DirectExecOptions {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  /**
   * Wall-clock cap for the exec. When elapsed, we close the socket and
   * return `{timedOut: true, exitCode: 124}` matching the semantics of the
   * proxy's `/exec` route.
   */
  timeoutMs?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  /** Injected for tests. Defaults to `globalThis.WebSocket`. */
  webSocketFactory?: DirectExecWebSocketFactory;
}

/**
 * Result of a direct exec. Shape matches the workspace-proxy `/exec` response
 * so the caller (`PlatformSandbox.executeCommand`) can hand it back with no
 * translation.
 *
 * `exitCode` is `null` when the socket closed without an `exit` frame AND the
 * exec did not time out (rare — usually a mid-stream network drop). Callers
 * currently coerce `null` to `1` upstream; kept nullable here to preserve the
 * distinction for future observability.
 */
export interface DirectExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  timedOut: boolean;
  /**
   * WebSocket close metadata. Populated on any close (normal or transport
   * failure). `opened` distinguishes handshake failures (never opened) from
   * mid-stream drops. Callers use this for diagnostic logging; not part of
   * the CommandResult contract.
   */
  closeCode?: number;
  closeReason?: string;
  opened?: boolean;
}

const DEFAULT_WS_FACTORY: DirectExecWebSocketFactory = (endpoint, subprotocols) => {
  const WS = (globalThis as { WebSocket?: unknown }).WebSocket as
    | (new (url: string, protocols: string[]) => DirectExecWebSocket)
    | undefined;
  if (!WS) {
    throw new Error(
      'Direct exec requires a WebSocket implementation. Node 22+ provides one globally; on older runtimes, pass webSocketFactory explicitly.',
    );
  }
  return new WS(endpoint, subprotocols);
};

/**
 * Open the provider exec WebSocket using `lease`, run `command`, and resolve
 * with the accumulated stdout/stderr + exit code. See the module docstring
 * for the wire protocol reference.
 *
 * The client sends `stdin_close` immediately after `init_exec`, matching the
 * SDK's own one-shot exec behavior — we never stream stdin from the caller.
 */
export function execViaLease(lease: ExecLease, options: DirectExecOptions): Promise<DirectExecResult> {
  const factory = options.webSocketFactory ?? DEFAULT_WS_FACTORY;
  const stdoutDecoder = new TextDecoder();
  const stderrDecoder = new TextDecoder();

  return new Promise<DirectExecResult>(resolve => {
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;
    let timedOut = false;
    let settled = false;
    let opened = false;
    let closeCode: number | undefined;
    let closeReason: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let handshakeTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (handshakeTimer) clearTimeout(handshakeTimer);
      // Flush any bytes still buffered in the decoders. A stream:true decode
      // holds trailing partial multi-byte sequences until the next chunk, so
      // without a flush the final char(s) of a UTF-8 stream can be dropped.
      const stdoutTail = stdoutDecoder.decode();
      if (stdoutTail) {
        stdout += stdoutTail;
        options.onStdout?.(stdoutTail);
      }
      const stderrTail = stderrDecoder.decode();
      if (stderrTail) {
        stderr += stderrTail;
        options.onStderr?.(stderrTail);
      }
      try {
        socket.close(1000, '');
      } catch {
        /* already closed */
      }
      resolve({
        exitCode,
        stdout,
        stderr,
        truncated: false,
        timedOut,
        ...(closeCode !== undefined && { closeCode }),
        ...(closeReason !== undefined && { closeReason }),
        opened,
      });
    };

    // Arm the timeout BEFORE we open the socket so a stalled handshake can't
    // leave the promise pending. Callers with a positive `timeoutMs` get the
    // wall-clock cap they asked for; callers without one still get a
    // connect-only deadline that clears once the socket opens.
    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        // 124 matches the proxy's `/exec` semantics (coreutils `timeout`
        // exit code) so callers that switch on exitCode see the same value.
        if (exitCode === null) exitCode = 124;
        settle();
      }, options.timeoutMs);
    } else {
      handshakeTimer = setTimeout(() => {
        // Never opened → treat as a transport failure. Leave exitCode=null
        // so the caller can distinguish this from a normal exit; do not
        // set timedOut (that flag is reserved for the wall-clock case).
        if (!opened) settle();
      }, HANDSHAKE_DEADLINE_MS);
    }

    const socket = factory(lease.wsEndpoint, [lease.subprotocol, lease.jwt]);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      opened = true;
      if (handshakeTimer) {
        clearTimeout(handshakeTimer);
        handshakeTimer = undefined;
      }
      const data: Record<string, unknown> = { command: options.command };
      if (options.cwd) data.cwd = options.cwd;
      if (options.env && Object.keys(options.env).length > 0) data.env = options.env;
      socket.send(JSON.stringify({ type: 'init_exec', data }));
      // We never stream stdin for one-shot exec; the SDK does this too, and
      // omitting it can leave the exec hanging waiting on EOF.
      socket.send(JSON.stringify({ type: 'stdin_close' }));
    };

    socket.onmessage = event => {
      const { data } = event;
      if (data instanceof ArrayBuffer) {
        handleBinaryFrame(data);
      } else if (typeof data === 'string') {
        handleTextFrame(data);
      }
    };

    socket.onclose = event => {
      closeCode = event.code;
      closeReason = event.reason;
      if (!opened) {
        // Never opened — surface as a failure via exitCode=null,
        // truncated=false, timedOut=false so the caller can distinguish
        // it from a normal exit-0 by inspecting `exitCode === null`.
        settle();
        return;
      }
      // Preserve any info captured before close; if the server sent an
      // `exit` frame this is a no-op because settle() already ran.
      settle();
    };

    socket.onerror = () => {
      if (settled) return;
      if (!opened) {
        settle();
      }
      // If we're mid-stream and the socket errors, wait for onclose to fire
      // so we settle with whatever output we did receive.
    };

    function handleBinaryFrame(buffer: ArrayBuffer) {
      const view = new Uint8Array(buffer);
      if (view.length <= 1) return;
      if (view[0] === STDOUT_FRAME) {
        const chunk = stdoutDecoder.decode(view.subarray(1), { stream: true });
        stdout += chunk;
        options.onStdout?.(chunk);
      } else if (view[0] === STDERR_FRAME) {
        const chunk = stderrDecoder.decode(view.subarray(1), { stream: true });
        stderr += chunk;
        options.onStderr?.(chunk);
      }
    }

    function handleTextFrame(text: string) {
      let frame: { type?: string; data?: { exit_code?: number } };
      try {
        frame = JSON.parse(text) as { type?: string; data?: { exit_code?: number } };
      } catch {
        return;
      }
      if (frame.type === 'exit') {
        exitCode = frame.data?.exit_code ?? 0;
        settle();
      }
      // `durable_session` frames are intentionally ignored — we don't reattach
      // or expose session names on the one-shot exec path.
    }
  });
}
