import { z } from "zod";
import { INTERCOM_API_VERSION, type IntercomDevelopmentConfig } from "./config";

// Explicit provider instructions may be longer than the bounded exponential
// fallback. Keep a finite upper bound that SQLite can safely schedule; values
// beyond it are a visible terminal failure, never a shortened retry.
export const MAX_INTERCOM_PROVIDER_RETRY_DELAY_MS = 30 * 24 * 60 * 60 * 1_000;

export class IntercomHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
    readonly ambiguous = false,
    message?: string,
    /** The request method is set by this client for reliable preflight handling. */
    readonly requestMethod?: string,
  ) {
    super(message ?? `Intercom request failed with HTTP ${status}.`);
  }
}

const errorSchema = z
  .object({
    errors: z.array(z.object({ code: z.string().optional() })).optional(),
  })
  .passthrough();

/** Small HTTP boundary: version is pinned on every request and failures never
 * retain response bodies, which can contain customer content. */
export class IntercomClient {
  constructor(
    private readonly config: IntercomDevelopmentConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request<T>(
    path: string,
    init: RequestInit = {},
    schema?: z.ZodType<T>,
  ): Promise<T> {
    const requestMethod = (init.method ?? "GET").toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      let response: Response;
      try {
        const target = new URL(path, `${this.config.apiBaseUrl}/`);
        if (
          target.origin !== this.config.apiBaseUrl ||
          !target.pathname.startsWith("/")
        )
          throw new Error("Intercom request destination is invalid.");
        response = await this.fetchImpl(target, {
          ...init,
          signal: controller.signal,
          redirect: "error",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.config.accessToken}`,
            "Intercom-Version": INTERCOM_API_VERSION,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
          },
        });
      } catch {
        // A request write may already have reached Intercom.  The caller must
        // persist uncertainty rather than replaying a POST.
        throw new IntercomHttpError(
          0,
          undefined,
          requestMethod === "POST",
          undefined,
          requestMethod,
        );
      }
      if (!response.ok) {
        let retryAfterMs: number | undefined;
        try {
          retryAfterMs = rateLimitDelay(response.headers);
        } catch (error) {
          throw new IntercomHttpError(
            response.status,
            undefined,
            false,
            `Permanent: ${String(error)}`,
            requestMethod,
          );
        }
        // Parse only enough to exercise malformed-error handling; never expose it.
        await response
          .clone()
          .json()
          .then((value) => errorSchema.safeParse(value))
          .catch(() => undefined);
        throw new IntercomHttpError(
          response.status,
          retryAfterMs,
          requestMethod === "POST" &&
            (response.status === 408 || response.status >= 500),
          undefined,
          requestMethod,
        );
      }
      const body = await response.json().catch(() => {
        throw new IntercomHttpError(
          response.status,
          undefined,
          requestMethod === "POST",
          undefined,
          requestMethod,
        );
      });
      if (!schema) return body as T;
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        // A successful HTTP status says the mutation may have happened. Never
        // turn a malformed receipt into a retryable local validation error.
        throw new IntercomHttpError(
          response.status,
          undefined,
          requestMethod === "POST",
          undefined,
          requestMethod,
        );
      }
      return parsed.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function rateLimitDelay(headers: Headers) {
  const retryAfter = headers.get("retry-after")?.trim();
  if (retryAfter) {
    if (/^\d+$/.test(retryAfter))
      return supportedProviderDelay(Number(retryAfter) * 1_000);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at))
      return supportedProviderDelay(Math.max(0, at - Date.now()));
  }
  const reset = headers.get("x-ratelimit-reset")?.trim();
  if (reset && /^\d+(?:\.\d+)?$/.test(reset)) {
    const value = Number(reset);
    // Intercom documents a Unix reset timestamp in seconds.
    return supportedProviderDelay(Math.max(0, value * 1_000 - Date.now()));
  }
  return undefined;
}

function supportedProviderDelay(delayMs: number) {
  if (
    !Number.isFinite(delayMs) ||
    delayMs < 0 ||
    delayMs > MAX_INTERCOM_PROVIDER_RETRY_DELAY_MS
  )
    throw new Error(
      "Intercom provider retry delay is outside scheduler bounds.",
    );
  return delayMs;
}
