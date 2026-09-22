/**
 * In-memory stand-in for the Boat Public API.
 *
 * It implements the routes this provider uses from https://docs.boat.dev/api/v1
 * so unit tests drive the real `@boatdev/sdk` client over `fetch` rather than a
 * mocked client — request shapes, headers and response envelopes are all
 * exercised for real.
 */

/** A request the fake received, for assertions about what the provider sent. */
export interface FakeBoatRequest {
  method: string;
  path: string;
  authorization?: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

/** A detached command the fake is pretending to run. */
interface FakeProcess {
  processId: number;
  pid: number;
  command: string;
  cwd?: string;
  stdout: string;
  stderr: string;
  running: boolean;
  exitCode: number | null;
  /** Caps the tail the status route returns, so overflow handling can be tested. */
  tailBytes: number;
}

/** How a queued command should behave when the provider spawns it. */
export interface FakeCommandOutcome {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  /** Deliver stdout across this many polls instead of all at once. */
  stdoutChunks?: number;
  /** Stay running until the process is killed. */
  runsUntilKilled?: boolean;
  /** Truncate the status tail to this many characters, forcing a log-file read. */
  tailBytes?: number;
}

export interface FakeBoatApi {
  fetch: typeof globalThis.fetch;
  /** Every request the fake received, oldest first. */
  requests: FakeBoatRequest[];
  /** Files written through the file routes, and the detached command logs. */
  files: Map<string, string>;
  /** Sandbox state, keyed by Boat id. */
  sandboxes: Map<string, Record<string, unknown>>;
  /** Named snapshots that exist. */
  namedSnapshots: Set<string>;
  /** Mark a sandbox as having a completed snapshot, as Boat's periodic snapshotting does. */
  completeSnapshot(sandboxId: string): void;
  /** Detached processes, keyed by process id. */
  processes: Map<number, FakeProcess>;
  /** Queue an outcome for the next command whose text contains `match`. */
  onCommand(match: string, outcome: FakeCommandOutcome): void;
  /** Requests filtered to one method and path prefix. */
  requestsTo(method: string, pathPrefix: string): FakeBoatRequest[];
}

const BASE_PATH = '/api/v1';

/** Boat's success envelope. Every 2xx body the API returns is shaped like this. */
function ok(type: string, body: Record<string, unknown>): Response {
  return Response.json({ ok: true, type, ...body });
}

/** Boat's error envelope, including the `requestId` support asks for. */
function fail(status: number, code: string, message: string): Response {
  return Response.json(
    { ok: false, type: 'error', status, code, message, requestId: 'req_fake', error: { code, message, status } },
    { status },
  );
}

/** A sandbox resource in the `ready` state, with the fields this provider reads. */
function readySandbox(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name: id,
    state: 'ready',
    type: 'default',
    vcpu: 4,
    memoryGB: 8,
    subdomain: `${id}-sub`,
    desktopAvailable: false,
    snapshotAvailable: false,
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    ...overrides,
  };
}

/**
 * Build a fake Boat API.
 *
 * @param options.sandboxId - Boat id handed out by `POST /sandboxes`.
 */
export function createFakeBoatApi(options: { sandboxId?: string } = {}): FakeBoatApi {
  const newSandboxId = options.sandboxId ?? 'bx_fake001';

  const requests: FakeBoatRequest[] = [];
  const files = new Map<string, string>();
  const sandboxes = new Map<string, Record<string, unknown>>();
  const namedSnapshots = new Set<string>();
  const processes = new Map<number, FakeProcess>();
  const queued: Array<{ match: string; outcome: FakeCommandOutcome }> = [];

  let nextProcessId = 1000;

  /** Steps remaining for each detached process, applied one per status poll. */
  const pendingSteps = new Map<number, Array<() => void>>();

  /** Outcome queued for `command`, or a default instant success. */
  const takeOutcome = (command: string): FakeCommandOutcome => {
    const index = queued.findIndex(entry => command.includes(entry.match));
    if (index === -1) return {};
    return queued.splice(index, 1)[0]!.outcome;
  };

  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.startsWith(BASE_PATH) ? url.pathname.slice(BASE_PATH.length) : url.pathname;

    const headers = new Headers(init?.headers);
    const rawBody = typeof init?.body === 'string' ? init.body : undefined;
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : undefined;

    requests.push({
      method,
      path,
      ...(headers.get('authorization') ? { authorization: headers.get('authorization')! } : {}),
      headers: Object.fromEntries(headers.entries()),
      ...(body ? { body } : {}),
    });

    // --- Sandbox lifecycle ---------------------------------------------------

    if (method === 'POST' && path === '/sandboxes') {
      sandboxes.set(newSandboxId, readySandbox(newSandboxId));
      return ok('sandbox.created', {
        status: 'provisioning',
        ttlSeconds: (body?.ttlSeconds as number | null | undefined) ?? 3600,
        sandbox: sandboxes.get(newSandboxId),
      });
    }

    const sandboxMatch = /^\/sandboxes\/([^/]+)(\/.*)?$/.exec(path);
    if (sandboxMatch) {
      const id = sandboxMatch[1]!;
      const sub = sandboxMatch[2] ?? '';
      const sandbox = sandboxes.get(id);

      if (!sandbox) return fail(404, 'sandbox_not_found', `No sandbox ${id}`);

      if (method === 'GET' && sub === '') return ok('sandbox.info', { sandbox });

      if (method === 'POST' && sub === '/resume') {
        sandboxes.set(id, { ...sandbox, state: 'ready' });
        return ok('sandbox.resumed', { id, status: 'ready', sandbox: sandboxes.get(id) });
      }

      if (method === 'POST' && sub === '/stop') {
        sandboxes.set(id, { ...sandbox, state: 'archived' });
        return ok('sandbox.stopped', { id, status: 'archived', sandbox: sandboxes.get(id) });
      }

      if (method === 'POST' && sub === '/fork') {
        // Boat forks from the latest snapshot and refuses when there isn't one.
        if (!sandbox.snapshotAvailable) {
          return fail(
            409,
            'fork_failed',
            'Fork needs a completed snapshot. Snapshots are made periodically and again when a Sandbox stops.',
          );
        }
        const forkId = `${id}_fork`;
        sandboxes.set(forkId, readySandbox(forkId, { snapshotAvailable: true }));
        return ok('sandbox.forked', { id: forkId, status: 'ready', sandbox: sandboxes.get(forkId) });
      }

      if (method === 'DELETE' && sub === '') {
        if (headers.get('x-ascii-confirm-delete') !== id) {
          return fail(400, 'confirmation_required', 'X-Ascii-Confirm-Delete must equal the sandbox id');
        }
        sandboxes.delete(id);
        return ok('sandbox.deleted', { id, status: 'deleted' });
      }

      // --- Files -------------------------------------------------------------

      if (method === 'PUT' && sub === '/files') {
        const filePath = body!.path as string;
        const content = body!.content as string;
        const encoding = (body!.encoding as string | undefined) ?? 'utf8';
        files.set(filePath, encoding === 'base64' ? Buffer.from(content, 'base64').toString('utf8') : content);
        return ok('file.written', { success: true, path: filePath, encoding, size: content.length });
      }

      if (method === 'GET' && sub === '/files') {
        const filePath = url.searchParams.get('path') ?? '';
        if (!files.has(filePath)) return fail(404, 'not_found', `No file ${filePath}`);
        const content = files.get(filePath)!;
        return ok('file.read', { success: true, path: filePath, encoding: 'utf8', size: content.length, content });
      }

      // --- Commands ----------------------------------------------------------

      if (method === 'POST' && sub === '/commands') {
        const command = body!.command as string;
        const cwd = body!.cwd as string | undefined;

        if (body!.detached !== true) {
          // Synchronous commands are the control path (kill) and the chmod after
          // writeFiles. Run kills against the fake's own process table.
          const killed = /(?:pkill|kill) -(TERM|KILL)[^\d]*(\d+)/.exec(command);
          if (killed) {
            const target = processes.get(Number(killed[2]));
            if (target) {
              target.running = false;
              target.exitCode = killed[1] === 'KILL' ? 137 : 143;
            }
          }
          return ok('command.finished', {
            success: true,
            exitCode: 0,
            stdout: '',
            stderr: '',
            timedOut: false,
            ...(cwd ? { cwd } : {}),
          });
        }

        const outcome = takeOutcome(command);
        const processId = nextProcessId++;
        const logPath = `/home/user/.ascii/processes/${processId}.log`;
        const errLogPath = `/home/user/.ascii/processes/${processId}.err.log`;

        processes.set(processId, {
          processId,
          pid: processId,
          command,
          ...(cwd ? { cwd } : {}),
          stdout: '',
          stderr: '',
          running: true,
          exitCode: null,
          tailBytes: outcome.tailBytes ?? Number.POSITIVE_INFINITY,
        });

        // Deliver the outcome across polls: each pending step is applied by one
        // status call, so a test can observe streaming rather than one lump.
        const chunks = outcome.stdoutChunks ?? 1;
        const stdout = outcome.stdout ?? '';
        const size = Math.ceil(stdout.length / chunks) || stdout.length;
        const steps: Array<() => void> = [];
        for (let i = 0; i < stdout.length; i += size || 1) {
          const slice = stdout.slice(i, i + size);
          steps.push(() => {
            const proc = processes.get(processId)!;
            proc.stdout += slice;
            files.set(logPath, proc.stdout);
          });
        }
        if (outcome.stderr) {
          steps.push(() => {
            const proc = processes.get(processId)!;
            proc.stderr += outcome.stderr!;
            files.set(errLogPath, proc.stderr);
          });
        }
        if (!outcome.runsUntilKilled) {
          steps.push(() => {
            const proc = processes.get(processId)!;
            proc.running = false;
            proc.exitCode = outcome.exitCode ?? 0;
          });
        }
        pendingSteps.set(processId, steps);

        return ok('command.started', {
          success: true,
          processId,
          pid: processId,
          command,
          ...(cwd ? { cwd } : {}),
          startedAt: new Date().toISOString(),
          logPath,
          errLogPath,
        });
      }

      const statusMatch = /^\/commands\/(\d+)$/.exec(sub);
      if (method === 'GET' && statusMatch) {
        const processId = Number(statusMatch[1]);
        const proc = processes.get(processId);
        if (!proc) return fail(404, 'not_found', `No process ${processId}`);

        pendingSteps.get(processId)?.shift()?.();

        const tail = (value: string) =>
          proc.tailBytes === Number.POSITIVE_INFINITY ? value : value.slice(-proc.tailBytes);

        return ok('command.status', {
          success: true,
          processId,
          pid: proc.pid,
          status: proc.running ? 'running' : 'exited',
          known: true,
          running: proc.running,
          exitCode: proc.exitCode,
          command: proc.command,
          stdout: tail(proc.stdout),
          stderr: tail(proc.stderr),
          stdoutTruncated: tail(proc.stdout).length < proc.stdout.length,
          stderrTruncated: tail(proc.stderr).length < proc.stderr.length,
          logPath: `/home/user/.ascii/processes/${processId}.log`,
          errLogPath: `/home/user/.ascii/processes/${processId}.err.log`,
        });
      }

      // --- Hosting -----------------------------------------------------------

      if (method === 'POST' && sub === '/host') {
        const port = body!.port as number;
        const isPublic = body!.public === true;
        const base = `https://${sandbox.subdomain as string}-${port}.on.boat.dev`;
        return ok('sandbox.hosted', {
          success: true,
          port,
          url: isPublic ? base : `${base}?_token=tok_fake`,
          isProtected: !isPublic,
        });
      }
    }

    // --- Named snapshots -----------------------------------------------------

    if (method === 'POST' && path === '/named-snapshots') {
      namedSnapshots.add(body!.name as string);
      return ok('snapshot.named.saving', {
        status: 'saving',
        snapshot: { name: body!.name, sandboxId: body!.sandboxId },
      });
    }

    const namedMatch = /^\/named-snapshots\/([^/]+)$/.exec(path);
    if (method === 'GET' && namedMatch) {
      const name = decodeURIComponent(namedMatch[1]!);
      if (!namedSnapshots.has(name)) return fail(404, 'not_found', `No snapshot ${name}`);
      return ok('snapshot.named.info', { snapshot: { name } });
    }

    return fail(404, 'not_found', `Unhandled ${method} ${path}`);
  };

  return {
    fetch: fetchImpl,
    requests,
    files,
    sandboxes,
    namedSnapshots,
    processes,
    completeSnapshot: sandboxId => {
      const sandbox = sandboxes.get(sandboxId);
      if (sandbox) sandboxes.set(sandboxId, { ...sandbox, snapshotAvailable: true, lastSnapshotStatus: 'completed' });
    },
    onCommand: (match, outcome) => queued.push({ match, outcome }),
    requestsTo: (method, pathPrefix) =>
      requests.filter(request => request.method === method && request.path.startsWith(pathPrefix)),
  };
}
