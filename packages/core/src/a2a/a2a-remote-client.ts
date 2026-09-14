import { MastraA2AError } from './error';
import type { A2AAgentOptions, RequestCredentialsMode } from './types';
import {
  getA2ARequestHeaders,
  selectA2AInterface,
  type A2AProtocolSelection,
  type A2AProtocolVersion,
  type A2ARemoteAgentCard,
} from './wire-protocol';

export type FetchLike = typeof fetch;

type JSONRPCRequestBody = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

export type A2ARemoteBootstrap = {
  card: A2ARemoteAgentCard;
  cardUrl: string;
  executionUrl: string;
  protocolVersion: A2AProtocolVersion;
  streamingSupported: boolean;
};

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: JSONRPCRequestBody | Record<string, unknown>;
  stream?: boolean;
  credentials?: RequestCredentialsMode;
  signal?: AbortSignal;
};

/**
 * Version-aware HTTP transport for remote A2A agents.
 * A2AAgent is the SubAgent Adapter; this Module owns card bootstrap and RPC transport.
 */
export class A2ARemoteClient {
  readonly #url: string;
  readonly #headers: Record<string, string>;
  readonly #fetch: FetchLike;
  readonly #retries: number;
  readonly #backoffMs: number;
  readonly #maxBackoffMs: number;
  readonly #credentials?: RequestCredentialsMode;
  readonly #abortSignal?: AbortSignal;
  readonly #timeoutMs?: number;
  readonly #verifyAgentCard?: A2AAgentOptions['verifyAgentCard'];
  readonly #protocolVersion: A2AProtocolSelection;

  #cachedBootstrap?: A2ARemoteBootstrap;

  constructor(
    options: Pick<
      A2AAgentOptions,
      | 'url'
      | 'headers'
      | 'fetch'
      | 'retries'
      | 'backoffMs'
      | 'maxBackoffMs'
      | 'credentials'
      | 'abortSignal'
      | 'timeoutMs'
      | 'verifyAgentCard'
      | 'protocolVersion'
    >,
  ) {
    this.#url = options.url.replace(/\/$/, '');
    this.#headers = options.headers ?? {};
    this.#fetch = options.fetch ?? fetch;
    this.#retries = options.retries ?? 0;
    this.#backoffMs = options.backoffMs ?? 250;
    this.#maxBackoffMs = options.maxBackoffMs ?? 1_000;
    this.#credentials = options.credentials;
    this.#abortSignal = options.abortSignal;
    this.#timeoutMs = options.timeoutMs;
    this.#verifyAgentCard = options.verifyAgentCard;
    this.#protocolVersion = options.protocolVersion ?? 'auto';
  }

  get url() {
    return this.#url;
  }

  resolveCardUrl() {
    return this.#url.endsWith('/agent-card.json') ? this.#url : `${this.#url}/.well-known/agent-card.json`;
  }

  async getBootstrap({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<A2ARemoteBootstrap> {
    if (!forceRefresh && this.#cachedBootstrap) {
      return this.#cachedBootstrap;
    }

    const cardUrl = this.resolveCardUrl();
    let response: Response;
    try {
      response = await this.request(cardUrl, {
        method: 'GET',
        headers: this.#protocolVersion === '1.0' ? getA2ARequestHeaders('1.0') : {},
        signal: this.#abortSignal,
      });
    } catch (error) {
      if (this.#protocolVersion !== 'auto') {
        throw error;
      }
      response = await this.request(cardUrl, {
        method: 'GET',
        headers: getA2ARequestHeaders('1.0'),
        signal: this.#abortSignal,
      });
    }

    const card = (await response.json()) as A2ARemoteAgentCard;
    const fetchedAt = new Date();

    if (this.#verifyAgentCard) {
      await this.#verifyAgentCard.verify(card, { cardUrl, fetchedAt });
    }

    const selectedInterface = selectA2AInterface(card, this.#protocolVersion);
    const bootstrap: A2ARemoteBootstrap = {
      card,
      cardUrl,
      executionUrl: selectedInterface.url,
      protocolVersion: selectedInterface.protocolVersion,
      streamingSupported: card.capabilities?.streaming ?? false,
    };

    this.#cachedBootstrap = bootstrap;
    return bootstrap;
  }

  async request(
    url: string,
    { method = 'POST', headers = {}, body, stream = false, credentials, signal }: RequestOptions = {},
  ): Promise<Response> {
    let attempts = 0;
    let lastError: unknown;

    const finalHeaders = new Headers({
      accept: stream ? 'text/event-stream' : 'application/json',
      ...this.#headers,
      ...headers,
    });
    if (body && !finalHeaders.has('content-type')) {
      finalHeaders.set('content-type', 'application/json');
    }

    while (attempts <= this.#retries) {
      try {
        const requestSignal = this.#resolveRequestSignal(signal);
        const response = await this.#fetch(url, {
          method,
          headers: finalHeaders,
          body: body ? JSON.stringify(body) : undefined,
          credentials: credentials ?? this.#credentials,
          signal: requestSignal,
        });

        if (!response.ok) {
          throw MastraA2AError.invalidAgentResponse(`Remote A2A request failed with status ${response.status}.`, {
            status: response.status,
            url,
          });
        }

        return response;
      } catch (error) {
        lastError = error;

        if (!shouldRetryRequest(error)) {
          throw lastError;
        }

        if (attempts === this.#retries) {
          break;
        }

        attempts += 1;
        await this.#delay(attempts);
      }
    }

    throw lastError;
  }

  async #delay(attempt: number = 0) {
    const delayMs = Math.min(this.#backoffMs * Math.max(1, attempt), this.#maxBackoffMs);
    if (delayMs <= 0) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  #resolveRequestSignal(signal?: AbortSignal) {
    if (this.#timeoutMs == null) {
      return signal ?? this.#abortSignal;
    }

    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    const signals = [signal, this.#abortSignal, timeoutSignal].filter(Boolean) as AbortSignal[];

    if (signals.length === 0) {
      return undefined;
    }

    return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  }
}

function shouldRetryRequest(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : typeof error === 'object' &&
          error !== null &&
          'data' in error &&
          typeof error.data === 'object' &&
          error.data !== null &&
          'status' in error.data &&
          typeof error.data.status === 'number'
        ? error.data.status
        : undefined;

  if (status === undefined) {
    return true;
  }

  return status === 408 || status === 429 || status >= 500;
}
