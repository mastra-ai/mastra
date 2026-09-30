import type { IncomingMessage, ServerResponse } from 'node:http';
import { isUtf8 } from 'node:buffer';
import { maxReviewBodyBytes } from './input.js';

export interface UploadLimits {
  maxBytes: number;
  timeoutMs: number;
  maxConcurrent: number;
  maxPerOwner: number;
}

// Example policy: two overlapping uploads per principal, with 16 read slots
// using less than 10 MiB of fixed buffers. A full body at 32 KiB/s takes less
// than 19 seconds; 30 seconds includes slack without allowing endless trickling.
// These are tunable application budgets, not Render or Mastra platform limits.
export const defaultUploadLimits: Readonly<UploadLimits> = {
  maxBytes: maxReviewBodyBytes,
  timeoutMs: 30_000,
  maxConcurrent: 16,
  maxPerOwner: 2,
};

/** Validate deployment settings before accepting requests. Body size follows the input contract. */
export function uploadLimitsFromEnv(env: NodeJS.ProcessEnv): UploadLimits {
  const options: Partial<UploadLimits> = {};
  for (const [key, name] of [
    ['timeoutMs', 'UPLOAD_TIMEOUT_MS'],
    ['maxConcurrent', 'UPLOAD_MAX_CONCURRENT'],
    ['maxPerOwner', 'UPLOAD_MAX_PER_OWNER'],
  ] as const) {
    const value = env[name];
    if (value === undefined) continue;
    if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
    options[key] = Number(value);
  }
  return resolveLimits(options);
}

function resolveLimits(options: Partial<UploadLimits>): UploadLimits {
  const limits = { ...defaultUploadLimits, ...options };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid upload limit: ${name}`);
  }
  // Node clamps larger delays to 1 ms instead of enforcing the requested deadline.
  if (limits.timeoutMs > 2_147_483_647) throw new Error('Upload timeout exceeds the Node timer range');
  return limits;
}

export class UploadError extends Error {
  constructor(
    readonly status: 400 | 408 | 413 | 429,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

/** Bound authenticated body uploads per server instance, before any job admission or provider lookup. */
export function createBodyReader(options: Partial<UploadLimits> = {}) {
  const limits = resolveLimits(options);
  let active = 0;
  const owners = new Map<string, number>();
  return async (request: IncomingMessage, owner: string): Promise<string> => {
    const length = request.headers['content-length'];
    if (length !== undefined && Number(length) > limits.maxBytes)
      throw new UploadError(413, 'Draft request is too large.');
    const owned = owners.get(owner) ?? 0;
    if (active >= limits.maxConcurrent || owned >= limits.maxPerOwner)
      throw new UploadError(429, 'Too many draft uploads. Try again shortly.', Math.ceil(limits.timeoutMs / 1000));
    active++;
    owners.set(owner, owned + 1);
    try {
      return await new Promise<string>((resolve, reject) => {
        // A fixed buffer also bounds allocation overhead from many tiny chunks.
        const body = Buffer.allocUnsafe(limits.maxBytes);
        let size = 0;
        let settled = false;
        const cleanup = () => {
          clearTimeout(deadline);
          request.off('data', onData);
          request.off('end', onEnd);
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          request.pause();
          // Keep the error listener until close: aborts can emit error after the initial failure.
          reject(error);
        };
        const onData = (chunk: Buffer) => {
          if (size + chunk.length > limits.maxBytes) {
            fail(new UploadError(413, 'Draft request is too large.'));
            return;
          }
          chunk.copy(body, size);
          size += chunk.length;
        };
        const onEnd = () => {
          if (settled) return;
          const bytes = body.subarray(0, size);
          if (!isUtf8(bytes)) {
            fail(new UploadError(400, 'Draft request must be valid UTF-8.'));
            return;
          }
          settled = true;
          cleanup();
          request.off('error', onError);
          request.off('close', onClose);
          resolve(bytes.toString('utf8'));
        };
        const onError = () => fail(new UploadError(400, 'Draft upload was interrupted.'));
        const onClose = () => {
          if (!settled) onError();
          request.off('error', onError);
          request.off('close', onClose);
        };
        // An absolute deadline cannot be extended by sending a byte periodically.
        const deadline = setTimeout(() => fail(new UploadError(408, 'Draft upload timed out.')), limits.timeoutMs);
        deadline.unref();
        request.on('data', onData);
        request.once('end', onEnd);
        request.on('error', onError);
        request.once('close', onClose);
      });
    } finally {
      active--;
      const remaining = owners.get(owner)! - 1;
      if (remaining) owners.set(owner, remaining);
      else owners.delete(owner);
    }
  };
}

/** Stop rejected uploads and close their connection after flushing the small error response. */
export function rejectUpload(request: IncomingMessage, response: ServerResponse, error: UploadError) {
  request.pause();
  // Node can mark a fully consumed request destroyed while its response socket
  // is still writable (for example, when UTF-8 validation fails at end-of-body).
  if (response.destroyed || response.socket?.destroyed) return;
  const ignoreError = () => {};
  request.on('error', ignoreError);
  request.once('close', () => request.off('error', ignoreError));
  // A peer that does not read the response cannot hold the socket indefinitely.
  const deadline = setTimeout(() => request.destroy(), 1000);
  deadline.unref();
  response.once('close', () => {
    clearTimeout(deadline);
    request.destroy();
  });
  response.writeHead(error.status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    connection: 'close',
    ...(error.retryAfter ? { 'retry-after': String(error.retryAfter) } : {}),
  });
  response.end(JSON.stringify({ error: error.message }), () => request.destroy());
}
