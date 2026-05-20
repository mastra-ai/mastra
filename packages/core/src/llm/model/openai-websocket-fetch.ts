import WebSocket from 'ws';

export interface CreateOpenAIWebSocketFetchOptions {
  /**
   * WebSocket endpoint URL.
   * @default 'wss://api.openai.com/v1/responses'
   */
  url?: string;
  /**
   * Additional headers sent when establishing the WebSocket connection.
   * Authorization and OpenAI-Beta are managed internally.
   */
  headers?: Record<string, string>;
  /**
   * Convert an `api-key` request header into `Authorization: Bearer ...` for
   * providers whose WebSocket endpoint authenticates API keys as bearer tokens.
   */
  apiKeyAsBearer?: boolean;
  /**
   * Move an `api-key` request header into the WebSocket URL query string for
   * providers whose WebSocket endpoint authenticates API keys through a query
   * parameter. Entra ID and OpenAI bearer-token auth should leave this disabled.
   */
  apiKeyQueryParam?: string | false;
  /**
   * Optional beta header sent when establishing the WebSocket connection.
   * @default 'responses_websockets=2026-02-06'
   */
  betaHeader?: string | false;
}

export type OpenAIWebSocketFetch = ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & {
  close(): void;
};

const TERMINAL_RESPONSE_EVENTS = new Set(['response.completed', 'response.failed', 'response.incomplete', 'error']);

/**
 * Creates a `fetch` function that routes OpenAI Responses API streaming
 * requests through a persistent WebSocket connection instead of HTTP.
 */
export function createOpenAIWebSocketFetch(options?: CreateOpenAIWebSocketFetchOptions): OpenAIWebSocketFetch {
  const wsUrl = options?.url ?? 'wss://api.openai.com/v1/responses';
  const betaHeader = options?.betaHeader === undefined ? 'responses_websockets=2026-02-06' : options.betaHeader;
  const apiKeyQueryParam = options?.apiKeyQueryParam ?? false;

  let ws: WebSocket | null = null;
  let connecting: Promise<WebSocket> | null = null;
  let connectionKey: string | null = null;
  let nextQueryCredentialId = 0;
  const queryCredentialIds = new Map<string, string>();
  let busy = false;

  function getQueryCredentialCacheId(value?: string): string {
    if (!value) return '';

    const existing = queryCredentialIds.get(value);
    if (existing) return existing;

    const id = String(++nextQueryCredentialId);
    queryCredentialIds.set(value, id);
    return id;
  }

  function getConnection(
    authorization: string,
    headers: Record<string, string>,
    signal?: AbortSignal | null,
  ): Promise<WebSocket> {
    if (signal?.aborted) {
      return Promise.reject(getAbortError(signal));
    }

    const normalizedHeaders = { ...normalizeHeaders(options?.headers), ...headers };
    const apiKey = normalizedHeaders['api-key'];
    delete normalizedHeaders['authorization'];
    delete normalizedHeaders['openai-beta'];
    if (options?.apiKeyAsBearer || apiKeyQueryParam) {
      delete normalizedHeaders['api-key'];
    }
    const queryCredential = apiKeyQueryParam ? `${apiKeyQueryParam}:${getQueryCredentialCacheId(apiKey)}` : '';
    const nextConnectionKey = buildConnectionKey(authorization, normalizedHeaders, queryCredential);

    if (ws?.readyState === WebSocket.OPEN && connectionKey === nextConnectionKey) {
      return Promise.resolve(ws);
    }

    if (ws?.readyState === WebSocket.OPEN && connectionKey !== nextConnectionKey) {
      ws.close();
      ws = null;
      connectionKey = null;
    }

    if (connecting && connectionKey === nextConnectionKey) return connecting;

    connectionKey = nextConnectionKey;

    connecting = new Promise<WebSocket>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(getWebSocketUrl(wsUrl, apiKeyQueryParam, apiKey), {
        headers: {
          ...normalizedHeaders,
          ...(authorization ? { Authorization: authorization } : {}),
          ...(betaHeader ? { 'OpenAI-Beta': betaHeader } : {}),
        },
      });

      function cleanupAbortListener() {
        signal?.removeEventListener('abort', onAbort);
      }

      function rejectConnection(err: unknown, closeSocket = true) {
        if (settled) return;
        settled = true;
        connecting = null;
        connectionKey = null;
        cleanupAbortListener();
        if (closeSocket) socket.close();
        reject(err);
      }

      function onAbort() {
        rejectConnection(getAbortError(signal));
      }

      signal?.addEventListener('abort', onAbort, { once: true });

      socket.on('open', () => {
        if (signal?.aborted) {
          rejectConnection(getAbortError(signal));
          return;
        }
        settled = true;
        ws = socket;
        connecting = null;
        cleanupAbortListener();
        resolve(socket);
      });

      socket.on('error', err => {
        rejectConnection(err, false);
      });

      socket.on('close', () => {
        if (settled) return;
        rejectConnection(new Error('WebSocket closed before the connection opened'), false);
      });

      socket.on('close', () => {
        if (ws === socket) ws = null;
        if (ws === null) connectionKey = null;
      });
    });

    return connecting;
  }

  async function websocketFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url;

    if (init?.method !== 'POST' || !isResponsesUrl(url)) {
      return globalThis.fetch(input, init);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(typeof init.body === 'string' ? init.body : '');
    } catch {
      return globalThis.fetch(input, init);
    }

    if (!body.stream) {
      return globalThis.fetch(input, init);
    }

    // Prevent concurrent streams from sharing one WebSocket transport instance.
    // Only fall back to HTTP when the request does not depend on the socket's
    // connection-local previous_response_id cache.
    if (busy) {
      if (body.previous_response_id) {
        throw new Error(
          'Cannot start an overlapping WebSocket Responses continuation. Wait for the active stream to finish before sending previous_response_id.',
        );
      }
      return globalThis.fetch(input, init);
    }

    const headers = normalizeHeaders(init.headers);
    const authorization =
      headers['authorization'] ?? (options?.apiKeyAsBearer && headers['api-key'] ? `Bearer ${headers['api-key']}` : '');

    // Acquire the busy lock before awaiting to prevent races
    busy = true;
    let connection: WebSocket;
    try {
      connection = await getConnection(authorization, headers, init?.signal);
    } catch (err) {
      busy = false;
      throw err;
    }

    const { stream: _stream, background: _background, ...requestBody } = body;
    const encoder = new TextEncoder();

    let cleanupActiveStream: ((options?: { closeSocket?: boolean }) => void) | undefined;
    const responseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        let cleanedUp = false;
        let abortHandler: (() => void) | undefined;

        function cleanup({ closeSocket = false }: { closeSocket?: boolean } = {}) {
          if (cleanedUp) return;
          cleanedUp = true;
          connection.off('message', onMessage);
          connection.off('error', onError);
          connection.off('close', onClose);
          if (abortHandler) {
            init?.signal?.removeEventListener('abort', abortHandler);
            abortHandler = undefined;
          }

          if (closeSocket && ws === connection) {
            connection.close();
            ws = null;
            connectionKey = null;
          }

          busy = false;
          cleanupActiveStream = undefined;
        }

        cleanupActiveStream = cleanup;

        function onMessage(data: WebSocket.RawData) {
          const text = data.toString();
          controller.enqueue(encoder.encode(formatSSEData(text)));

          try {
            const event = JSON.parse(text);
            if (isTerminalWebSocketEvent(event)) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              cleanup({ closeSocket: shouldReconnectAfterEvent(event) });
              controller.close();
            }
          } catch {
            // non-JSON frame, continue
          }
        }

        function onError(err: Error) {
          cleanup();
          controller.error(err);
        }

        function onClose() {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }

        connection.on('message', onMessage);
        connection.on('error', onError);
        connection.on('close', onClose);

        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            cleanup({ closeSocket: true });
            controller.error(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
          }
          abortHandler = () => {
            cleanup({ closeSocket: true });
            try {
              controller.error(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            } catch {
              // already closed
            }
          };
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        connection.send(JSON.stringify({ type: 'response.create', ...requestBody }));
      },
      cancel() {
        cleanupActiveStream?.({ closeSocket: true });
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }

  return Object.assign(websocketFetch, {
    /** Close the underlying WebSocket connection. */
    close() {
      if (ws) {
        ws.close();
        ws = null;
      }
      connectionKey = null;
      connecting = null;
    },
  });
}

function isResponsesUrl(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith('/responses');
  } catch {
    return url.split('?')[0]?.endsWith('/responses') ?? false;
  }
}

function getWebSocketUrl(url: string, apiKeyQueryParam: string | false, apiKey?: string): string {
  if (!apiKeyQueryParam || !apiKey) return url;

  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set(apiKeyQueryParam, apiKey);
  return parsedUrl.toString();
}

function formatSSEData(text: string): string {
  return `${text
    .split(/\r?\n/)
    .map(line => `data: ${line}`)
    .join('\n')}\n\n`;
}

function buildConnectionKey(authorization: string, headers: Record<string, string>, queryCredential = ''): string {
  return JSON.stringify({
    authorization,
    queryCredential,
    headers: Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  });
}

function isTerminalWebSocketEvent(event: unknown): event is { type: string } {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    typeof event.type === 'string' &&
    TERMINAL_RESPONSE_EVENTS.has(event.type)
  );
}

function shouldReconnectAfterEvent(event: unknown): boolean {
  if (typeof event !== 'object' || event === null || !('error' in event)) return false;
  const error = event.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'websocket_connection_limit_reached'
  );
}

function getAbortError(signal?: AbortSignal | null): unknown {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError');
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key.toLowerCase()] = value;
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) result[key.toLowerCase()] = value;
    }
  }

  return result;
}
