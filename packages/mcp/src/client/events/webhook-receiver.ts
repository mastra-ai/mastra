import { WEBHOOK_HEADERS, parseWebhookBody, verifyWebhook } from '../../shared/events';
import type { EventOccurrence, WebhookControlBody } from '../../shared/events';

/** A verified webhook body other than the verification handshake. */
export type WebhookBody =
  | { kind: 'event'; event: EventOccurrence }
  | { kind: 'control'; control: Exclude<WebhookControlBody, { type: 'verification' }> };

/** Where verified deliveries for one subscription go. */
export interface WebhookRoute {
  secret: string;
  onBody: (body: WebhookBody) => void;
}

function respond(status: number, body?: Record<string, unknown>): Response {
  return body
    ? new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    : new Response(null, { status });
}

/**
 * Receives webhook deliveries for every subscription of one `MCPClient` and routes them by
 * `X-MCP-Subscription-Id`. Every body is signature-checked before it is parsed.
 *
 * @internal
 */
export class WebhookReceiver {
  /** Several routes per id only if two servers derive the same id; the verifying secret picks one. */
  private readonly routes = new Map<string, WebhookRoute[]>();
  /** Secrets of subscribes still in flight, which have no id yet but must answer the handshake. */
  private readonly pendingSecrets = new Map<string, number>();

  /** Accepts verification handshakes signed with `secret` until the returned function is called. */
  expect(secret: string): () => void {
    this.pendingSecrets.set(secret, (this.pendingSecrets.get(secret) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.pendingSecrets.get(secret) ?? 1) - 1;
      if (count > 0) this.pendingSecrets.set(secret, count);
      else this.pendingSecrets.delete(secret);
    };
  }

  /** Routes deliveries for subscription `id` signed with `route.secret`. Returns the unregister function. */
  register(id: string, route: WebhookRoute): () => void {
    const routes = this.routes.get(id) ?? [];
    routes.push(route);
    this.routes.set(id, routes);
    return () => {
      const current = this.routes.get(id);
      if (!current) return;
      const remaining = current.filter(entry => entry !== route);
      if (remaining.length > 0) this.routes.set(id, remaining);
      else this.routes.delete(id);
    };
  }

  /**
   * Handles one webhook request: `405` for non-POST, `503` for an id not routed yet (the server
   * retries), `401` for a bad or stale signature, `400` for a malformed body, otherwise `200`.
   * Verification handshakes are answered with the echoed challenge.
   */
  async handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return respond(405);
    const body = new Uint8Array(await request.arrayBuffer());
    const id = request.headers.get(WEBHOOK_HEADERS.subscriptionId) ?? '';
    const routes = this.routes.get(id) ?? [];
    const candidates = [...new Set([...routes.map(route => route.secret), ...this.pendingSecrets.keys()])];
    if (candidates.length === 0) return respond(503);

    const verified = verifyWebhook({ secret: candidates, headers: request.headers, body });
    if (!verified.ok) return respond(routes.length > 0 ? 401 : 503);

    let parsed: ReturnType<typeof parseWebhookBody>;
    try {
      parsed = parseWebhookBody(JSON.parse(new TextDecoder().decode(body)));
    } catch {
      return respond(400);
    }

    let routed: WebhookBody;
    if (parsed.kind === 'event') {
      routed = parsed;
    } else if (parsed.control.type === 'verification') {
      return respond(200, { challenge: parsed.control.challenge });
    } else {
      routed = { kind: 'control', control: parsed.control };
    }
    const route = routes.find(entry => entry.secret === verified.secret);
    // Signed with a pending secret only: the subscribe response has not been routed yet.
    if (!route) return respond(503);
    route.onBody(routed);
    return respond(200);
  }
}
