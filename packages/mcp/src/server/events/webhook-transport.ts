import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';

import type { WebhookFailureReason } from '../../shared/events';

/** Largest response body read from a callback endpoint. Enough for a verification echo. */
const MAX_RESPONSE_BYTES = 4096;

/**
 * One POST to a callback endpoint.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface WebhookTransportRequest {
  url: URL;
  /** Validated IP to connect to. The hostname in `url` is used only for TLS SNI and the `Host` header. */
  address: string;
  family: 4 | 6;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

/**
 * Outcome of one POST: the response status and (truncated) body, or the failure category when
 * there was no HTTP response.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export type WebhookTransportResult = { status: number; body: string } | { error: WebhookFailureReason };

/**
 * Sends one webhook POST. Must not follow redirects.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export type WebhookTransport = (request: WebhookTransportRequest) => Promise<WebhookTransportResult>;

/** Maps a non-2xx status to its failure category. */
export function statusFailure(status: number): WebhookFailureReason {
  return status >= 500 ? 'http_5xx' : 'http_4xx';
}

const TIMEOUT = Symbol('timeout');

function connectionFailure(error: unknown): WebhookFailureReason {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'ETIMEDOUT') return 'timeout';
  if (
    code.startsWith('ERR_TLS') ||
    code.startsWith('ERR_SSL') ||
    code.startsWith('CERT_') ||
    code.startsWith('UNABLE_TO_') ||
    code.includes('SELF_SIGNED') ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'EPROTO'
  ) {
    return 'tls_error';
  }
  return 'connection_refused';
}

/**
 * Default {@link WebhookTransport}: `node:http`/`node:https` connecting to the pinned address, so a
 * DNS answer that changes after validation cannot redirect the request. Redirects are returned as
 * plain 3xx statuses (never followed) and only a bounded prefix of the response body is read.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export const nodeWebhookTransport: WebhookTransport = request =>
  new Promise(resolve => {
    const { url, address, family } = request;
    const lookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    };
    const client = url.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (result: WebhookTransportResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };

    const req = client.request(url, {
      method: 'POST',
      headers: { ...request.headers, 'content-length': String(Buffer.byteLength(request.body)) },
      lookup,
      agent: false,
    });
    const deadline = setTimeout(
      () => req.destroy(Object.assign(new Error('timeout'), { [TIMEOUT]: true })),
      request.timeoutMs,
    );
    deadline.unref?.();

    req.on('error', error => {
      finish({ error: TIMEOUT in error ? 'timeout' : connectionFailure(error) });
    });
    req.on('response', res => {
      const chunks: Buffer[] = [];
      let size = 0;
      const done = () => {
        finish({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
        res.destroy();
      };
      res.on('data', (chunk: Buffer) => {
        if (size >= MAX_RESPONSE_BYTES) return;
        const room = MAX_RESPONSE_BYTES - size;
        chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
        size += Math.min(chunk.length, room);
        if (size >= MAX_RESPONSE_BYTES) done();
      });
      res.on('end', done);
      res.on('error', done);
      res.on('aborted', done);
    });
    req.end(request.body);
  });
