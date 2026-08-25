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
  /** Overrides the default `echo`-only behaviour. */
  onExec?: (request: FakeExecRequest) => FakeExecResult;
}

function sse(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

function toBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function defaultExec(request: FakeExecRequest): FakeExecResult {
  // Strip `env KEY=VALUE ...` assignments the provider prepends.
  const argv = [...request.argv];
  if (argv[0] === 'env') {
    argv.shift();
    while (argv.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0]!)) argv.shift();
  }
  if (argv[0] === 'echo') return { stdout: `${argv.slice(1).join(' ')}\n`, exitCode: 0 };
  return { exitCode: 0 };
}

export function createFakeBridge(options: { apiToken?: string; baseUrl?: string } = {}): FakeBridge {
  const baseUrl = options.baseUrl ?? 'https://bridge.example.com';
  let nextId = 1;

  const bridge: FakeBridge = {
    requests: [],
    execs: [],
    files: new Map(),
    sandboxes: new Set(),
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

      const exec = /^\/v1\/sandbox\/([^/]+)\/exec$/.exec(path);
      if (method === 'POST' && exec) {
        const request = JSON.parse(bodyText ?? '{}') as FakeExecRequest;
        bridge.execs.push(request);
        const result = (bridge.onExec ?? defaultExec)(request);

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
