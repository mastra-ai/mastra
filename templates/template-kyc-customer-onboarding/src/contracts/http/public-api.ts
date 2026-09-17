import type { ApplicationCorrections, ApplicationData } from '../../domain/application.js';
import type { KycCaseStatus } from '../../domain/case.js';

export const publicSchemaVersion = '1.0' as const;
export const metricsSchemaVersion = '1.1' as const;

export const publicApiRoutes = Object.freeze({
  session: '/api/v1/demo/session',
  sessionLogout: '/api/v1/demo/session/logout',
  cases: '/api/v1/kyc/cases',
  caseDocuments: (caseId: string) => `/api/v1/kyc/cases/${caseId}/documents`,
  caseStart: (caseId: string) => `/api/v1/kyc/cases/${caseId}/start`,
  case: (caseId: string) => `/api/v1/kyc/cases/${caseId}`,
  caseEvents: (caseId: string) => `/api/v1/kyc/cases/${caseId}/events`,
  caseInformation: (caseId: string) => `/api/v1/kyc/cases/${caseId}/information`,
  reviews: '/api/v1/reviews',
  review: (reviewId: string) => `/api/v1/reviews/${reviewId}`,
  reviewDecision: (reviewId: string) => `/api/v1/reviews/${reviewId}/decision`,
  customerResponseWebhook: '/api/v1/webhooks/customer-response',
  complianceDecisionWebhook: '/api/v1/webhooks/compliance-decision',
  metricsSummary: '/api/v1/metrics/summary',
  metricsProviders: '/api/v1/metrics/providers',
  metricsEvals: '/api/v1/metrics/evals',
});

export type PublicError = Readonly<{
  code: string;
  message: string;
  correlationId: string;
  details?: Readonly<Record<string, unknown>> | undefined;
}>;

export type DemoPersona = 'applicant' | 'reviewer' | 'senior-reviewer';

export type DemoSession = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  persona: DemoPersona;
  csrfToken: string;
  expiresAt: string;
}>;

export type CreateCaseRequest = Readonly<{ application: ApplicationData }>;

export type CreateCaseResult = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  caseId: string;
  status: KycCaseStatus;
}>;

export type CaseSummary = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  caseId: string;
  status: KycCaseStatus;
  workflowStatus: 'NOT_STARTED' | 'RUNNING' | 'SUSPENDED' | 'COMPLETED';
  documentReadiness: Readonly<{
    storedDocumentCount: number;
    canStart: boolean;
  }>;
  pendingAction:
    | Readonly<{
        type: 'MISSING_INFORMATION';
        requestId: string;
        requestedItems: readonly string[];
        safeMessage: string;
        expiresAt: string;
      }>
    | Readonly<{
        type: 'COMPLIANCE_REVIEW';
        reviewId: string;
        level: 'INITIAL' | 'SENIOR';
        expiresAt: string;
      }>
    | null;
  updatedAt: string;
}>;

export type UploadDocumentResult = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  caseId: string;
  documentId: string;
  status: KycCaseStatus;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  pageCount: number | null;
}>;

export type CaseEventView = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  eventId: string;
  caseId: string;
  status: KycCaseStatus;
  eventType: 'CASE_CREATED' | 'CASE_STATUS_TRANSITIONED';
  reasonCode: string;
  occurredAt: string;
  caseVersion: number;
}>;

export type CaseEventsPage = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  events: readonly CaseEventView[];
  nextCursor: string | null;
  terminal: boolean;
}>;

export type SubmitInformationRequest = Readonly<{
  requestId: string;
  responseOption:
    | 'IDENTITY_DOCUMENT'
    | 'IDENTITY_DOCUMENT_BACK'
    | 'PROOF_OF_ADDRESS'
    | 'CORRECTED_APPLICATION'
    | 'READABLE_DOCUMENT';
  applicationCorrections?: ApplicationCorrections | undefined;
  documentIds: readonly string[];
}>;

export type ReviewQueueItem = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  reviewId: string;
  caseId: string;
  level: 'INITIAL' | 'SENIOR';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskRoute: 'AUTO_REVIEW' | 'REJECT_RECOMMENDED' | 'ESCALATE_RECOMMENDED' | 'INSUFFICIENT_INFORMATION';
  reasonCodes: readonly string[];
  allowedDecisions: readonly Readonly<{
    decision: 'APPROVE' | 'REJECT' | 'ESCALATE';
    reasonCode: 'REVIEW_APPROVED' | 'REVIEW_REJECTED' | 'REVIEW_ESCALATED';
  }>[];
  expiresAt: string;
  createdAt: string;
}>;

export type ReviewPage = Readonly<{
  schemaVersion: typeof publicSchemaVersion;
  reviews: readonly ReviewQueueItem[];
  nextCursor: string | null;
}>;

export type ReviewDecisionRequest = Readonly<{
  decision: 'APPROVE' | 'REJECT' | 'ESCALATE';
  reasonCode: string;
  safeNote?: string | undefined;
  feedback?:
    | Readonly<{
        extractionUseful: boolean | null;
        screeningUseful: boolean | null;
        riskUseful: boolean | null;
        evidenceUseful: boolean | null;
        falsePositiveEscalation?: boolean | null | undefined;
        curatedForDataset?: boolean | undefined;
        note?: string | undefined;
      }>
    | undefined;
}>;

export type MetricValue = number | 'not_available';
export type MetricsObservationWindow = Readonly<{ from: string; to: string; timezone: 'UTC' }>;

export type MetricsSummary = Readonly<{
  schemaVersion: typeof metricsSchemaVersion;
  observationWindow: MetricsObservationWindow;
  sampleCount: number;
  denominator: number;
  finalStatusCounts: Readonly<{
    active: number;
    rejected: number;
    escalated: number;
    provisioningFailed: number;
  }>;
  rates: Readonly<{
    approval: MetricValue;
    rejection: MetricValue;
    escalation: MetricValue;
    missingInformation: MetricValue;
  }>;
  latencyMs: Readonly<{
    endToEnd: Readonly<{ sampleCount: number; p50: MetricValue; p95: MetricValue }>;
    steps: readonly Readonly<{
      step: string;
      sampleCount: number;
      p50: MetricValue;
      p95: MetricValue;
    }>[];
  }>;
  dimensions: Readonly<{
    policies: readonly Readonly<{ policyVersion: string; sampleCount: number }>[];
    jurisdictions: readonly Readonly<{ jurisdiction: string; sampleCount: number }>[];
  }>;
  review: Readonly<{
    sampleCount: number;
    turnaroundMs: Readonly<{ p50: MetricValue; p95: MetricValue }>;
    feedback: readonly Readonly<{
      category: 'extraction' | 'screening' | 'risk' | 'evidence';
      useful: number;
      incorrect: number;
      notAnswered: number;
    }>[];
    falsePositiveEscalation: Readonly<{
      sampleCount: number;
      denominator: number;
      rate: MetricValue;
    }>;
  }>;
  projectionLag: Readonly<{ pendingEvents: number; oldestPendingAt: string | null }>;
}>;

export type ProviderMetrics = Readonly<{
  schemaVersion: typeof metricsSchemaVersion;
  observationWindow: MetricsObservationWindow;
  sampleCount: number;
  providers: readonly Readonly<{
    providerId: string;
    sampleCount: number;
    outcomes: Readonly<{ success: number; timeout: number; retry: number; error: number }>;
    rates: Readonly<{ success: MetricValue; timeout: MetricValue; retry: MetricValue }>;
    latencyMs: Readonly<{ sampleCount: number; p50: MetricValue; p95: MetricValue }>;
    usage: Readonly<{
      denominator: number;
      inputUnits: number;
      outputUnits: number;
      costUsd: MetricValue;
      costPerCaseUsd: Readonly<{ p50: MetricValue; p95: MetricValue }>;
      priceVersions: readonly string[];
    }>;
  }>[];
  projectionLag: Readonly<{ pendingEvents: number; oldestPendingAt: string | null }>;
}>;

export type EvalMetrics = Readonly<{
  schemaVersion: typeof metricsSchemaVersion;
  observationWindow: MetricsObservationWindow;
  sampleCount: number;
  evals: readonly Readonly<{
    evalId: string;
    candidateId: string;
    datasetVersion: string;
    manifestDigest: string;
    sampleCount: number;
    passedCount: number;
    score: Readonly<{ p50: MetricValue; p95: MetricValue }>;
  }>[];
  projectionLag: Readonly<{ pendingEvents: number; oldestPendingAt: string | null }>;
}>;
