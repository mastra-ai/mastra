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
}

export type OpenAIWebSocketFetch = ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) & {
  close(): void;
};

/**
 * Creates a `fetch` function that routes OpenAI Responses API streaming
 * requests through a persistent WebSocket connection instead of HTTP.
 */
export function createOpenAIWebSocketFetch(options?: CreateOpenAIWebSocketFetchOptions): OpenAIWebSocketFetch {
  const wsUrl = options?.url ?? 'wss://api.openai.com/v1/responses';

  let ws: WebSocket | null = null;
  let connecting: Promise<WebSocket> | null = null;
  let connectionKey: string | null = null;
  let busy = false;

  function getConnection(authorization: string, headers: Record<string, string>): Promise<WebSocket> {
    const normalizedHeaders = { ...normalizeHeaders(options?.headers), ...headers };
    delete normalizedHeaders['authorization'];
    delete normalizedHeaders['openai-beta'];
    const nextConnectionKey = buildConnectionKey(authorization, normalizedHeaders);

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
      const socket = new WebSocket(wsUrl, {
        headers: {
          ...normalizedHeaders,
          Authorization: authorization,
          'OpenAI-Beta': 'responses_websockets=2026-02-06',
        },
      });

      socket.on('open', () => {
        ws = socket;
        connecting = null;
        resolve(socket);
      });

      socket.on('error', err => {
        if (connecting) {
          connecting = null;
          connectionKey = null;
          reject(err);
        }
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

    if (init?.method !== 'POST' || !url.endsWith('/responses')) {
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
    // In that case, fall back to HTTP streaming for the overlapping request.
    if (busy) {
      return globalThis.fetch(input, init);
    }

    const headers = normalizeHeaders(init.headers);
    const authorization = headers['authorization'] ?? '';

    // Acquire the busy lock before awaiting to prevent races
    busy = true;
    let connection: WebSocket;
    try {
      connection = await getConnection(authorization, headers);
    } catch (err) {
      busy = false;
      throw err;
    }

    const { stream: _stream, ...requestBody } = body;
    const encoder = new TextEncoder();

    const responseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        function cleanup({ closeSocket = false }: { closeSocket?: boolean } = {}) {
          connection.off('message', onMessage);
          connection.off('error', onError);
          connection.off('close', onClose);

          if (closeSocket && ws === connection) {
            connection.close();
            ws = null;
            connectionKey = null;
          }

          busy = false;
        }

        function onMessage(data: WebSocket.RawData) {
          const text = data.toString();
          controller.enqueue(encoder.encode(`data: ${text}\n\n`));

          try {
            const event = JSON.parse(text);
            if (event.type === 'response.completed' || event.type === 'error') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              cleanup();
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
          signal.addEventListener(
            'abort',
            () => {
              cleanup({ closeSocket: true });
              try {
                controller.error(signal.reason ?? new DOMException('Aborted', 'AbortError'));
              } catch {
                // already closed
              }
            },
            { once: true },
          );
        }

        connection.send(JSON.stringify({ type: 'response.create', ...requestBody }));
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

function buildConnectionKey(authorization: string, headers: Record<string, string>): string {
  return JSON.stringify({
    authorization,
    headers: Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  });
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
