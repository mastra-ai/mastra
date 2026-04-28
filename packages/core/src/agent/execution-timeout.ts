import { ErrorCategory, ErrorDomain, MastraError } from '../error';

export type AgentExecutionTimeoutStrategy = 'fallback-model' | 'fail';

export type AgentExecutionTimeoutPolicy =
  | AgentExecutionTimeoutStrategy
  | {
      strategy: AgentExecutionTimeoutStrategy;
      maxFallbackHops?: number;
    };

export interface AgentExecutionTimeoutOptions {
  /**
   * Maximum wall-clock budget for one agent execution.
   */
  maxExecutionMs?: number;
  /**
   * Strategy to apply when the runtime budget is exceeded.
   *
   * @default "fail"
   */
  onTimeout?: AgentExecutionTimeoutPolicy;
}

export type NormalizedAgentExecutionTimeoutOptions = {
  maxExecutionMs: number;
  strategy: AgentExecutionTimeoutStrategy;
  maxFallbackHops: number;
};

export type AgentExecutionTimeoutDetails = {
  agentId?: string;
  agentName?: string;
  runId?: string;
  elapsedMs: number;
  maxExecutionMs: number;
  timeoutStrategy: AgentExecutionTimeoutStrategy;
  fallbackTriggered?: boolean;
  fallbackHop?: number;
};

export function normalizeAgentExecutionTimeoutOptions(
  execution?: AgentExecutionTimeoutOptions,
): NormalizedAgentExecutionTimeoutOptions | undefined {
  if (!execution?.maxExecutionMs) {
    return undefined;
  }

  const onTimeout = execution.onTimeout ?? 'fail';
  const strategy = typeof onTimeout === 'string' ? onTimeout : onTimeout.strategy;
  const maxFallbackHops =
    strategy === 'fallback-model' ? (typeof onTimeout === 'string' ? 1 : (onTimeout.maxFallbackHops ?? 1)) : 0;

  return {
    maxExecutionMs: execution.maxExecutionMs,
    strategy,
    maxFallbackHops,
  };
}

export function createAgentExecutionTimeoutError(details: AgentExecutionTimeoutDetails) {
  return new MastraError({
    id: 'AGENT_EXECUTION_TIMEOUT',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent execution timed out after ${details.elapsedMs}ms.`,
    details: {
      ...details,
      elapsedMs: String(details.elapsedMs),
      maxExecutionMs: String(details.maxExecutionMs),
      ...(details.fallbackHop !== undefined ? { fallbackHop: String(details.fallbackHop) } : {}),
    },
  });
}

export function isAgentExecutionTimeoutError(error: unknown): error is MastraError {
  if (error instanceof MastraError && error.id === 'AGENT_EXECUTION_TIMEOUT') {
    return true;
  }

  if (error instanceof Error && error.cause) {
    return isAgentExecutionTimeoutError(error.cause);
  }

  return false;
}

export class AgentExecutionTimeoutRuntime {
  #controller = new AbortController();
  #externalSignal?: AbortSignal;
  #timer?: ReturnType<typeof setTimeout>;
  #startedAt: number;
  #runId?: string;
  #activeTimeoutError?: MastraError;
  #fallbackHops = 0;

  readonly options: NormalizedAgentExecutionTimeoutOptions;
  readonly agentId?: string;
  readonly agentName?: string;

  constructor({
    options,
    externalSignal,
    agentId,
    agentName,
    runId,
  }: {
    options: NormalizedAgentExecutionTimeoutOptions;
    externalSignal?: AbortSignal;
    agentId?: string;
    agentName?: string;
    runId?: string;
  }) {
    this.options = options;
    this.#externalSignal = externalSignal;
    this.agentId = agentId;
    this.agentName = agentName;
    this.#runId = runId;
    this.#startedAt = Date.now();

    this.#attachExternalSignal();
    this.#scheduleTimeout();
  }

  get signal() {
    return this.#controller.signal;
  }

  get activeTimeoutError() {
    return this.#activeTimeoutError;
  }

  clear() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  shouldFallbackModel(isLastModel: boolean) {
    return (
      this.options.strategy === 'fallback-model' &&
      !!this.#activeTimeoutError &&
      !isLastModel &&
      this.#fallbackHops < this.options.maxFallbackHops
    );
  }

  resetForFallbackModel() {
    this.clear();
    this.#fallbackHops++;
    this.#activeTimeoutError = undefined;
    this.#controller = new AbortController();
    this.#startedAt = Date.now();
    this.#attachExternalSignal();
    this.#scheduleTimeout();
  }

  createTimeoutError(fallbackTriggered = false) {
    const elapsedMs = Date.now() - this.#startedAt;
    return createAgentExecutionTimeoutError({
      agentId: this.agentId,
      agentName: this.agentName,
      runId: this.#runId,
      elapsedMs,
      maxExecutionMs: this.options.maxExecutionMs,
      timeoutStrategy: this.options.strategy,
      fallbackTriggered,
      fallbackHop: this.#fallbackHops,
    });
  }

  #attachExternalSignal() {
    const externalSignal = this.#externalSignal;
    if (!externalSignal) return;

    if (externalSignal.aborted) {
      this.#controller.abort(externalSignal.reason);
      return;
    }

    externalSignal.addEventListener(
      'abort',
      () => {
        if (!this.#controller.signal.aborted) {
          this.#controller.abort(externalSignal.reason);
        }
      },
      { once: true },
    );
  }

  #scheduleTimeout() {
    this.#timer = setTimeout(() => {
      if (this.#controller.signal.aborted) return;

      const error = this.createTimeoutError();
      this.#activeTimeoutError = error;
      this.#controller.abort(error);
    }, this.options.maxExecutionMs);

    this.#timer.unref?.();
  }
}
