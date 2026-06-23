/**
 * Single source of truth for the URL schemes the attachment pipeline understands.
 *
 * These MUST stay aligned with the protocols Mastra core accepts in
 * `packages/core/src/agent/message-list/prompt/attachments-to-parts.ts` (its
 * `switch (url.protocol)` whitelists exactly `http:`, `https:`, `gs:`, `s3:`
 * and throws `Unsupported URL protocol` for anything else). Forwarding a scheme
 * the UI accepts but core rejects would surface as a runtime error, so the sets
 * are kept in lockstep — see `schemes.parity.test.ts`.
 */

/** Schemes the browser can fetch directly (for inline previews and HEAD lookups). */
export const BROWSER_FETCHABLE_SCHEMES = ['https://', 'http://'] as const;

/**
 * Cloud-storage schemes that are forwarded to the model provider and resolved
 * server-side (e.g. Vertex AI for `gs://`, Bedrock for `s3://`). The browser
 * cannot fetch these, so they are never HEAD-ed or previewed inline.
 */
export const NON_FETCHABLE_REMOTE_SCHEMES = ['gs://', 's3://'] as const;

/** Every remote scheme an attachment URL may use (fetchable + cloud-storage). */
export const REMOTE_URL_SCHEMES = [...BROWSER_FETCHABLE_SCHEMES, ...NON_FETCHABLE_REMOTE_SCHEMES] as const;

/** True when the value starts with any supported remote scheme. */
export const isRemoteUrl = (value: string): boolean => REMOTE_URL_SCHEMES.some(scheme => value.startsWith(scheme));

/** True when the browser can fetch the value directly (http/https). */
export const isBrowserFetchableUrl = (value: string): boolean =>
  BROWSER_FETCHABLE_SCHEMES.some(scheme => value.startsWith(scheme));

/** True when the value is a cloud-storage URI the browser cannot fetch (gs/s3). */
export const isNonFetchableRemoteUrl = (value: string): boolean =>
  NON_FETCHABLE_REMOTE_SCHEMES.some(scheme => value.startsWith(scheme));
