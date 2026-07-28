/**
 * Loopback OAuth Callback Server for MCP Client
 *
 * Provides a one-shot local HTTP server that captures the OAuth authorization
 * code delivered to a loopback redirect URL (RFC 8252). Hosts use it together
 * with MCPOAuthClientProvider to complete the authorization-code flow for
 * OAuth-protected MCP servers.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 */

import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';

/**
 * How many sequential ports to try after the preferred port when it is in use.
 */
const CALLBACK_PORT_FALLBACK_RANGE = 10;

/**
 * Default time to wait for the browser to deliver the authorization code.
 */
const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Authentication complete</title></head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 4rem;">
    <h1>Authentication complete</h1>
    <p>You can close this tab and return to your application.</p>
  </body>
</html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Authentication failed</title></head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 4rem;">
    <h1>Authentication failed</h1>
    <p>You can close this tab and retry from your application.</p>
  </body>
</html>`;

/**
 * Options for creating an OAuth callback server.
 */
export interface OAuthCallbackServerOptions {
  /**
   * The redirect URL the authorization server will send the browser back to.
   * Its port is the preferred port to bind; if that port is in use, the next
   * sequential ports are tried (see getCallbackUrlCandidates). The server
   * binds the URL's hostname — prefer the literal `127.0.0.1` over
   * `localhost` (RFC 8252 §8.3) so the browser and server agree on the
   * address family.
   *
   * @example 'http://127.0.0.1:5533/oauth/callback'
   */
  redirectUrl: string | URL;

  /**
   * The OAuth state parameter issued for this authorization request.
   * The state authenticates the redirect (CSRF protection per OAuth 2.1):
   * callback requests without a matching state receive an error response and
   * never settle the flow, so a stray local request cannot abort or spoof a
   * pending authorization.
   */
  state: string;
}

/**
 * The authorization code captured from the OAuth callback.
 */
export interface OAuthCallbackResult {
  /**
   * The authorization code to exchange for tokens.
   */
  code: string;

  /**
   * The state parameter echoed back by the authorization server.
   */
  state: string;
}

/**
 * A running loopback OAuth callback server.
 */
export interface OAuthCallbackServer {
  /**
   * The callback URL that is actually bound (reflects any port fallback).
   * Use this — not the preferred redirect URL — as the redirect_uri for the
   * authorization request.
   */
  url: URL;

  /**
   * The port the server is listening on.
   */
  port: number;

  /**
   * Waits for the browser to deliver the authorization code.
   *
   * Resolves once with the code and state from the first state-matching
   * callback request. Rejects on timeout, on a state-matching OAuth error
   * response (`error` / `error_description` query params), or when the
   * server is closed before a code arrives.
   */
  waitForCode(options?: { timeoutMs?: number }): Promise<OAuthCallbackResult>;

  /**
   * Stops the server and releases the port. Rejects any pending waitForCode.
   * Idempotent: closing an already-closed server resolves immediately.
   */
  close(): Promise<void>;
}

/**
 * Returns the candidate callback URLs for a redirect URL: the URL itself on
 * its preferred port, followed by the sequential fallback-port variants that
 * createOAuthCallbackServer will try when the preferred port is in use.
 *
 * This is the single source of the candidate list: register all of these as
 * redirect_uris during dynamic client registration so a fallback-bound
 * callback URL always matches a registered URI.
 */
export function getCallbackUrlCandidates(redirectUrl: string | URL): URL[] {
  const base = new URL(redirectUrl.toString());
  const preferredPort = base.port ? Number(base.port) : base.protocol === 'https:' ? 443 : 80;

  const candidates: URL[] = [];
  for (let offset = 0; offset <= CALLBACK_PORT_FALLBACK_RANGE; offset++) {
    const port = preferredPort + offset;
    // Assigning an out-of-range port to URL.port is silently ignored, which
    // would leave the candidate on the previous port — stop at the valid max.
    if (port > 65535) break;
    const candidate = new URL(base.toString());
    candidate.port = String(port);
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * Constant-time comparison of the callback's state parameter against the
 * expected state, so response timing does not leak how much of the state a
 * forged local request matched. (Length is still observable, which is fine —
 * the state's entropy is what protects it.)
 */
function stateMatches(receivedState: string, expectedState: string): boolean {
  const received = Buffer.from(receivedState);
  const expected = Buffer.from(expectedState);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function listen(server: HttpServer, port: number, hostname: string): Promise<NodeJS.ErrnoException | null> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        resolve(error);
      } else {
        reject(error);
      }
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(null);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, hostname);
  });
}

/**
 * Starts a one-shot loopback HTTP server that captures the OAuth
 * authorization code.
 *
 * The server binds the redirect URL's hostname on its port, falling back to
 * the next sequential ports when it is in use (see getCallbackUrlCandidates).
 * The first state-matching request on the callback path settles the outcome;
 * subsequent requests receive 410 Gone. Requests whose state does not match
 * receive an error response without settling, so only the genuine redirect
 * can complete or abort the flow. The response pages never echo the
 * authorization code.
 *
 * @example
 * ```typescript
 * const callbackServer = await createOAuthCallbackServer({
 *   redirectUrl: 'http://127.0.0.1:5533/oauth/callback',
 *   state: expectedState,
 * });
 * try {
 *   // Direct the user to the authorization URL, then:
 *   const { code } = await callbackServer.waitForCode();
 *   await transport.finishAuth(code);
 * } finally {
 *   await callbackServer.close();
 * }
 * ```
 */
export async function createOAuthCallbackServer(options: OAuthCallbackServerOptions): Promise<OAuthCallbackServer> {
  const candidates = getCallbackUrlCandidates(options.redirectUrl);
  const callbackPath = candidates[0]!.pathname;

  let settled = false;
  let resolveCode: (result: OAuthCallbackResult) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<OAuthCallbackResult>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // The rejection is consumed by waitForCode; this guard keeps an unconsumed
  // rejection (e.g. close() before waitForCode) from surfacing as unhandled.
  codePromise.catch(() => {});

  const settle = (outcome: { result: OAuthCallbackResult } | { error: Error }) => {
    if (settled) return;
    settled = true;
    if ('result' in outcome) {
      resolveCode(outcome.result);
    } else {
      rejectCode(outcome.error);
    }
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== callbackPath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    if (settled) {
      res.statusCode = 410;
      res.end('Callback already handled');
      return;
    }

    const respond = (statusCode: number, html: string) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    };

    // The state authenticates the redirect: the callback port is predictable,
    // so anything local can reach it, and the authorization server echoes the
    // state on both success and error redirects (RFC 6749 §4.1.2). Requests
    // without the expected state are not this flow's redirect and must not
    // settle the one-shot outcome.
    const state = url.searchParams.get('state');
    if (state === null || !stateMatches(state, options.state)) {
      respond(400, ERROR_HTML);
      return;
    }

    const error = url.searchParams.get('error');
    if (error) {
      const description = url.searchParams.get('error_description');
      respond(400, ERROR_HTML);
      settle({ error: new Error(`Authorization failed: ${error}${description ? ` (${description})` : ''}`) });
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      respond(400, ERROR_HTML);
      settle({ error: new Error('Authorization failed: missing authorization code') });
      return;
    }

    respond(200, SUCCESS_HTML);
    settle({ result: { code, state } });
  });

  // Bind the hostname the redirect URL names (brackets stripped for IPv6
  // literals) so e.g. http://localhost or http://[::1] redirects actually
  // reach the server rather than an unbound 127.0.0.1 socket.
  const hostname = candidates[0]!.hostname.replace(/^\[|\]$/g, '');

  let boundUrl: URL | undefined;
  let boundPort: number | undefined;
  for (const candidate of candidates) {
    const candidatePort = Number(candidate.port);
    const error = await listen(server, candidatePort, hostname);
    if (!error) {
      boundUrl = candidate;
      // Preserve the port we actually listened on. Reading URL.port back would
      // return '' for the default 80/443, losing the effective port.
      boundPort = candidatePort;
      break;
    }
  }
  if (!boundUrl || boundPort === undefined) {
    const firstPort = Number(candidates[0]!.port);
    const lastPort = Number(candidates[candidates.length - 1]!.port);
    throw new Error(`Failed to start OAuth callback server: ports ${firstPort}-${lastPort} are all in use`);
  }

  // The bind-time 'error' listener is removed once 'listening' fires, so after
  // this point the server has no 'error' handler. An emitted 'error' (e.g. a
  // post-bind socket failure) with no listener throws and would crash the host
  // process. Keep a persistent listener that settles the flow with the error
  // instead of letting it become an uncaught exception.
  server.on('error', error => {
    settle({ error: error instanceof Error ? error : new Error(String(error)) });
  });

  return {
    url: boundUrl,
    port: boundPort,

    waitForCode({ timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS } = {}) {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out waiting for OAuth callback after ${timeoutMs}ms`)),
          timeoutMs,
        );
        timer.unref?.();
      });
      return Promise.race([codePromise, timeout]).finally(() => clearTimeout(timer));
    },

    close() {
      settle({ error: new Error('OAuth callback server closed before receiving an authorization code') });
      // Browsers keep the callback connection alive after the response, and
      // server.close() waits for every socket to end — without this the port
      // stays held until the keep-alive timeout expires.
      server.closeIdleConnections();
      return new Promise<void>((resolve, reject) => {
        server.close(error => {
          // Closing twice is fine (e.g. an explicit cancel followed by the
          // flow's own cleanup); only real errors propagate.
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}
