import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import { App } from '../src/App';
import { KycApiClient } from '../src/api/client.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const session = (persona: 'applicant' | 'reviewer' | 'senior-reviewer') => ({
  schemaVersion: '1.0',
  persona,
  csrfToken: 'c'.repeat(32),
  expiresAt: '2026-08-22T12:00:00.000Z',
});
const caseSummary = (status = 'DRAFT') => ({
  schemaVersion: '1.0',
  caseId: 'case-opaque-1',
  status,
  workflowStatus: status === 'DRAFT' ? 'NOT_STARTED' : 'COMPLETED',
  documentReadiness: {
    storedDocumentCount: status === 'DRAFT' ? 0 : 1,
    canStart: false,
  },
  pendingAction: null,
  updatedAt: '2026-08-21T12:00:00.000Z',
});
const metricsSummary = (sampleCount: number) => ({
  schemaVersion: '1.1',
  observationWindow: {
    from: '2026-08-21T12:00:00.000Z',
    to: '2026-08-22T12:00:00.000Z',
    timezone: 'UTC',
  },
  sampleCount,
  denominator: sampleCount,
  finalStatusCounts: { active: 0, rejected: 0, escalated: 0, provisioningFailed: 0 },
  rates: {
    approval: 'not_available',
    rejection: 'not_available',
    escalation: 'not_available',
    missingInformation: 'not_available',
  },
  latencyMs: {
    endToEnd: { sampleCount: 0, p50: 'not_available', p95: 'not_available' },
    steps: [],
  },
  dimensions: { policies: [], jurisdictions: [] },
  review: {
    sampleCount: 0,
    turnaroundMs: { p50: 'not_available', p95: 'not_available' },
    feedback: [
      { category: 'extraction', useful: 0, incorrect: 0, notAnswered: 0 },
      { category: 'screening', useful: 0, incorrect: 0, notAnswered: 0 },
      { category: 'risk', useful: 0, incorrect: 0, notAnswered: 0 },
      { category: 'evidence', useful: 0, incorrect: 0, notAnswered: 0 },
    ],
    falsePositiveEscalation: {
      sampleCount: 0,
      denominator: 0,
      rate: 'not_available',
    },
  },
  projectionLag: { pendingEvents: 0, oldestPendingAt: null },
});

class FakeEventSource {
  static mode: 'open' | 'event-terminal' | 'errors' = 'open';
  readonly withCredentials = true;
  readonly url: string;
  closed = false;
  readonly #listeners = new Map<string, ((event: Event) => void)[]>();
  constructor(url: string | URL) {
    this.url = String(url);
    queueMicrotask(() => {
      this.#emit('open', new Event('open'));
      if (FakeEventSource.mode === 'event-terminal') {
        this.#emit(
          'case-event',
          new MessageEvent('case-event', {
            data: JSON.stringify({
              schemaVersion: '1.0',
              eventId: 'event-opaque-1',
              caseId: 'case-opaque-2',
              status: 'MISSING_INFORMATION',
              eventType: 'CASE_STATUS_TRANSITIONED',
              reasonCode: 'DOCUMENT_UNREADABLE',
              occurredAt: '2026-08-21T12:00:00.000Z',
              caseVersion: 2,
            }),
          }),
        );
        this.#emit('terminal', new MessageEvent('terminal', { data: '{"terminal":true}' }));
      } else if (FakeEventSource.mode === 'errors') {
        this.#emit('error', new Event('error'));
        this.#emit('error', new Event('error'));
        this.#emit('error', new Event('error'));
      }
    });
  }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (listener === null) return;
    const callback = typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event);
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), callback]);
  }
  close() {
    this.closed = true;
  }
  #emit(type: string, event: Event) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const mount = (client: KycApiClient) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  root.render(<App client={client} />);
  return { host, root };
};

describe('companion portal in Chromium', () => {
  let mounted: ReturnType<typeof mount> | undefined;

  afterEach(() => {
    mounted?.root.unmount();
    mounted?.host.remove();
    mounted = undefined;
    window.location.hash = '';
    FakeEventSource.mode = 'open';
    vi.unstubAllGlobals();
  });

  it('creates an applicant case with labeled identity and address fields', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const request = vi.fn<typeof fetch>((url, init = {}) => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session' && init.method === undefined) {
        return Promise.resolve(
          json({ code: 'UNAUTHENTICATED', message: 'Session required', correlationId: 'c-1' }, 401),
        );
      }
      if (path === '/api/v1/demo/session' && init.method === 'POST')
        return Promise.resolve(json(session('applicant'), 201));
      if (path === '/api/v1/kyc/cases' && init.method === 'POST') {
        return Promise.resolve(json({ schemaVersion: '1.0', caseId: 'case-opaque-1', status: 'DRAFT' }, 201));
      }
      if (path === '/api/v1/kyc/cases/case-opaque-1') return Promise.resolve(json(caseSummary()));
      return Promise.reject(new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await page.getByRole('button', { name: 'Applicant journey' }).click();
    await expect.element(page.getByRole('heading', { name: 'Tell us about the applicant' })).toBeVisible();
    await page.getByLabelText('Full legal name').fill('Synthetic Applicant');
    await page.getByLabelText('Date of birth').fill('1990-01-01');
    await page.getByLabelText('Email').fill('synthetic@example.test');
    await page.getByLabelText('Phone').fill('+15550100001');
    await page.getByLabelText('Address line').fill('100 Example Avenue');
    await page.getByLabelText('City').fill('Sample City');
    await page.getByLabelText('State or region').fill('NY');
    await page.getByLabelText('Postal code').fill('10001');
    await page.getByRole('button', { name: 'Create secure case' }).click();

    await expect.element(page.getByRole('heading', { name: 'Identity verification' })).toBeVisible();
    await expect.element(page.getByText('Case case-opaque-1')).toBeVisible();
    await expect.element(page.getByText(/Live updates|Connecting/u)).toBeVisible();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('restores persisted document readiness after an applicant reload', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    window.location.hash = '#/cases/case-opaque-1';
    const readySummary = {
      ...caseSummary(),
      status: 'EXTRACTING',
      documentReadiness: { storedDocumentCount: 1, canStart: true },
    };
    const request = vi.fn<typeof fetch>((url, init = {}) => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session') return Promise.resolve(json(session('applicant')));
      if (path === '/api/v1/kyc/cases/case-opaque-1' && init.method === undefined)
        return Promise.resolve(json(readySummary));
      if (path.endsWith('/start') && init.method === 'POST')
        return Promise.resolve(json({ ...readySummary, workflowStatus: 'RUNNING' }, 202));
      return Promise.reject(new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await expect.element(page.getByText('1 document validated and stored.')).toBeVisible();
    const start = page.getByRole('button', { name: 'Start verification' });
    await expect.element(start).toBeEnabled();
    await start.click();
    expect(request).toHaveBeenCalledWith(
      'http://api.example.test/api/v1/kyc/cases/case-opaque-1/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a redacted reviewer queue and routes an escalation to senior review', async () => {
    const review = {
      schemaVersion: '1.0',
      reviewId: 'review-opaque-1',
      caseId: 'case-opaque-1',
      level: 'INITIAL',
      riskLevel: 'MEDIUM',
      riskRoute: 'AUTO_REVIEW',
      reasonCodes: ['RISK_MEDIUM'],
      allowedDecisions: [
        { decision: 'APPROVE', reasonCode: 'REVIEW_APPROVED' },
        { decision: 'REJECT', reasonCode: 'REVIEW_REJECTED' },
        { decision: 'ESCALATE', reasonCode: 'REVIEW_ESCALATED' },
      ],
      expiresAt: '2026-08-22T12:00:00.000Z',
      createdAt: '2026-08-21T12:00:00.000Z',
    };
    const metrics = metricsSummary(1);
    const request = vi.fn<typeof fetch>((url, init = {}) => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session' && init.method === undefined) {
        return Promise.resolve(
          json({ code: 'UNAUTHENTICATED', message: 'Session required', correlationId: 'c-2' }, 401),
        );
      }
      if (path === '/api/v1/demo/session' && init.method === 'POST')
        return Promise.resolve(json(session('reviewer'), 201));
      if (path === '/api/v1/reviews')
        return Promise.resolve(json({ schemaVersion: '1.0', reviews: [review], nextCursor: null }));
      if (path === '/api/v1/metrics/summary') return Promise.resolve(json(metrics));
      if (path === '/api/v1/reviews/review-opaque-1' && init.method === undefined) return Promise.resolve(json(review));
      if (path.endsWith('/decision') && init.method === 'POST')
        return Promise.resolve(
          json({
            ...caseSummary('COMPLIANCE_REVIEW'),
            pendingAction: {
              type: 'COMPLIANCE_REVIEW',
              reviewId: 'review-senior-1',
              level: 'SENIOR',
              expiresAt: '2026-08-22T12:00:00.000Z',
            },
          }),
        );
      return Promise.reject(new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await page.getByRole('button', { name: 'Reviewer workspace' }).click();
    await expect.element(page.getByRole('heading', { name: 'Compliance review queue' })).toBeVisible();
    await page.getByRole('button', { name: /Initial review/u }).click();
    await expect.element(page.getByRole('heading', { name: 'Review policy outcome' })).toBeVisible();
    await page.getByLabelText('escalate').click();
    await page.getByLabelText('Extraction').selectOptions('useful');
    await page.getByLabelText('Risk').selectOptions('incorrect');
    await page.getByLabelText('False-positive escalation').selectOptions('useful');
    await page.getByLabelText(/Curate these structured labels/u).click();
    await page.getByRole('button', { name: 'Record decision' }).click();

    const decisionCall = request.mock.calls.find(([url, init]) => {
      const path = new URL(urlOf(url)).pathname;
      return path.endsWith('/decision') && init?.method === 'POST';
    });
    expect(decisionCall).toBeDefined();
    const decisionBody = decisionCall?.[1]?.body;
    if (typeof decisionBody !== 'string') throw new Error('Expected a JSON decision request');
    expect(JSON.parse(decisionBody)).toMatchObject({
      decision: 'ESCALATE',
      reasonCode: 'REVIEW_ESCALATED',
      feedback: {
        extractionUseful: true,
        screeningUseful: null,
        riskUseful: false,
        evidenceUseful: null,
        falsePositiveEscalation: true,
        curatedForDataset: true,
      },
    });

    await expect.element(page.getByRole('heading', { name: 'senior review required' })).toBeVisible();
    await expect
      .element(page.getByLabelText('Demonstration notice'))
      .toHaveTextContent('not production authentication');
  });

  it('renders and submits a missing-information round trip with a replacement upload', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    FakeEventSource.mode = 'event-terminal';
    window.location.hash = '#/cases/case-opaque-2';
    let resolved = false;
    const missing = {
      schemaVersion: '1.0',
      caseId: 'case-opaque-2',
      status: 'MISSING_INFORMATION',
      workflowStatus: 'SUSPENDED',
      documentReadiness: { storedDocumentCount: 1, canStart: false },
      pendingAction: {
        type: 'MISSING_INFORMATION',
        requestId: 'request-opaque-1',
        requestedItems: ['READABLE_DOCUMENT'],
        safeMessage: 'A readable identity document is required.',
        expiresAt: '2026-08-22T12:00:00.000Z',
      },
      updatedAt: '2026-08-21T12:00:00.000Z',
    };
    const request = vi.fn<typeof fetch>((url, init = {}) => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session') return Promise.resolve(json(session('applicant')));
      if (path === '/api/v1/kyc/cases/case-opaque-2' && init.method === undefined) {
        return Promise.resolve(
          json(resolved ? { ...missing, status: 'COMPLIANCE_REVIEW', pendingAction: null } : missing),
        );
      }
      if (path.endsWith('/documents') && init.method === 'POST') {
        return Promise.resolve(
          json(
            {
              schemaVersion: '1.0',
              caseId: 'case-opaque-2',
              documentId: 'document-opaque-1',
              status: 'MISSING_INFORMATION',
              mimeType: 'application/pdf',
              sizeBytes: 32,
              pageCount: 1,
            },
            201,
          ),
        );
      }
      if (path.endsWith('/information') && init.method === 'POST') {
        resolved = true;
        return Promise.resolve(json({ ...missing, status: 'COMPLIANCE_REVIEW', pendingAction: null }));
      }
      return Promise.reject(new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await expect.element(page.getByRole('heading', { name: 'Additional information needed' })).toBeVisible();
    await expect.element(page.getByText('readable document')).toBeVisible();
    await page.getByLabelText('PDF, JPEG, or PNG').upload(new File([], 'empty.pdf', { type: 'application/pdf' }));
    await page.getByRole('button', { name: 'Upload document' }).click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('Choose a PDF');

    await page
      .getByLabelText('PDF, JPEG, or PNG')
      .upload(new File(['%PDF-synthetic'], 'replacement.pdf', { type: 'application/pdf' }));
    await page.getByRole('button', { name: 'Upload document' }).click();
    await expect.element(page.getByText('1 document validated and stored.')).toBeVisible();
    await page.getByRole('button', { name: 'Submit latest upload' }).click();
    await expect.element(page.getByText('compliance review', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Timeline complete')).toBeVisible();
    await expect.element(page.getByText('document unreadable')).toBeVisible();
  });

  it('submits only the requested field corrections for a field-level pending action', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    window.location.hash = '#/cases/case-opaque-fields';
    let resolved = false;
    const missing = {
      schemaVersion: '1.0',
      caseId: 'case-opaque-fields',
      status: 'MISSING_INFORMATION',
      workflowStatus: 'SUSPENDED',
      documentReadiness: { storedDocumentCount: 1, canStart: false },
      pendingAction: {
        type: 'MISSING_INFORMATION',
        requestId: 'request-opaque-fields',
        requestedItems: ['FULL_NAME', 'DATE_OF_BIRTH', 'DOCUMENT_NUMBER', 'EXPIRATION_DATE'],
        safeMessage: 'Visible identity fields are required.',
        expiresAt: '2026-08-22T12:00:00.000Z',
      },
      updatedAt: '2026-08-21T12:00:00.000Z',
    };
    const request = vi.fn<typeof fetch>((url, init = {}) => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session') return Promise.resolve(json(session('applicant')));
      if (path === '/api/v1/kyc/cases/case-opaque-fields' && init.method === undefined) {
        return Promise.resolve(
          json(resolved ? { ...missing, status: 'COMPLIANCE_REVIEW', pendingAction: null } : missing),
        );
      }
      if (path.endsWith('/documents') && init.method === 'POST') {
        return Promise.resolve(
          json(
            {
              schemaVersion: '1.0',
              caseId: 'case-opaque-fields',
              documentId: 'document-opaque-fields',
              status: 'MISSING_INFORMATION',
              mimeType: 'application/pdf',
              sizeBytes: 32,
              pageCount: 1,
            },
            201,
          ),
        );
      }
      if (path.endsWith('/information') && init.method === 'POST') {
        resolved = true;
        return Promise.resolve(json({ ...missing, status: 'COMPLIANCE_REVIEW', pendingAction: null }));
      }
      return Promise.reject(new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await expect.element(page.getByLabelText('Response type')).toHaveValue('CORRECTED_APPLICATION');
    await expect.element(page.getByText('Readable replacement')).not.toBeInTheDocument();
    await page.getByLabelText('Corrected full name').fill('Synthetic Public Applicant');
    await page.getByLabelText('Corrected date of birth').fill('1952-10-07');
    await page.getByLabelText('Corrected document number').fill('PUBLIC-Q7747-DEMO');
    await page.getByLabelText('Corrected expiration date').fill('2030-01-01');
    await page
      .getByLabelText('PDF, JPEG, or PNG')
      .upload(new File(['%PDF-synthetic'], 'replacement.pdf', { type: 'application/pdf' }));
    await page.getByRole('button', { name: 'Upload document' }).click();
    await page.getByRole('button', { name: 'Submit latest upload' }).click();

    const informationCall = request.mock.calls.find(([url, init]) => {
      const path = new URL(urlOf(url)).pathname;
      return path.endsWith('/information') && init?.method === 'POST';
    });
    const body = informationCall?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON information response');
    expect(JSON.parse(body)).toMatchObject({
      responseOption: 'CORRECTED_APPLICATION',
      applicationCorrections: {
        fullName: 'Synthetic Public Applicant',
        dateOfBirth: '1952-10-07',
        documentNumber: 'PUBLIC-Q7747-DEMO',
        expirationDate: '2030-01-01',
      },
    });
  });

  it('opens a senior review from an opaque hash route and records a rejection note', async () => {
    window.location.hash = '#/reviews/review-senior-1';
    const seniorReview = {
      schemaVersion: '1.0',
      reviewId: 'review-senior-1',
      caseId: 'case-opaque-3',
      level: 'SENIOR',
      riskLevel: 'HIGH',
      riskRoute: 'ESCALATE_RECOMMENDED',
      reasonCodes: ['REVIEW_ESCALATED'],
      allowedDecisions: [
        { decision: 'APPROVE', reasonCode: 'REVIEW_APPROVED' },
        { decision: 'REJECT', reasonCode: 'REVIEW_REJECTED' },
      ],
      expiresAt: '2026-08-22T12:00:00.000Z',
      createdAt: '2026-08-21T12:00:00.000Z',
    };
    const metrics = metricsSummary(0);
    const request = vi.fn<typeof fetch>((url, init = {}) => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session') return Promise.resolve(json(session('senior-reviewer')));
      if (path === '/api/v1/reviews')
        return Promise.resolve(json({ schemaVersion: '1.0', reviews: [seniorReview], nextCursor: null }));
      if (path === '/api/v1/metrics/summary') return Promise.resolve(json(metrics));
      if (path === '/api/v1/reviews/review-senior-1' && init.method === undefined)
        return Promise.resolve(json(seniorReview));
      if (path.endsWith('/decision') && init.method === 'POST') return Promise.resolve(json(caseSummary('REJECTED')));
      return Promise.reject(new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await expect.element(page.getByRole('heading', { name: 'Senior review queue' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Review policy outcome' })).toBeVisible();
    await expect.element(page.getByLabelText('approve')).toBeVisible();
    await expect.element(page.getByLabelText('reject')).toBeVisible();
    await expect.element(page.getByLabelText('escalate')).not.toBeInTheDocument();
    await page.getByLabelText('reject').click();
    await page.getByLabelText(/Safe note/u).fill('Policy mismatch confirmed');
    await page.getByRole('button', { name: 'Record decision' }).click();
    await expect.element(page.getByRole('heading', { name: 'rejected' })).toBeVisible();
  });

  it('falls back to redacted polling after three SSE errors', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    FakeEventSource.mode = 'errors';
    window.location.hash = '#/cases/case-polling-1';
    const request = vi.fn<typeof fetch>(url => {
      const path = new URL(urlOf(url)).pathname;
      if (path === '/api/v1/demo/session') return Promise.resolve(json(session('applicant')));
      if (path === '/api/v1/kyc/cases/case-polling-1') {
        return Promise.resolve(json({ ...caseSummary('COMPLIANCE_REVIEW'), caseId: 'case-polling-1' }));
      }
      if (path === '/api/v1/kyc/cases/case-polling-1/events') {
        return Promise.resolve(
          json({
            schemaVersion: '1.0',
            events: [
              {
                schemaVersion: '1.0',
                eventId: 'event-polling-1',
                caseId: 'case-polling-1',
                status: 'COMPLIANCE_REVIEW',
                eventType: 'CASE_STATUS_TRANSITIONED',
                reasonCode: 'RISK_POLICY_AUTO_REVIEW',
                occurredAt: '2026-08-21T12:00:00.000Z',
                caseVersion: 3,
              },
            ],
            nextCursor: 'event-polling-1',
            terminal: true,
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected request GET ${path}`));
    });
    mounted = mount(new KycApiClient('http://api.example.test', request));

    await expect.element(page.getByText('Timeline complete')).toBeVisible();
    await expect.element(page.getByText('risk policy auto review')).toBeVisible();
    expect(request).toHaveBeenCalledWith(
      'http://api.example.test/api/v1/kyc/cases/case-polling-1/events',
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
