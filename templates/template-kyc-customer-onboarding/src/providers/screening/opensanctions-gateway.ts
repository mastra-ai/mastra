import { z } from 'zod';

import type { ScreeningPolicy } from '../../config/policies/screening.js';
import {
  ProviderError,
  ProviderMisconfiguredError,
  ProviderRateLimitedError,
  ProviderRejectedInputError,
  ProviderResultInvalidError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  type ProviderOperation,
} from '../../contracts/shared/provider.js';

const wireCandidateSchema = z
  .object({
    id: z.string().min(1).max(128),
    score: z.number().min(0).max(1),
    datasets: z.array(z.string().min(1).max(120)),
    properties: z.object({ topics: z.array(z.string().min(1).max(80)).min(1) }).loose(),
  })
  .loose();

const wireResponseSchema = z
  .object({
    responses: z
      .object({
        subject: z.object({ status: z.number().int(), results: z.array(wireCandidateSchema) }).loose(),
      })
      .loose(),
  })
  .loose();

export const openSanctionsMatchInputSchema = z
  .object({
    fullName: z.string().min(1).max(200),
    aliases: z.array(z.string().min(1).max(200)),
    dateOfBirth: z.iso.date().nullable(),
    nationality: z.string().length(2).nullable(),
  })
  .strict();

export type OpenSanctionsMatchCandidate = Readonly<{
  candidateId: string;
  score: number;
  topics: readonly string[];
  datasets: readonly string[];
}>;

export type OpenSanctionsMatchResult = Readonly<{
  candidates: readonly OpenSanctionsMatchCandidate[];
  attemptCount: number;
}>;

export type OpenSanctionsGatewayRequest = Readonly<{
  providerId: string;
  operation: Extract<ProviderOperation, 'SANCTIONS_SCREENING' | 'PEP_SCREENING'>;
  input: z.infer<typeof openSanctionsMatchInputSchema>;
  policy: ScreeningPolicy;
  kind: 'SANCTIONS' | 'PEP';
  deadlineAt: string;
  maxAttempts: number;
}>;

export type OpenSanctionsFetch = (input: string | URL | globalThis.Request, init?: RequestInit) => Promise<Response>;

type Sleep = (milliseconds: number) => Promise<void>;

const parseRetryAfter = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(1, date - Date.now());
};

const mapStatusError = (
  status: number,
  request: OpenSanctionsGatewayRequest,
  retryAfter: string | null,
  attemptCount: number,
): ProviderError => {
  const base = {
    providerId: request.providerId,
    operation: request.operation,
    safeMessage: 'The screening provider request did not complete',
    metadata: { attemptCount },
  };
  if (status === 401 || status === 403)
    return new ProviderMisconfiguredError({ ...base, missingKeys: ['OPENSANCTIONS_API_KEY'] });
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(retryAfter);
    return new ProviderRateLimitedError({
      ...base,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    });
  }
  if (status >= 400 && status < 500) return new ProviderRejectedInputError(base);
  return new ProviderUnavailableError(base);
};

const shouldRetryStatus = (status: number): boolean => status === 502 || status === 503 || status === 504;

export class OpenSanctionsGateway {
  readonly #apiKey: string;
  readonly #fetchImplementation: OpenSanctionsFetch;
  readonly #sleep: Sleep;
  readonly #baseDelayMs: number;

  constructor(
    apiKey: string,
    fetchImplementation: OpenSanctionsFetch = globalThis.fetch,
    sleep: Sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    baseDelayMs = 100,
  ) {
    this.#apiKey = apiKey;
    this.#fetchImplementation = fetchImplementation;
    this.#sleep = sleep;
    this.#baseDelayMs = baseDelayMs;
  }

  async match(request: OpenSanctionsGatewayRequest): Promise<OpenSanctionsMatchResult> {
    const input = openSanctionsMatchInputSchema.parse(request.input);
    const scope = request.kind === 'SANCTIONS' ? request.policy.sanctions : request.policy.pep;
    const url = new URL(`https://api.opensanctions.org/match/${request.policy.dataset}`);
    url.searchParams.set('algorithm', request.policy.algorithm);
    url.searchParams.set('threshold', String(scope.possibleMatchThreshold));
    url.searchParams.set('limit', String(request.policy.limit));
    for (const topic of scope.topics) url.searchParams.append('topics', topic);
    const properties: Record<string, string[]> = { name: [input.fullName] };
    if (input.aliases.length > 0) properties.alias = [...input.aliases];
    if (input.dateOfBirth !== null) properties.birthDate = [input.dateOfBirth];
    if (input.nationality !== null) properties.nationality = [input.nationality];
    const body = JSON.stringify({ queries: { subject: { schema: 'Person', properties } } });

    for (let attempt = 1; attempt <= request.maxAttempts; attempt += 1) {
      const remainingMs = Date.parse(request.deadlineAt) - Date.now();
      if (remainingMs <= 0) {
        throw new ProviderTimeoutError({
          providerId: request.providerId,
          operation: request.operation,
          safeMessage: 'The screening provider timed out',
          metadata: { attemptCount: Math.max(0, attempt - 1) },
        });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(remainingMs, 2_147_483_647));
      try {
        const response = await this.#fetchImplementation(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `ApiKey ${this.#apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
          signal: controller.signal,
        });
        if (!response.ok) {
          if (shouldRetryStatus(response.status) && attempt < request.maxAttempts) {
            await this.#sleep(this.#baseDelayMs * attempt);
            continue;
          }
          throw mapStatusError(response.status, request, response.headers.get('retry-after'), attempt);
        }
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new ProviderResultInvalidError({
            providerId: request.providerId,
            operation: request.operation,
            safeMessage: 'The screening provider returned an invalid result',
            metadata: { attemptCount: attempt },
          });
        }
        const parsed = wireResponseSchema.safeParse(payload);
        if (!parsed.success || parsed.data.responses.subject.status !== 200) {
          throw new ProviderResultInvalidError({
            providerId: request.providerId,
            operation: request.operation,
            safeMessage: 'The screening provider returned an invalid result',
            metadata: { attemptCount: attempt },
          });
        }
        return {
          candidates: parsed.data.responses.subject.results.map(candidate => ({
            candidateId: candidate.id,
            score: candidate.score,
            topics: [...candidate.properties.topics],
            datasets: [...candidate.datasets],
          })),
          attemptCount: attempt,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ProviderTimeoutError({
            providerId: request.providerId,
            operation: request.operation,
            safeMessage: 'The screening provider timed out',
            metadata: { attemptCount: attempt },
          });
        }
        if (error instanceof ProviderError) throw error;
        throw new ProviderUnavailableError({
          providerId: request.providerId,
          operation: request.operation,
          safeMessage: 'The screening provider is unavailable',
          metadata: { attemptCount: attempt },
        });
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new ProviderUnavailableError({
      providerId: request.providerId,
      operation: request.operation,
      safeMessage: 'The screening provider is unavailable',
      metadata: { attemptCount: request.maxAttempts },
    });
  }
}
