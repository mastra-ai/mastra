import type { StepResult } from '../../workflows/types';
import type { StepExecutionParams, StepExecutionStrategy } from '../types';

/**
 * Executes workflow steps by calling a remote server endpoint over HTTP.
 * Used in standalone worker deployments where the worker runs orchestration
 * logic but delegates actual step execution to the server.
 */
export type HttpRemoteAuthConfig = { type: 'api-key'; key: string } | { type: 'bearer'; token: string };

export class HttpRemoteStrategy implements StepExecutionStrategy {
  #baseUrl: URL;
  #auth?: HttpRemoteAuthConfig;
  #timeoutMs: number;
  #workerToken?: string;

  constructor({
    serverUrl,
    auth,
    timeoutMs,
    workerToken,
  }: {
    serverUrl: string;
    auth?: HttpRemoteAuthConfig;
    timeoutMs?: number;
    /**
     * Shared secret used to authenticate this worker to the server's
     * step-execution endpoint. Falls back to `process.env.MASTRA_WORKER_SECRET`.
     */
    workerToken?: string;
  }) {
    // Normalize once: ensure trailing slash so URL joins compose correctly.
    const normalized = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
    this.#baseUrl = new URL(normalized);
    this.#auth = auth;
    this.#timeoutMs = timeoutMs ?? 30_000;
    this.#workerToken = workerToken ?? process.env.MASTRA_WORKER_SECRET;
  }

  async executeStep(params: StepExecutionParams): Promise<StepResult<any, any, any, any>> {
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

    return res.json() as Promise<StepResult<any, any, any, any>>;
  }

  /**
   * Build a JSON-serializable request body. The `params.requestContext` is
   * a plain object; if a caller stuffed a non-serializable value into it we
   * surface a clear error instead of silently dropping fields.
   */
  #buildBody(params: StepExecutionParams): string {
    const { abortSignal: _abortSignal, requestContext, ...rest } = params;
    let safeRequestContext: Record<string, any>;
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
      ...(this.#workerToken ? { workerToken: this.#workerToken } : {}),
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
