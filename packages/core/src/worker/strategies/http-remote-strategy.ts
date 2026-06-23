import type { StepResult } from '../../workflows/types';
import type { StepExecutionParams, StepExecutionStrategy } from '../types';

/**
 * Auth credential used by `HttpRemoteStrategy` when calling the server's
 * step-execution endpoint. The server's configured Mastra auth provider
 * (`authenticateToken`) decides whether to accept the credential — this
 * strategy just forwards it.
 *
 * - `bearer`: send `Authorization: Bearer <token>` (default when only a
 *   token string is available)
 * - `api-key`: send `x-worker-api-key: <key>` for deployments that prefer
 *   a custom header (the auth provider's `authenticateToken(_, request)`
 *   callback can read it from `request.headers`)
 * - `header`: arbitrary header / value pair for fully custom schemes
 */
export type HttpRemoteAuthConfig =
  | { type: 'bearer'; token: string }
  | { type: 'api-key'; key: string }
  | { type: 'header'; name: string; value: string };

/**
 * Executes workflow steps by calling a remote server endpoint over HTTP.
 * Used in standalone worker deployments where the worker runs orchestration
 * logic but delegates actual step execution to the server.
 *
 * Authentication piggy-backs on Mastra's existing auth pipeline: the route
 * is marked `requiresAuth: true` and the deployer's `authenticateToken`
 * provider validates the credential we send here. There is no separate
 * "worker secret" — whatever auth scheme the rest of the server uses is
 * what the worker uses too.
 */
export class HttpRemoteStrategy implements StepExecutionStrategy {
  #baseUrl: URL;
  #auth?: HttpRemoteAuthConfig;
  #timeoutMs: number;

  constructor({ serverUrl, auth, timeoutMs }: { serverUrl: string; auth?: HttpRemoteAuthConfig; timeoutMs?: number }) {
    // Normalize once: ensure trailing slash so URL joins compose correctly.
    const normalized = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
    this.#baseUrl = new URL(normalized);
    this.#auth = auth ?? HttpRemoteStrategy.#authFromEnv();
    this.#timeoutMs = timeoutMs ?? 30_000;
  }

  /**
   * Default credential resolution: when `MASTRA_WORKER_AUTH_TOKEN` is set,
   * send it as a bearer token. The server's auth provider decides whether
   * to accept it.
   */
  static #authFromEnv(): HttpRemoteAuthConfig | undefined {
    const token = process.env.MASTRA_WORKER_AUTH_TOKEN;
    if (!token) return undefined;
    return { type: 'bearer', token };
  }

  async executeStep(params: StepExecutionParams): Promise<StepResult<unknown, unknown, unknown, unknown>> {
    const url = new URL(
      `workflows/${encodeURIComponent(params.workflowId)}/runs/${encodeURIComponent(params.runId)}/steps/execute`,
      this.#baseUrl,
    );

    const body = this.#buildBody(params);

    const signal = this.#combineSignals(params.abortSignal);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.#buildAuthHeaders(),
      },
      body,
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new StepExecutionError(res.status, text);
    }

    return res.json() as Promise<StepResult<unknown, unknown, unknown, unknown>>;
  }

  /**
   * Build a JSON-serializable request body. The `params.requestContext` is
   * a plain object; if a caller stuffed a non-serializable value into it we
   * surface a clear error instead of silently dropping fields.
   *
   * `abortSignal` is consumed via fetch's `signal` argument — it must not
   * be in the body.
   */
  #buildBody(params: StepExecutionParams): string {
    const { abortSignal: _abortSignal, requestContext, ...rest } = params;
    let safeRequestContext: Record<string, unknown>;
    try {
      safeRequestContext = JSON.parse(JSON.stringify(requestContext ?? {}));
    } catch (err) {
      throw new Error(
        `HttpRemoteStrategy: requestContext is not JSON-serializable. ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return JSON.stringify({
      ...rest,
      requestContext: safeRequestContext,
    });
  }

  #combineSignals(externalSignal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    if (!externalSignal) return timeoutSignal;
    // AbortSignal.any aborts when any input aborts.
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any([timeoutSignal, externalSignal]);
    }
    // Fallback for runtimes without AbortSignal.any
    const controller = new AbortController();
    const onAbort = (reason: unknown) => controller.abort(reason);
    if (externalSignal.aborted) onAbort(externalSignal.reason);
    else externalSignal.addEventListener('abort', () => onAbort(externalSignal.reason), { once: true });
    if (timeoutSignal.aborted) onAbort(timeoutSignal.reason);
    else timeoutSignal.addEventListener('abort', () => onAbort(timeoutSignal.reason), { once: true });
    return controller.signal;
  }

  #buildAuthHeaders(): Record<string, string> {
    if (!this.#auth) return {};
    if (this.#auth.type === 'api-key') {
      return { 'x-worker-api-key': this.#auth.key };
    }
    if (this.#auth.type === 'header') {
      return { [this.#auth.name]: this.#auth.value };
    }
    return { authorization: `Bearer ${this.#auth.token}` };
  }
}

export class StepExecutionError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Step execution failed with status ${status}: ${body}`);
    this.name = 'StepExecutionError';
    this.status = status;
    this.body = body;
  }
}
