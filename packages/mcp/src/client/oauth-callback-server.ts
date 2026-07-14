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
   * sequential ports are tried (see getCallbackUrlCandidates).
   *
   * @example 'http://127.0.0.1:5533/oauth/callback'
   */
  redirectUrl: string | URL;

  /**
   * The OAuth state parameter issued for this authorization request.
   * Callback requests with a different state are rejected (CSRF protection
   * per OAuth 2.1).
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
   * Resolves once with the code and state from the first callback request.
   * Rejects on timeout, on an OAuth error response (`error` /
   * `error_description` query params), on a state mismatch, or when the
   * server is closed before a code arrives.
   */
  waitForCode(options?: { timeoutMs?: number }): Promise<OAuthCallbackResult>;

  /**
   * Stops the server and releases the port. Rejects any pending waitForCode.
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
    const candidate = new URL(base.toString());
    candidate.port = String(preferredPort + offset);
    candidates.push(candidate);
  }
  return candidates;
}

function listen(server: HttpServer, port: number): Promise<NodeJS.ErrnoException | null> {
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
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Starts a one-shot loopback HTTP server that captures the OAuth
 * authorization code.
 *
 * The server binds 127.0.0.1 on the redirect URL's port, falling back to the
 * next sequential ports when it is in use (see getCallbackUrlCandidates).
 * The first request on the callback path settles the outcome; subsequent
 * requests receive 410 Gone. The response pages never echo the
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

    const error = url.searchParams.get('error');
    if (error) {
      const description = url.searchParams.get('error_description');
      respond(400, ERROR_HTML);
      settle({ error: new Error(`Authorization failed: ${error}${description ? ` (${description})` : ''}`) });
      return;
    }

    if (url.searchParams.get('state') !== options.state) {
      respond(400, ERROR_HTML);
      settle({ error: new Error('Authorization failed: state mismatch') });
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      respond(400, ERROR_HTML);
      settle({ error: new Error('Authorization failed: missing authorization code') });
      return;
    }

    respond(200, SUCCESS_HTML);
    settle({ result: { code, state: options.state } });
  });

  let boundUrl: URL | undefined;
  for (const candidate of candidates) {
    const error = await listen(server, Number(candidate.port));
    if (!error) {
      boundUrl = candidate;
      break;
    }
  }
  if (!boundUrl) {
    const firstPort = Number(candidates[0]!.port);
    const lastPort = Number(candidates[candidates.length - 1]!.port);
    throw new Error(`Failed to start OAuth callback server: ports ${firstPort}-${lastPort} are all in use`);
  }

  return {
    url: boundUrl,
    port: Number(boundUrl.port),

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
      return new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    },
  };
}
