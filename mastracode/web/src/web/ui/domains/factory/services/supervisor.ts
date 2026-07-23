export interface FactorySupervisorSession {
  factoryProjectId: string;
  resourceId: string;
  sessionId: string;
  threadId: string;
}

export interface FactorySupervisorApproval {
  id: string;
  workItemId: string;
  transitionId: string;
  board: string;
  stage: string;
  expectedRevision: number;
  requestingRole: string | null;
  reason: string;
  summary: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'stale';
  resolvedBy: string | null;
  resolutionReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FactorySupervisorApprovalState {
  id: string;
  workItemId: string;
  board: string;
  stage: string;
  expectedRevision: number;
  requestingRole: string | null;
  workItemTitle: string | null;
  reason: string;
  summary: string | null;
  createdAt: string;
  ageSeconds: number;
}

export interface FactorySupervisorWorker {
  workItemId: string;
  workItemTitle: string | null;
  stage: string | null;
  role: string;
  bindingId: string;
  activity: 'running' | 'idle' | 'offline';
}

export interface FactorySupervisorState {
  factoryProjectId: string;
  totalItems: number;
  counts: {
    byBoard: Record<string, number>;
    byStage: Record<string, number>;
  };
  pendingApprovalCount: number;
  pendingApprovals: FactorySupervisorApprovalState[];
  workers: {
    running: number;
    idle: number;
    offline: number;
    bindings: FactorySupervisorWorker[];
  };
  snapshotAt: string;
}

export interface FactoryApprovalResolution {
  status: 'approved' | 'rejected' | 'stale';
  replayed: boolean;
  approval: FactorySupervisorApproval;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    credentials: 'include',
    ...init,
  });
  const body = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

function projectUrl(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}`;
}

export async function ensureFactorySupervisorSession(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactorySupervisorSession> {
  const body = await requestJson<{ session: FactorySupervisorSession }>(
    `${projectUrl(baseUrl, factoryProjectId)}/supervisor/session`,
    { method: 'POST' },
  );
  return body.session;
}

export async function getFactorySupervisorState(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactorySupervisorState> {
  const body = await requestJson<{ state: FactorySupervisorState }>(
    `${projectUrl(baseUrl, factoryProjectId)}/supervisor/state`,
  );
  return body.state;
}

export async function listFactorySupervisorApprovals(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactorySupervisorApproval[]> {
  const body = await requestJson<{ approvals: FactorySupervisorApproval[] }>(
    `${projectUrl(baseUrl, factoryProjectId)}/approvals?status=pending`,
  );
  return body.approvals;
}

export async function resolveFactorySupervisorApproval(
  baseUrl: string,
  factoryProjectId: string,
  approvalId: string,
  decision: 'approve' | 'reject',
): Promise<FactoryApprovalResolution> {
  const body = await requestJson<{ result: FactoryApprovalResolution }>(
    `${projectUrl(baseUrl, factoryProjectId)}/approvals/${encodeURIComponent(approvalId)}/resolve`,
    { method: 'POST', body: JSON.stringify({ decision }) },
  );
  return body.result;
}
