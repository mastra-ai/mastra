export type Page<T> = { items: T[]; limit: number; offset: number };
export type Session = { operator: string; expiresAt: string; csrfToken: string };
export type Limits = {
  maxRequests: number;
  maxDurationSeconds: number;
  maxResponseBytes: number;
  maxConcurrency: number;
};
export type Policy = {
  id: string;
  name: string;
  revision: number;
  permittedMethods: string[];
  scanLimits: Limits;
  retention?: { evidenceDays: number; approvedBy: string };
};
export type Target = {
  id: string;
  owner: string;
  name: string;
  revision: number;
  entryUrl: string;
  approvedOrigins: string[];
  allowedPaths: string[];
  excludedPaths: string[];
  permittedMethods: string[];
  environment: string;
  authorizationEvidenceRef: string;
  policyId: string;
  policyRevision: number;
  scanLimits: Limits;
  authProfileIds: string[];
};
export type Profile = {
  id: string;
  name: string;
  role: string;
  kind: string;
  expiresAt?: string;
  revision: number;
  credentialRevision: number;
  identity: { status: string; reason: string; checkedAt: string | null };
};
export type Binding = {
  targetRevision: number;
  policyRevision: number;
  profileId: string;
  profileRevision: number;
  credentialRevision: number;
};
export type Scan = {
  id: string;
  targetId: string;
  state: string;
  reason: string;
  partial: boolean;
  cleanup: string;
  budget: {
    remainingRequests: number | null;
    remainingBytes: number | null;
    exhausted: boolean;
    reason: string | null;
  };
  budgetInitial?: { requests: number; bytes: number };
  roles: {
    profileId: string;
    role: string;
    identity: string;
    partial: boolean;
    counters: { parsed: number; withheld: number };
  }[];
  createdAt: string;
  updatedAt: string;
  request: { mode: string };
};
export type Evidence = {
  id: string;
  observedAt: string;
  observation: { origin: string; path: string; method: string; role: string; status?: number };
};
export type Investigation = {
  id: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  lineage: { targetId: string; scanId: string };
  limits: { maxRequests: number; maxTokens: number; maxDurationSeconds: number };
  usedRequests: number;
  usedTokens: number;
  reason: string | null;
  revision: number;
};
export type Hypothesis = {
  id: string;
  investigationId: string;
  origin: string;
  category: string;
  toolId: string;
  risk: string;
  expectedBehavior: string;
  evidenceIds: string[];
  referenceIds: string[];
  maxRequests: number;
  state: string;
  reason: string | null;
};
export type Finding = {
  id: string;
  investigationId: string;
  hypothesisId: string;
  jobId: string;
  proofId: string;
  evidenceIds: string[];
  createdAt: string;
  availability?: { state: 'available' | 'expired' | 'unknown'; at: string | null };
};
export type Evaluation = {
  id: string;
  investigationId: string;
  hypothesisId: string;
  jobId: string;
  createdAt: string;
  source: string;
  category: string;
  completed: boolean;
  surfacePresent: boolean;
  prerequisitesReady: boolean;
  identityValid: boolean;
  scopeApproved: boolean;
  requestCount: number;
  evidence: { id: string; kind: string }[];
  withheld: boolean;
  availability?: { state: 'available' | 'expired' | 'unknown'; at: string | null };
  expiresAt?: string | null;
};
export type Advisory = {
  id: string;
  revision: number;
  recordRevision: number;
  providerModifiedAt: string;
  retrievedAt: string;
  triageStatus: string;
  upstreamStatus: string;
  detail: { title: string; summary?: { text: string } | null };
};
export type Approval = {
  id: string;
  investigationId: string;
  hypothesisId: string;
  jobId: string;
  toolId: string;
  callback: string;
  maxRequests: number;
  expiresAt: string;
  decision: string;
  revision: number;
  createdAt: string;
  decidedAt: string | null;
  lineage: {
    targetId: string;
    targetRevision: number;
    policyId: string;
    policyRevision: number;
    scanId: string;
    profiles: { profileId: string; profileRevision: number; credentialRevision: number }[];
  };
};
export type AgentData = {
  items: { id: string; name: string; task: string; modelId: string; configured: boolean }[];
  runs: {
    id: string;
    investigationId: string;
    role: string;
    modelId: string;
    usageTokens: number | null;
    occurredAt: string;
  }[];
  limit: number;
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
export const send = <T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body: unknown, revision?: number) =>
  request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: revision === undefined ? undefined : { 'If-Match': `"${revision}"` },
  });
