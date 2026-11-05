/** Bounded collection response. */
export type Page<T> = {
  /** Records returned in the current bounded page. */
  items: T[];
  /** Maximum number of records returned by one page. */
  limit: number;
  /** Zero-based collection offset. */
  offset: number;
};
/** Current local session metadata without the bootstrap secret. */
export type Session = {
  /** Authenticated local operator identifier. */
  operator: string;
  /** UTC expiration timestamp. */
  expiresAt: string;
  /** Session-bound mutation token; send as X-CSRF-Token. */
  csrfToken: string;
};
/** Finite upstream scan budgets. */
export type Limits = {
  /** Maximum upstream requests allowed; reservations are shared and not refunded. */
  maxRequests: number;
  /** Maximum elapsed duration in seconds. */
  maxDurationSeconds: number;
  /** Maximum bytes accepted from one upstream response. */
  maxResponseBytes: number;
  /** Maximum simultaneous upstream requests. */
  maxConcurrency: number;
};
/** Persisted operator-owned policy and its current revision. */
export type Policy = {
  /** Stable identifier of this record. */
  id: string;
  /** Human-readable label shown in the console. */
  name: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
  /** Unique HTTP methods explicitly allowed by the operator. */
  permittedMethods: string[];
  /** Finite scan budgets, bounded by the target policy. */
  scanLimits: Limits;
  /** Explicit evidence-retention selection; required for non-lab targets. */
  retention?: {
    /** Number of days to retain evidence, from 1 through 365. */
    evidenceDays: number;
    /** Operator reference recording the retention decision. */
    approvedBy: string;
  };
};
/** Persisted authorized target and its policy binding. */
export type Target = {
  /** Stable identifier of this record. */
  id: string;
  /** Operator that owns this record; derived from the authenticated session. */
  owner: string;
  /** Human-readable label shown in the console. */
  name: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
  /** Canonical HTTP(S) entry URL inside the approved origin and path scope. */
  entryUrl: string;
  /** Exact canonical origins the gateway may contact. */
  approvedOrigins: string[];
  /** Allowed canonical path prefixes, matched at segment boundaries. */
  allowedPaths: string[];
  /** Denied path prefixes; exclusions override allowed paths. */
  excludedPaths: string[];
  /** Unique HTTP methods explicitly allowed by the operator. */
  permittedMethods: string[];
  /** Deployment classification; lab alone does not grant private-network access. */
  environment: string;
  /** Reference to the operator authorization for this target. */
  authorizationEvidenceRef: string;
  /** Policy that bounds the target scope and budgets. */
  policyId: string;
  /** Exact policy revision authorized for this operation. */
  policyRevision: number;
  /** Persisted discovery schedule, preserved when reconfirming route rules. */
  schedule: { enabled: boolean; timezone: string; cron?: string };
  /** Finite scan budgets, bounded by the target policy. */
  scanLimits: Limits;
  /** Target-owned profile identifiers, maintained by profile registration/removal. */
  authProfileIds: string[];
  application?: { kind: 'rest_api'; version: 1; discoveryModes: ('openapi' | 'observed_json')[]; openApiUrl?: string };
  authenticationDrivers?: {
    kind: 'api_key_header';
    version: 1;
    profileId: string;
    secretRef: string;
    credentialOrigins: string[];
    headerName: string;
    accessCheckPath: string;
    principalJsonPointer?: string;
    refresh: 'reregister';
  }[];
  routeAccessRules?: RouteAccessRule[];
};
export type RouteAccessRule = (
  | { source: 'operator'; operatorRevision: number }
  | { source: 'openapi_suggestion'; operatorRevision?: never }
) & {
  version: 1;
  method: 'GET';
  pathTemplate: string;
  audience: 'public' | 'user' | 'admin';
  objectPolicy?: 'owner' | 'shared';
  expectedUnauthorizedStatus: number[];
};
export type BolaAssessment = {
  id: string;
  revision: number;
  targetId: string;
  scanId: string;
  state: string;
  outcome: string | null;
  reason: string | null;
  verificationCleanup?: 'NOT_STARTED' | 'PENDING' | 'DEBT' | 'COMPLETE';
  evidenceAvailability?: 'available' | 'expired' | 'unknown';
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  usedRequests: number;
  usedTokens: number;
  candidates: { id: string; routeTemplate: string; prerequisite: string; evidenceIds: string[] }[];
  selected: { id: string; routeTemplate: string; prerequisite: string; evidenceIds: string[] } | null;
  selection: { rationaleCode: string; hypothesis: string; confidence: string; limitations: string[] } | null;
  proof: {
    ownerStatus: number | null;
    alternateStatus: number | null;
    bodyMatches: boolean | null;
    requestCount: number;
    completed: boolean;
    verifierCredentialFree: boolean;
    firewallVerified: boolean;
    directFixtureDenied: boolean | null;
    gatewayCredentialInjections: number;
    verifiedGatewayPeers: number;
  } | null;
  findingId: string | null;
  modelEvents: { role: string; modelId: string; usageTokens: number | null }[];
};
export type BolaFinding = {
  id: string;
  assessmentId: string;
  targetId: string;
  categoryId: 'bola';
  checkerId: 'bola_rest_read';
  routeTemplate: string;
  ownerStatus: number;
  alternateStatus: number;
  samePrivateResponse: true;
  gatewayRequests: number;
  selection: { rationaleCode: string; hypothesis: string; confidence: string; limitations: string[] } | null;
  createdAt: string;
};
/** Public identity metadata; private credential values are excluded. */
export type Profile = {
  /** Stable identifier of this record. */
  id: string;
  /** Human-readable label shown in the console. */
  name: string;
  /** Application role represented by this identity or observation. */
  role: string;
  /** Profile transport discriminator: public, bearer, or header. */
  kind: string;
  /** Optional UTC expiration of the identity profile. */
  expiresAt?: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
  /** Credential version bound to this operation; changes invalidate prior authorization. */
  credentialRevision: number;
  /** Current identity readiness information; never a vulnerability verdict. */
  identity: {
    /** Current state from the enclosing API projection. */
    status: string;
    /** Sanitized machine-readable reason for the recorded state. */
    reason: string;
    /** UTC timestamp of the last identity check, or null before one is recorded. */
    checkedAt: string | null;
  };
};
/** Exact profile/credential and target/policy revisions required by the API. */
export type Binding = {
  /** Exact target revision authorized for this operation. */
  targetRevision: number;
  /** Exact policy revision authorized for this operation. */
  policyRevision: number;
  /** Identity profile used for this observation or operation. */
  profileId: string;
  /** Exact profile metadata revision bound to this operation. */
  profileRevision: number;
  /** Credential version bound to this operation; changes invalidate prior authorization. */
  credentialRevision: number;
};
/** Persisted discovery lifecycle, budgets, identity results, and cleanup outcome. */
export type Scan = {
  /** Stable identifier of this record. */
  id: string;
  /** Authorized target to which this record belongs. */
  targetId: string;
  /** Persisted lifecycle state; read the reason and result before interpreting it. */
  state: string;
  /** Sanitized machine-readable reason for the recorded state. */
  reason: string;
  /** Whether this result is incomplete or contains withheld observations. */
  partial: boolean;
  /** Whether owned-resource cleanup is pending, complete, or in debt. */
  cleanup: string;
  /** Current shared-budget snapshot. */
  budget: {
    /** Remaining shared request budget; null means consumption is unknown. */
    remainingRequests: number | null;
    /** Remaining shared byte budget; null means consumption is unknown. */
    remainingBytes: number | null;
    /** Whether budget exhaustion or uncertain consumption prevents dispatch. */
    exhausted: boolean;
    /** Sanitized machine-readable reason for the recorded state. */
    reason: string | null;
  };
  /** Initial shared budgets recorded at admission. */
  budgetInitial?: {
    /** Initial request allowance. */
    requests: number;
    /** Initial shared response-byte allowance. */
    bytes: number;
  };
  /** Discovery and identity results for each participating profile and role. */
  roles: {
    /** Identity profile used for this observation or operation. */
    profileId: string;
    /** Application role represented by this identity or observation. */
    role: string;
    /** Current identity readiness information; never a vulnerability verdict. */
    identity: string;
    /** Whether this result is incomplete or contains withheld observations. */
    partial: boolean;
    /** Bounded output-minimization and rejection counters. */
    counters: {
      /** Number of candidate records parsed. */
      parsed: number;
      /** Number of observations withheld by sanitization. */
      withheld: number;
    };
  }[];
  /** UTC timestamp when the record was created. */
  createdAt: string;
  /** UTC timestamp of the latest persisted transition. */
  updatedAt: string;
  /** Discovery-mode projection of the stored admission request. */
  request: {
    /** HTTP crawler or sandboxed Chromium discovery mode. */
    mode: string;
  };
};
/** Retained sanitized discovery observation; never sufficient for confirmation. */
export type Evidence = {
  /** Stable identifier of this record. */
  id: string;
  /** UTC timestamp of the source observation. */
  observedAt: string;
  /** Normalized admissible facts; raw response content is excluded. */
  observation: {
    /** Canonical HTTP(S) origin of the discovery observation. */
    origin: string;
    /** Canonical scoped path without query values or fragments. */
    path: string;
    /** HTTP method observed or explicitly allowed. */
    method: string;
    /** Application role represented by this identity or observation. */
    role: string;
    /** Trusted upstream HTTP status code, absent for advertised surfaces. */
    status?: number;
  };
};
/** Persisted investigation and its shared conservative budget ledger. */
export type Investigation = {
  /** Stable identifier of this record. */
  id: string;
  /** Persisted lifecycle state; read the reason and result before interpreting it. */
  state: string;
  /** UTC timestamp when the record was created. */
  createdAt: string;
  /** UTC timestamp of the latest persisted transition. */
  updatedAt: string;
  /** Immutable target, policy, profile, credential, and scan revision snapshot. */
  lineage: {
    /** Authorized target to which this record belongs. */
    targetId: string;
    /** Discovery scan supplying the source inventory. */
    scanId: string;
  };
  /** Explicit finite budgets recorded for this operation. */
  limits: {
    /** Maximum upstream requests allowed; reservations are shared and not refunded. */
    maxRequests: number;
    /** Selected token allowance; runtime shared reservations remain authoritative. */
    maxTokens: number;
    /** Maximum elapsed duration in seconds. */
    maxDurationSeconds: number;
  };
  /** Conservatively reserved upstream requests, never refunded after dispatch. */
  usedRequests: number;
  /** Conservative shared model-token reservations, not actual provider billing. */
  usedTokens: number;
  /** Sanitized machine-readable reason for the recorded state. */
  reason: string | null;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
};
/** Persisted proposal bound to source evidence, resources, and reviewed rules. */
export type Hypothesis = {
  /** Stable identifier of this record. */
  id: string;
  /** Investigation that owns this record and its shared budget. */
  investigationId: string;
  /** Planning provenance: local playbook, novel proposal, or current CVE. */
  origin: string;
  /** Discriminator selecting the vulnerability category and its typed facts. */
  category: string;
  /** Allowlisted capability identifier; must match the selected category. */
  toolId: string;
  /** Passive or active classification; SSRF is the active capability. */
  risk: string;
  /** Expected policy behavior; it cannot override deterministic confirmation. */
  expectedBehavior: string;
  /** Evidence identifiers retained by this record. */
  evidenceIds: string[];
  /** Pinned local security references grounding the hypothesis. */
  referenceIds: string[];
  /** Maximum upstream requests allowed; reservations are shared and not refunded. */
  maxRequests: number;
  /** Persisted lifecycle state; read the reason and result before interpreting it. */
  state: string;
  /** Sanitized machine-readable reason for the recorded state. */
  reason: string | null;
};
/** Confirmed result linked to retained proof and source evidence. */
export type Finding = {
  /** Stable identifier of this record. */
  id: string;
  /** Investigation that owns this record and its shared budget. */
  investigationId: string;
  /** Grounded hypothesis that this record evaluates. */
  hypothesisId: string;
  /** Durable job associated with this operation. */
  jobId: string;
  /** Retained verification-proof record supporting the finding. */
  proofId: string;
  /** Evidence identifiers retained by this record. */
  evidenceIds: string[];
  /** UTC timestamp when the record was created. */
  createdAt: string;
  /** Current evidence availability and its dated retention state. */
  availability?: {
    /** Whether proof is available, expired, or its availability is unknown. */
    state: 'available' | 'expired' | 'unknown';
    /** UTC timestamp of the evidence-availability transition, or null when unknown. */
    at: string | null;
  };
};
/** Saved job result and retained-proof availability. */
export type Evaluation = {
  /** Stable identifier of this record. */
  id: string;
  /** Investigation that owns this record and its shared budget. */
  investigationId: string;
  /** Grounded hypothesis that this record evaluates. */
  hypothesisId: string;
  /** Durable job associated with this operation. */
  jobId: string;
  /** UTC timestamp when the record was created. */
  createdAt: string;
  /** Trusted origin of this observation or proof. */
  source: string;
  /** Discriminator selecting the vulnerability category and its typed facts. */
  category: string;
  /** Whether the bounded verification completed with admissible observations. */
  completed: boolean;
  /** Whether source evidence contains the relevant test surface. */
  surfacePresent: boolean;
  /** Whether all required owned resources and bindings are available. */
  prerequisitesReady: boolean;
  /** Whether all participating identities passed the trusted check. */
  identityValid: boolean;
  /** Whether the exact operation fits current authorization. */
  scopeApproved: boolean;
  /** Actual upstream contacts observed by the gateway. */
  requestCount: number;
  /** Bounded normalized evidence identifiers and kinds supporting this proof. */
  evidence: {
    /** Stable identifier of this record. */
    id: string;
    /** Verification evidence kind matched against the playbook requirements. */
    kind: string;
  }[];
  /** Whether any proof was withheld; withheld proof cannot confirm a finding. */
  withheld: boolean;
  /** Current evidence availability and its dated retention state. */
  availability?: {
    /** Whether proof is available, expired, or its availability is unknown. */
    state: 'available' | 'expired' | 'unknown';
    /** UTC timestamp of the evidence-availability transition, or null when unknown. */
    at: string | null;
  };
  /** UTC expiration timestamp. */
  expiresAt?: string | null;
};
/** Sanitized advisory inbox projection. */
export type Advisory = {
  /** Stable identifier of this record. */
  id: string;
  /** Material upstream content revision; recordRevision supplies the local ETag. */
  revision: number;
  /** Local concurrency revision, independent of upstream material revision. */
  recordRevision: number;
  /** Upstream modification timestamp. */
  providerModifiedAt: string;
  /** UTC timestamp of the last successful import. */
  retrievedAt: string;
  /** Operator-selected local triage state. */
  triageStatus: string;
  /** Publisher lifecycle state, separate from local triage. */
  upstreamStatus: string;
  /** Bounded imported advisory detail. */
  detail: {
    /** Upstream advisory or reference title, treated as untrusted data. */
    title: string;
    /** Optional upstream-generated summary and its provenance. */
    summary?: {
      /** Bounded source text; never an execution instruction. */
      text: string;
    } | null;
  };
};
/** Revision-bound single-use authorization for an exact active probe. */
export type Approval = {
  /** Stable identifier of this record. */
  id: string;
  /** Investigation that owns this record and its shared budget. */
  investigationId: string;
  /** Grounded hypothesis that this record evaluates. */
  hypothesisId: string;
  /** Durable job associated with this operation. */
  jobId: string;
  /** Allowlisted capability identifier; must match the selected category. */
  toolId: string;
  /** Exact owned callback bound to an active approval. */
  callback: string;
  /** Maximum upstream requests allowed; reservations are shared and not refunded. */
  maxRequests: number;
  /** UTC expiration timestamp. */
  expiresAt: string;
  /** Approval state or operator decision, as selected by this contract. */
  decision: string;
  /** Current optimistic-concurrency revision; stale writes are rejected. */
  revision: number;
  /** UTC timestamp when the record was created. */
  createdAt: string;
  /** UTC decision timestamp, or null while undecided. */
  decidedAt: string | null;
  /** Immutable target, policy, profile, credential, and scan revision snapshot. */
  lineage: {
    /** Authorized target to which this record belongs. */
    targetId: string;
    /** Exact target revision authorized for this operation. */
    targetRevision: number;
    /** Policy that bounds the target scope and budgets. */
    policyId: string;
    /** Exact policy revision authorized for this operation. */
    policyRevision: number;
    /** Discovery scan supplying the source inventory. */
    scanId: string;
    /** Exact profile and credential revisions participating in this operation. */
    profiles: {
      /** Identity profile used for this observation or operation. */
      profileId: string;
      /** Exact profile metadata revision bound to this operation. */
      profileRevision: number;
      /** Credential version bound to this operation; changes invalidate prior authorization. */
      credentialRevision: number;
    }[];
  };
};
/** Redacted model role metadata for the console. */
export type AgentData = {
  /** Records returned in the current bounded page. */
  items: {
    /** Stable identifier of this record. */
    id: string;
    /** Human-readable label shown in the console. */
    name: string;
    /** Registered worker role and redacted task metadata. */
    task: string;
    /** Configured model identifier for this registered agent role. */
    modelId: string;
    /** Whether required model configuration is available. */
    configured: boolean;
  }[];
  /** Bounded persisted execution history. */
  runs: {
    /** Stable identifier of this record. */
    id: string;
    /** Investigation that owns this record and its shared budget. */
    investigationId: string;
    /** Agent role that made the model call: nemo, sherlock, dupin, or watson. */
    role: string;
    /** Model identifier recorded for this execution. */
    modelId: string;
    /** Provider-reported usage, or null when unavailable. */
    usageTokens: number | null;
    /** UTC time of the recorded event. */
    occurredAt: string;
  }[];
  /** Maximum number of records returned by one page. */
  limit: number;
  /** Zero-based collection offset. */
  offset: number;
};

let csrfToken = '';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

/** Send a same-origin API request with session and CSRF handling and translate typed failures. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && init.method !== 'GET') headers.set('X-CSRF-Token', csrfToken);
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError('CONNECTION_UNAVAILABLE', 0);
  }
  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body && 'code' in body && typeof body.code === 'string') code = body.code;
    } catch {}
    if (
      response.status === 403 &&
      code === 'LOCAL_SESSION_REQUIRED' &&
      !(path === '/api/session' && init?.method === 'POST')
    ) {
      csrfToken = '';
      window.dispatchEvent(new Event('scanner-session-expired'));
    }
    throw new ApiError(code, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function readSession() {
  const session = await request<Session>('/api/session');
  csrfToken = session.csrfToken;
  return session;
}

export async function login(secret: string) {
  const session = await request<Session>('/api/session', { method: 'POST', body: JSON.stringify({ secret }) });
  csrfToken = session.csrfToken;
  return session;
}

export async function logout() {
  await request<void>('/api/session', { method: 'DELETE' });
  csrfToken = '';
}

export const get = <T>(path: string) => request<T>(path);
/** Serialize a JSON mutation and attach If-Match when an expected revision is supplied. */
export const send = <T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body: unknown, revision?: number) =>
  request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: revision === undefined ? undefined : { 'If-Match': `"${revision}"` },
  });
