import { z } from 'zod';
import { ControlPlaneError } from '../core/contracts.js';
import { advisoryId, detailSchema, pageSchema, type AdvisoryDetail } from './contracts.js';

const OFFICIAL = 'https://cve.now';
const CDN = 'f9gkulwameaj0boi.public.blob.vercel-storage.com';
const MAX_BODY = 512 * 1024;
const cveCdnPath = /^\/public\/entries\/CVE-\d{4}-\d{4,}\.json$/;
const ghsaCdnPath =
  /^\/public\/entries\/GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}\.json$/i;
/** Recognize HTTP redirect status codes without following the redirect. */
const isRedirect = (status: number) => status >= 300 && status < 400;
const redirectDenied = () => new ControlPlaneError('ADVISORY_REDIRECT_DENIED', 503);

/** Read upstream JSON within the response limit and reject incompatible or malformed bodies. */
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    void response.body?.cancel().catch(() => undefined);
    throw new ControlPlaneError('ADVISORY_CONTENT_TYPE_INVALID', 503);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ControlPlaneError('ADVISORY_BODY_INVALID', 503);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw new ControlPlaneError('ADVISORY_BODY_INVALID', 503);
      }
      const { done, value } = chunk;
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new ControlPlaneError('ADVISORY_BODY_TOO_LARGE', 503);
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(parts)));
  } catch {
    throw new ControlPlaneError('ADVISORY_JSON_INVALID', 503);
  }
}
/** Parse an upstream value with the supplied schema or raise a typed advisory failure. */
function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ControlPlaneError('ADVISORY_SCHEMA_UNKNOWN', 503);
  return parsed.data;
}

export class AdvisorySource {
  private readonly base: URL;
  private readonly fixture: boolean;
  /** Bind the advisory client to validated source origins and its bounded request policy. */
  constructor(
    base = OFFICIAL,
    fixture = false,
    private readonly transport: typeof fetch = fetch,
  ) {
    this.base = new URL(base);
    this.fixture = fixture;
    if (fixture) {
      if (this.base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(this.base.hostname))
        throw new ControlPlaneError('ADVISORY_SOURCE_DENIED', 403);
    } else if (this.base.href !== `${OFFICIAL}/`) throw new ControlPlaneError('ADVISORY_SOURCE_DENIED', 403);
  }
  /** Fetch an advisory resource with timeout, redirect and response-size enforcement. */
  private async request(path: string, signal?: AbortSignal) {
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin) throw new ControlPlaneError('ADVISORY_SOURCE_DENIED', 403);
    let response: Response;
    try {
      response = await this.transport(url, {
        redirect: 'manual',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
        headers: { accept: 'application/json' },
      });
    } catch {
      throw new ControlPlaneError('ADVISORY_SOURCE_UNAVAILABLE', 503);
    }
    return response;
  }
  /** Read and validate the upstream advisory service status response. */
  async status(signal?: AbortSignal) {
    const response = await this.request('/api/v1/status', signal);
    if (isRedirect(response.status)) throw redirectDenied();
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => undefined);
      throw new ControlPlaneError('ADVISORY_STATUS_UNAVAILABLE', 503);
    }
    const value = await boundedJson(response);
    return validated(
      z
        .object({
          polling: z.record(z.string(), z.unknown()),
          history: z.record(z.string(), z.unknown()),
          backfill: z.record(z.string(), z.unknown()),
          storage: z.record(z.string(), z.unknown()),
        })
        .strip(),
      value,
    );
  }
  /** Read one bounded advisory page and validate its identifiers and pagination cursor. */
  async list(cursor?: string, signal?: AbortSignal) {
    const value = cursor ? z.string().min(1).max(1024).parse(cursor) : undefined;
    const response = await this.request(
      '/api/v1/entries' + (value ? `?cursor=${encodeURIComponent(value)}` : ''),
      signal,
    );
    if (isRedirect(response.status)) throw redirectDenied();
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => undefined);
      throw new ControlPlaneError('ADVISORY_LIST_UNAVAILABLE', 503);
    }
    return validated(pageSchema, await boundedJson(response));
  }
  /** Resolve a canonical advisory detail through the allowed source paths and validate its identity. */
  async detail(id: string, signal?: AbortSignal): Promise<AdvisoryDetail> {
    const requested = advisoryId.parse(id);
    const response = await this.request(`/api/v1/entries/${encodeURIComponent(requested)}`, signal);
    let detailResponse = response;
    let stage: 'PRIMARY' | 'CDN' = 'PRIMARY';
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw redirectDenied();
      if (/%|\\|(?:^|\/)\.{1,2}(?:\/|$)/.test(location)) throw redirectDenied();
      let url: URL;
      try {
        url = new URL(location, this.base);
      } catch {
        throw redirectDenied();
      }
      const allowed = this.fixture
        ? url.origin === this.base.origin && /^\/public\/entries\/[A-Za-z0-9-]+\.json$/.test(url.pathname)
        : url.protocol === 'https:' &&
          url.hostname === CDN &&
          url.port === '' &&
          (cveCdnPath.test(url.pathname) || ghsaCdnPath.test(url.pathname));
      if (!allowed || url.username || url.password || url.search || url.hash) throw redirectDenied();
      try {
        stage = 'CDN';
        detailResponse = await this.transport(url, {
          redirect: 'manual',
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
          headers: { accept: 'application/json' },
        });
      } catch {
        throw new ControlPlaneError('ADVISORY_SOURCE_UNAVAILABLE', 503);
      }
    } else if (isRedirect(response.status)) throw redirectDenied();
    if (isRedirect(detailResponse.status)) throw redirectDenied();
    if (detailResponse.status !== 200) {
      void detailResponse.body?.cancel().catch(() => undefined);
      const status = detailResponse.status;
      const category =
        status === 404
          ? '404'
          : status === 429
            ? '429'
            : status >= 400 && status < 500
              ? 'OTHER_4XX'
              : status >= 500 && status < 600
                ? '5XX'
                : 'OTHER';
      throw new ControlPlaneError(`ADVISORY_DETAIL_${stage}_${category}`, 503);
    }
    const detail = validated(detailSchema, await boundedJson(detailResponse));
    const canonical = detail.id.toUpperCase();
    if (
      requested.toUpperCase() !== canonical &&
      !detail.aliases.some(alias => alias.toUpperCase() === requested.toUpperCase())
    )
      throw new ControlPlaneError('ADVISORY_ALIAS_MISMATCH', 503);
    return detail;
  }
}
