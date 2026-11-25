// Imported as a namespace and read at run time: older cores in the peer range have no importer
// runner, and a named import of something missing would stop the whole package from loading.
import * as coreKnowledge from '@mastra/core/knowledge';

/** Where Platform starts an app's importer run. The app mounts `handleImporterRun` here with `registerApiRoute`. */
export const IMPORTER_RUN_PATH = '/_mastra/knowledge-importers/run';
/** Where the app talks to its run on the Knowledge API, authorized by the run token alone. */
const SESSIONS_PATH = '/v1/knowledge-importer-sessions';
/** The app's own Mastra credentials. An importer never gets them, whatever Platform names. */
const PLATFORM_CREDENTIAL_ENV = [
  'MASTRA_KNOWLEDGE_ACCESS_TOKEN',
  'MASTRA_PLATFORM_ACCESS_TOKEN',
  'MASTRA_PLATFORM_SECRET_KEY',
];

/** What a run token says about its run. Read without verifying: the claim verifies it. */
export interface ImporterRunTokenClaims {
  instanceId: string;
  bindingId: string;
}

export function readImporterRunToken(token: string): ImporterRunTokenClaims | null {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const run = (payload as { knowledgeImporterRun?: Record<string, unknown> } | null)?.knowledgeImporterRun;
    if (typeof run?.instanceId !== 'string' || typeof run.bindingId !== 'string') return null;
    return { instanceId: run.instanceId, bindingId: run.bindingId };
  } catch {
    return null;
  }
}

export interface ImporterSessionHostOptions {
  /** The Knowledge API origin, from config. Never a URL from the trigger. */
  apiUrl: string;
  instanceId: string;
  /** The run token Platform sent with the trigger. */
  token: string;
  /** Where credential env var names are looked up. Default `process.env`. */
  env?: Record<string, string | undefined>;
  /** More env var names an importer may never read, on top of the app's own Mastra credentials. */
  deniedCredentialEnv?: readonly string[];
  /** Told the name of each denied env var Platform asked for. Its value is never read. */
  onDeniedCredential?: (name: string) => void;
  fetch?: typeof fetch;
}

/**
 * Core's importer host over the Knowledge API's session routes. A refusal (409) throws core's
 * conflict error with the route's code; any other failure throws core's host error with the HTTP
 * status, so the runner resends after a 5xx or a lost connection and ends the run on anything else.
 * Platform returns credentials as env var names; they are read here, in the app, and a missing one
 * is left out so the runner ends the run `credential_missing`.
 */
export function createImporterSessionHost(options: ImporterSessionHostOptions) {
  const { KnowledgeImporterHostConflictError: ConflictError, KnowledgeImporterHostError: HostError } = coreKnowledge;
  const base = `${options.apiUrl.replace(/\/$/, '')}${SESSIONS_PATH}/${encodeURIComponent(options.instanceId)}`;
  const env = options.env ?? process.env;
  const denied = new Set([...PLATFORM_CREDENTIAL_ENV, ...(options.deniedCredentialEnv ?? [])]);
  const send = options.fetch ?? fetch;

  const call = async (op: string, body: unknown): Promise<any> => {
    let res: Response;
    try {
      res = await send(`${base}/${op}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        // A redirect would carry the run token somewhere else.
        redirect: 'error',
      });
    } catch {
      throw new HostError(`Knowledge importer ${op}: the Knowledge API could not be reached`);
    }
    const json: any = await res.json().catch(() => null);
    const code = typeof json?.error?.code === 'string' ? json.error.code : undefined;
    if (res.status === 409) {
      throw new ConflictError(code ?? 'run_not_active', `Knowledge importer ${op} refused: ${code ?? 'conflict'}`);
    }
    if (!res.ok) throw new HostError(`Knowledge importer ${op} failed: ${code ?? res.status}`, res.status);
    return json;
  };

  return {
    async startRun() {
      const started = await call('claim', {});
      if (started?.status !== 'started' || !started.binding) return started;
      const credentials: Record<string, string> = {};
      for (const [slot, name] of Object.entries((started.binding.credentials ?? {}) as Record<string, unknown>)) {
        if (typeof name !== 'string') continue;
        if (denied.has(name)) {
          // Left out, so the runner ends the run credential_missing.
          options.onDeniedCredential?.(name);
          continue;
        }
        const value = env[name];
        if (value !== undefined) credentials[slot] = value;
      }
      return { ...started, binding: { ...started.binding, credentials } };
    },
    flush: (flush: unknown) => call('flush', flush),
    heartbeat: (runId: string, generation: number) => call('heartbeat', { runId, generation }),
    finishRun: (request: unknown) => call('finish', request),
  };
}

export interface ImporterRunTarget {
  apiUrl: string;
  instanceId: string;
  importers: readonly unknown[];
  env?: Record<string, string | undefined>;
  deniedCredentialEnv?: readonly string[];
  onDeniedCredential?: (name: string) => void;
  fetch?: typeof fetch;
  /** Told how a run started from a request ended. */
  onEnd?: (result: object) => void;
  /** Told when the runner threw: an importer error, or the run couldn't be claimed. */
  onError?: (error: unknown) => void;
}

/**
 * Answers Platform's trigger for one importer run. The trigger's body is ignored: the run token is
 * the only input, and the claim returns everything the run uses. Answers 202 once the run is
 * started in the background; 401 without a readable run token; 404 for another Knowledge instance.
 */
export async function handleImporterRun(request: Request, target: ImporterRunTarget): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const claims = token ? readImporterRunToken(token) : null;
  if (!claims) return new Response(null, { status: 401 });
  if (claims.instanceId !== target.instanceId) return new Response(null, { status: 404 });
  const { runKnowledgeImport } = coreKnowledge;
  if (typeof runKnowledgeImport !== 'function') return new Response(null, { status: 501 });

  void runKnowledgeImport({
    importers: target.importers as any,
    host: createImporterSessionHost({ ...target, token }) as any,
    bindingId: claims.bindingId,
    ...(target.fetch && { fetch: target.fetch }),
  }).then(
    result => target.onEnd?.(result),
    error => target.onError?.(error),
  );
  return new Response(null, { status: 202 });
}
