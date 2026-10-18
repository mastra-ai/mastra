import {
  publicApiRoutes,
  type CaseEventsPage,
  type CaseSummary,
  type CreateCaseRequest,
  type DemoPersona,
  type DemoSession,
  type MetricsSummary,
  type PublicError,
  type ReviewDecisionRequest,
  type ReviewPage,
  type ReviewQueueItem,
  type SubmitInformationRequest,
  type UploadDocumentResult,
} from '../../../src/contracts/http/public-api.js';

import { portalConfig } from '../config.js';

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly correlationId: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const opaqueId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const browserFetch: typeof fetch = (input, init) => fetch(input, init);

export class KycApiClient {
  #csrfToken: string | undefined;
  readonly #idempotencyKeys = new Map<string, string>();

  constructor(
    readonly baseUrl = portalConfig.apiBaseUrl,
    private readonly request: typeof fetch = browserFetch,
  ) {}

  setSession(session: DemoSession | undefined): void {
    this.#csrfToken = session?.csrfToken;
    if (session === undefined) this.#idempotencyKeys.clear();
  }

  idempotencyKey(action: string): string {
    const existing = this.#idempotencyKeys.get(action);
    if (existing !== undefined) return existing;
    const created = `portal-${opaqueId()}`;
    this.#idempotencyKeys.set(action, created);
    return created;
  }

  completeAction(action: string): void {
    this.#idempotencyKeys.delete(action);
  }

  async createSession(persona: DemoPersona): Promise<DemoSession> {
    const session = await this.#json<DemoSession>(publicApiRoutes.session, {
      method: 'POST',
      body: JSON.stringify({ persona }),
    });
    this.setSession(session);
    return session;
  }

  async currentSession(): Promise<DemoSession> {
    const session = await this.#json<DemoSession>(publicApiRoutes.session);
    this.setSession(session);
    return session;
  }

  async logout(): Promise<void> {
    await this.#json<undefined>(publicApiRoutes.sessionLogout, { method: 'POST' });
    this.setSession(undefined);
  }

  createCase(input: CreateCaseRequest, action = 'create-case'): Promise<{ caseId: string }> {
    return this.#command(publicApiRoutes.cases, action, input, 'POST');
  }

  async uploadDocument(
    caseId: string,
    input: Readonly<{ file: File; documentType: string; side: string }>,
    action: string,
  ): Promise<UploadDocumentResult> {
    const form = new FormData();
    form.set('file', input.file);
    form.set('documentType', input.documentType);
    form.set('side', input.side);
    return this.#command(publicApiRoutes.caseDocuments(caseId), action, form, 'POST');
  }

  startCase(caseId: string): Promise<CaseSummary> {
    return this.#command(publicApiRoutes.caseStart(caseId), `start:${caseId}`, undefined, 'POST');
  }

  getCase(caseId: string): Promise<CaseSummary> {
    return this.#json(publicApiRoutes.case(caseId));
  }

  getEvents(caseId: string, cursor?: string): Promise<CaseEventsPage> {
    const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`;
    return this.#json(`${publicApiRoutes.caseEvents(caseId)}${query}`);
  }

  submitInformation(caseId: string, input: SubmitInformationRequest): Promise<CaseSummary> {
    return this.#command(publicApiRoutes.caseInformation(caseId), `information:${input.requestId}`, input, 'POST');
  }

  listReviews(cursor?: string): Promise<ReviewPage> {
    const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`;
    return this.#json(`${publicApiRoutes.reviews}${query}`);
  }

  getReview(reviewId: string): Promise<ReviewQueueItem> {
    return this.#json(publicApiRoutes.review(reviewId));
  }

  decideReview(reviewId: string, input: ReviewDecisionRequest): Promise<CaseSummary> {
    return this.#command(publicApiRoutes.reviewDecision(reviewId), `review:${reviewId}`, input, 'POST');
  }

  getMetrics(): Promise<MetricsSummary> {
    return this.#json(publicApiRoutes.metricsSummary);
  }

  async #command<Output>(path: string, action: string, body: unknown, method: 'POST'): Promise<Output> {
    const output = await this.#json<Output>(path, {
      method,
      headers: { 'Idempotency-Key': this.idempotencyKey(action) },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    this.completeAction(action);
    return output;
  }

  async #json<Output>(path: string, init: RequestInit = {}): Promise<Output> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Correlation-Id', `portal-${opaqueId()}`);
    if (init.body !== undefined && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (init.method !== undefined && init.method !== 'GET' && this.#csrfToken !== undefined) {
      headers.set('X-CSRF-Token', this.#csrfToken);
    }
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      let safe: PublicError | undefined;
      try {
        safe = (await response.json()) as PublicError;
      } catch {
        safe = undefined;
      }
      throw new ApiClientError(
        safe?.code ?? 'REQUEST_FAILED',
        safe?.message ?? 'The request could not be completed',
        safe?.correlationId ?? response.headers.get('X-Correlation-Id') ?? 'not-available',
        response.status,
      );
    }
    if (response.status === 204) return undefined as Output;
    return (await response.json()) as Output;
  }
}
