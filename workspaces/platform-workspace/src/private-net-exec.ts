/**
 * Private-network exec client — dials the in-sandbox sidecar HTTP server
 * directly over Railway's private IPv6 network, bypassing the workspace-proxy
 * exec lease and the public tcp-proxy WebSocket entirely.
 *
 * Wire spec (matches the sidecar's `POST /exec` route, see
 * `.scratch/factory-deploy/issue-sandbox-sidecar-agent-in-base-image.md` in
 * the Platform repo):
 *
 * - Request:  `POST ${instanceUrl}/exec` with JSON body
 *   `{command, cwd?, env?, timeoutMs?}`.
 * - Response: `text/plain` NDJSON, one JSON object per line, terminated by an
 *   `exit` frame:
 *     `{"type":"stdout","data":"…"}`
 *     `{"type":"stderr","data":"…"}`
 *     `{"type":"exit","code":<number>}`
 *
 * Auth is *network position* — the private ULA IPv6 space is only reachable
 * from workloads inside this Railway environment, and every workload there is
 * our own code. A bearer secret adds no boundary today so we do not send one;
 * `bearerToken` is accepted here as a defense-in-depth hook for when
 * untrusted-tenant sandboxes eventually share a private network.
 *
 * Return shape mirrors {@link ../direct-exec.ts}'s `DirectExecResult` so the
 * caller in `sandbox.ts` can hand results back with no translation regardless
 * of which transport served the exec.
 */

/**
 * Minimal fetch surface this module depends on. Matches the global `fetch`
 * exposed by Node 22+ (undici) and the browser. Extracted so tests can inject
 * a fake without spinning up a real HTTP server.
 */
export type PrivateNetFetch = typeof fetch;

/** Inputs to a private-network exec invocation. Mirrors {@link DirectExecOptions}. */
export interface PrivateNetExecOptions {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  /**
   * Wall-clock cap for the exec. When elapsed, we abort the request and
   * return `{timedOut: true, exitCode: 124}` matching the semantics of
   * `direct-exec.ts` (and the proxy's `/exec` route before it).
   */
  timeoutMs?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  /** Injected for tests. Defaults to `globalThis.fetch`. */
  fetch?: PrivateNetFetch;
  /**
   * Optional bearer secret forwarded as `Authorization: Bearer <token>`.
   * Not required today (network position is the boundary). Present so we can
   * flip on per-sandbox secrets in a follow-up without a client-side reshape.
   */
  bearerToken?: string;
}

/**
 * Result of a private-network exec. Same shape as `DirectExecResult` — the
 * caller does not care which transport produced it.
 *
 * `exitCode` is `null` when the response body ended without an `exit` frame
 * AND the exec did not time out. That is a transport-level failure (the
 * sidecar died mid-stream or the socket was cut) and callers should treat it
 * as such (invalidate the cached `instanceUrl`, fall back to the lease path).
 */
export interface PrivateNetExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /**
   * True when we got a full HTTP response (status + at least the response
   * headers), even if the stream later dropped. False when we could not
   * establish the connection or the sidecar refused the request outright.
   * Used by the caller to distinguish "sidecar unreachable" (invalidate
   * cache) from "sidecar answered but the stream broke" (still invalidate,
   * but log differently).
   */
  opened: boolean;
  /** HTTP status when we got a response. Undefined on connection failure. */
  status?: number;
  /** Populated when we could not even open the request (DNS/connect/TLS). */
  transportErrorMessage?: string;
}

/**
 * Thrown by {@link execViaPrivateNetwork} when the sidecar returns a non-2xx
 * HTTP response. This is an *application* error, not a transport error — the
 * sidecar is reachable and answered, it just refused the exec. Callers should
 * fall back to the lease path for this one call but MUST NOT invalidate the
 * cached `instanceUrl` (the address is still good).
 */
export class PrivateNetExecHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Sidecar /exec returned ${status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    this.name = 'PrivateNetExecHttpError';
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_FETCH: PrivateNetFetch = (input, init) => {
  const f = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!f) {
    throw new Error(
      'Private-network exec requires a fetch implementation. Node 22+ provides one globally; on older runtimes, pass fetch explicitly.',
    );
  }
  return f(input, init);
};

/**
 * Wire frame shapes accepted from the sidecar. Anything else on the stream
 * is ignored so a future sidecar can add new frame types without breaking
 * older clients.
 */
type SidecarFrame =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number };

/**
 * Dial `${instanceUrl}/exec` and stream the response, resolving with the
 * accumulated stdout/stderr + exit code.
 *
 * Errors:
 * - Connection failure (DNS, refused, reset) → resolves with
 *   `{opened:false, exitCode:null, transportErrorMessage}`. Never throws for
 *   transport failures — the shape matches the lease-path result so the
 *   caller can treat both transports uniformly.
 * - Non-2xx HTTP response from the sidecar → throws {@link PrivateNetExecHttpError}.
 *   Application-level; caller decides whether to fall back.
 * - Stream ends without an `exit` frame → resolves with
 *   `{opened:true, exitCode:null}`, matching the lease-path semantics for a
 *   mid-stream drop.
 * - `timeoutMs` elapsed → aborts the request, resolves with
 *   `{timedOut:true, exitCode:124}`.
 */
export async function execViaPrivateNetwork(
  instanceUrl: string,
  options: PrivateNetExecOptions,
): Promise<PrivateNetExecResult> {
  const fetchImpl = options.fetch ?? DEFAULT_FETCH;
  const url = `${instanceUrl.replace(/\/$/, '')}/exec`;

  const controller = new AbortController();
  let timedOut = false;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
  }

  const body: Record<string, unknown> = { command: options.command };
  if (options.cwd) body.cwd = options.cwd;
  if (options.env && Object.keys(options.env).length > 0) body.env = options.env;
  if (options.timeoutMs !== undefined && options.timeoutMs > 0) body.timeoutMs = options.timeoutMs;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.bearerToken) headers.authorization = `Bearer ${options.bearerToken}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    // AbortError from our own timeout → treat as timeout, not transport error.
    if (timedOut) {
      return {
        exitCode: 124,
        stdout: '',
        stderr: '',
        timedOut: true,
        opened: false,
      };
    }
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      opened: false,
      transportErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    const text = await response.text().catch(() => '');
    throw new PrivateNetExecHttpError(response.status, text);
  }

  if (!response.body) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    // A 200 without a body is a broken sidecar. Treat as mid-stream drop
    // (opened=true, no exit frame) so the caller invalidates cache.
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      opened: true,
      status: response.status,
    };
  }

  let stdout = '';
  let stderr = '';
  let exitCode: number | null = null;
  const decoder = new TextDecoder();
  let buffer = '';

  const handleLine = (line: string): void => {
    if (!line) return;
    let frame: SidecarFrame | undefined;
    try {
      frame = JSON.parse(line) as SidecarFrame;
    } catch {
      // Unknown / malformed frame — ignore. A well-behaved sidecar only emits
      // JSON objects, but tolerating garbage protects against a partial write.
      return;
    }
    if (!frame || typeof frame !== 'object') return;
    if (frame.type === 'stdout' && typeof frame.data === 'string') {
      stdout += frame.data;
      options.onStdout?.(frame.data);
    } else if (frame.type === 'stderr' && typeof frame.data === 'string') {
      stderr += frame.data;
      options.onStderr?.(frame.data);
    } else if (frame.type === 'exit' && typeof frame.code === 'number') {
      exitCode = frame.code;
    }
    // Any other frame type is intentionally ignored (see SidecarFrame jsdoc).
  };

  try {
    const reader = response.body.getReader();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // NDJSON: split on newline; last piece stays in buffer for the next chunk.
      let newlineIdx = buffer.indexOf('\n');
      while (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        handleLine(line);
        newlineIdx = buffer.indexOf('\n');
      }
    }
    // Flush the decoder + any trailing (no-newline) line at EOF.
    buffer += decoder.decode();
    const trailing = buffer.trim();
    if (trailing) handleLine(trailing);
  } catch (error) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (timedOut) {
      return {
        exitCode: 124,
        stdout,
        stderr,
        timedOut: true,
        opened: true,
        status: response.status,
      };
    }
    // Mid-stream failure. Return whatever we accumulated with exitCode=null
    // so the caller sees this as a transport failure and can invalidate.
    return {
      exitCode,
      stdout,
      stderr,
      timedOut: false,
      opened: true,
      status: response.status,
      transportErrorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }

  return {
    exitCode,
    stdout,
    stderr,
    timedOut: false,
    opened: true,
    status: response.status,
  };
}
