/**
 * In-memory stand-in for a deployed Cloudflare Sandbox Bridge Worker.
 *
 * It implements the documented routes and SSE contract from
 * https://developers.cloudflare.com/sandbox/bridge/http-api/ so unit tests drive
 * the real `CloudflareSandboxBridgeClient` over `fetch` instead of a mock client.
 */

export interface FakeExecRequest {
  argv: string[];
  timeout_ms?: number;
  cwd?: string;
}

export interface FakeExecResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  /** Emit an `error` event instead of `exit`. */
  error?: { error: string; code?: string };
  /** Split stdout into this many SSE frames to exercise chunked decoding. */
  stdoutChunks?: number;
}

export interface FakeBridgeRequest {
  method: string;
  url: string;
  authorization?: string;
  body?: string;
}

export interface FakeBridge {
  fetch: typeof globalThis.fetch;
  requests: FakeBridgeRequest[];
  execs: FakeExecRequest[];
  files: Map<string, string>;
  sandboxes: Set<string>;
  /** Excludes query recorded per `GET /persist` call. */
  persists: (string | null)[];
  /** Raw tar payloads received by `POST /hydrate`. */
  hydrations: Uint8Array[];
  /** Bodies received by `POST /mount`. */
  mounts: unknown[];
  /** Bodies received by `POST /unmount`. */
  unmounts: unknown[];
  /** Mount paths the SDK currently considers active (cleared by {@link FakeBridge.sleep}). */
  activeMounts: Set<string>;
  /** Live session ids created via `POST /session`. */
  sessions: Set<string>;
  /**
   * Models `@cloudflare/sandbox` stopping an idle container: scratch files and the
   * in-memory `activeMounts` are dropped, but the sandbox id survives and boots a
   * fresh container on next use.
   */
  sleep: () => void;
  /** Overrides the default `echo`-only behaviour. */
  onExec?: (request: FakeExecRequest) => FakeExecResult;
}

function sse(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

function toBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function defaultExec(request: FakeExecRequest, activeMounts: Set<string>): FakeExecResult {
  // Strip `env KEY=VALUE ...` assignments the provider prepends.
  const argv = [...request.argv];
  if (argv[0] === 'env') {
    argv.shift();
    while (argv.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0]!)) argv.shift();
  }
  // The provider's re-mount probe: report mount paths that are no longer mountpoints.
  const script = argv[0] === '/bin/bash' && argv[1] === '-c' ? argv[2] : undefined;
  if (script?.includes('mountpoint -q')) {
    const match = /for p in (.+?); do/.exec(script);
    const paths = match ? match[1]!.split(' ').filter(Boolean) : [];
    const stale = paths.filter(mountPath => !activeMounts.has(mountPath));
    return { stdout: stale.length ? `${stale.join('\n')}\n` : '', exitCode: 0 };
  }
  if (argv[0] === 'echo') return { stdout: `${argv.slice(1).join(' ')}\n`, exitCode: 0 };
  return { exitCode: 0 };
}

export function createFakeBridge(options: { apiToken?: string; baseUrl?: string } = {}): FakeBridge {
  const baseUrl = options.baseUrl ?? 'https://bridge.example.com';
  let nextId = 1;

  let nextSession = 1;

  const bridge: FakeBridge = {
    requests: [],
    execs: [],
    files: new Map(),
    sandboxes: new Set(),
    persists: [],
    hydrations: [],
    mounts: [],
    unmounts: [],
    activeMounts: new Set(),
    sessions: new Set(),
    sleep: () => {
      bridge.files.clear();
      bridge.activeMounts.clear();
    },
    fetch: (async (input: Parameters<typeof globalThis.fetch>[0], init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? 'GET').toUpperCase();
      const headers = new Headers(init.headers as ConstructorParameters<typeof Headers>[0]);
      const authorization = headers.get('authorization') ?? undefined;
      const bodyText = typeof init.body === 'string' ? init.body : undefined;
      bridge.requests.push({ method, url, authorization, body: bodyText });

      if (options.apiToken && authorization !== `Bearer ${options.apiToken}`) {
        return new Response('unauthorized', { status: 401 });
      }
      const requested = new URL(url);
      if (requested.origin !== new URL(baseUrl).origin) return new Response('not found', { status: 404 });

      const path = requested.pathname;

      if (method === 'POST' && path === '/v1/sandbox') {
        const id = `sbx-${nextId++}`;
        bridge.sandboxes.add(id);
        return Response.json({ id });
      }

      const running = /^\/v1\/sandbox\/([^/]+)\/running$/.exec(path);
      if (method === 'GET' && running) {
        return Response.json({ running: bridge.sandboxes.has(decodeURIComponent(running[1]!)) });
      }

      const remove = /^\/v1\/sandbox\/([^/]+)$/.exec(path);
      if (method === 'DELETE' && remove) {
        bridge.sandboxes.delete(decodeURIComponent(remove[1]!));
        return new Response(null, { status: 204 });
      }

      const file = /^\/v1\/sandbox\/([^/]+)\/file\/(.+)$/.exec(path);
      if (method === 'PUT' && file) {
        const filePath = `/${decodeURIComponent(file[2]!)}`;
        const body = init.body;
        const content = typeof body === 'string' ? body : Buffer.from(body as unknown as Uint8Array).toString('utf8');
        bridge.files.set(filePath, content);
        return Response.json({ ok: true });
      }
      if (method === 'GET' && file) {
        const filePath = `/${decodeURIComponent(file[2]!)}`;
        const content = bridge.files.get(filePath);
        if (content === undefined) {
          return Response.json({ error: `not found: ${filePath}`, code: 'workspace_read_not_found' }, { status: 404 });
        }
        return new Response(Buffer.from(content, 'utf8'), { headers: { 'content-type': 'application/octet-stream' } });
      }

      const persist = /^\/v1\/sandbox\/([^/]+)\/persist$/.exec(path);
      if (method === 'GET' && persist) {
        bridge.persists.push(requested.searchParams.get('excludes'));
        return new Response(Buffer.from('fake-tar-archive', 'utf8'), {
          headers: { 'content-type': 'application/octet-stream' },
        });
      }

      const hydrate = /^\/v1\/sandbox\/([^/]+)\/hydrate$/.exec(path);
      if (method === 'POST' && hydrate) {
        const body = init.body;
        bridge.hydrations.push(new Uint8Array(typeof body === 'string' ? Buffer.from(body) : (body as Uint8Array)));
        return new Response(null, { status: 204 });
      }

      const mount = /^\/v1\/sandbox\/([^/]+)\/mount$/.exec(path);
      if (method === 'POST' && mount) {
        const body = JSON.parse(bodyText ?? '{}') as { mountPath?: string };
        bridge.mounts.push(body);
        if (body.mountPath) bridge.activeMounts.add(body.mountPath);
        return Response.json({ ok: true });
      }

      const unmount = /^\/v1\/sandbox\/([^/]+)\/unmount$/.exec(path);
      if (method === 'POST' && unmount) {
        const body = JSON.parse(bodyText ?? '{}') as { mountPath?: string };
        bridge.unmounts.push(body);
        if (body.mountPath) bridge.activeMounts.delete(body.mountPath);
        return Response.json({ ok: true });
      }

      const createSession = /^\/v1\/sandbox\/([^/]+)\/session$/.exec(path);
      if (method === 'POST' && createSession) {
        const requestBody = JSON.parse(bodyText ?? '{}') as { id?: string };
        const id = typeof requestBody.id === 'string' && requestBody.id ? requestBody.id : `sess-${nextSession++}`;
        bridge.sessions.add(id);
        return Response.json({ id });
      }

      const deleteSession = /^\/v1\/sandbox\/([^/]+)\/session\/([^/]+)$/.exec(path);
      if (method === 'DELETE' && deleteSession) {
        bridge.sessions.delete(decodeURIComponent(deleteSession[2]!));
        return new Response(null, { status: 204 });
      }

      const exec = /^\/v1\/sandbox\/([^/]+)\/exec$/.exec(path);
      if (method === 'POST' && exec) {
        const request = JSON.parse(bodyText ?? '{}') as FakeExecRequest;
        bridge.execs.push(request);
        const result = bridge.onExec?.(request) ?? defaultExec(request, bridge.activeMounts);

        let stream = '';
        const stdout = result.stdout ?? '';
        if (stdout) {
          const chunks = result.stdoutChunks ?? 1;
          const size = Math.ceil(stdout.length / chunks);
          for (let i = 0; i < stdout.length; i += size) {
            stream += sse('stdout', toBase64(stdout.slice(i, i + size)));
          }
        }
        if (result.stderr) stream += sse('stderr', toBase64(result.stderr));
        stream += result.error
          ? sse('error', JSON.stringify(result.error))
          : sse('exit', JSON.stringify({ exit_code: result.exitCode ?? 0 }));

        return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
      }

      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch,
  };

  return bridge;
}
