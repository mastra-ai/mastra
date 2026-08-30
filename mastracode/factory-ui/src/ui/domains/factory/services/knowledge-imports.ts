import { requestJson } from './request';

export type KnowledgeImportKind = 'static' | 'agentic';
export type KnowledgeImportTrigger = 'cron' | 'webhook' | 'programmatic';
export type KnowledgeImportStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'interrupted';

export interface KnowledgeImportRun {
  id: string;
  importerId: string;
  binding: string;
  source?: string;
  scope?: string;
  importKind: KnowledgeImportKind;
  triggerKind: KnowledgeImportTrigger;
  status: KnowledgeImportStatus;
  error?: string;
  transcriptThreadId?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface KnowledgeImporterSummary {
  id: string;
  importKind: KnowledgeImportKind;
  triggers: KnowledgeImportTrigger[];
  bindings: Array<{ source: string; scope: string }>;
  lastRun?: KnowledgeImportRun;
}

export interface KnowledgeImportersPayload {
  importers: KnowledgeImporterSummary[];
}

export interface KnowledgeImportRunsPayload {
  runs: KnowledgeImportRun[];
  nextCursor?: string;
}

export interface KnowledgeImportRunDetailPayload {
  run: KnowledgeImportRun;
  activity: Array<{ id: string; action: string; targetType: string; createdAt: string }>;
  transcript?: {
    threadId: string;
    available: boolean;
    messages: Array<{ id: string; role: string; content: unknown; createdAt: string }>;
  };
}

export interface KnowledgeImportFilters {
  binding?: string;
  status?: KnowledgeImportStatus;
  trigger?: KnowledgeImportTrigger;
  from?: string;
  to?: string;
}

function importsBase(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/knowledge/importers`;
}

export function fetchKnowledgeImporters(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<KnowledgeImportersPayload> {
  return requestJson<KnowledgeImportersPayload>(importsBase(baseUrl, factoryProjectId), { signal });
}

export function fetchKnowledgeImportRuns(
  baseUrl: string,
  factoryProjectId: string,
  importerId: string,
  filters: KnowledgeImportFilters,
  cursor?: string,
  signal?: AbortSignal,
): Promise<KnowledgeImportRunsPayload> {
  const query = new URLSearchParams();
  if (filters.binding) query.set('binding', filters.binding);
  if (filters.status) query.set('status', filters.status);
  if (filters.trigger) query.set('trigger', filters.trigger);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (cursor) query.set('cursor', cursor);
  const suffix = query.size > 0 ? `?${query}` : '';
  return requestJson<KnowledgeImportRunsPayload>(
    `${importsBase(baseUrl, factoryProjectId)}/${encodeURIComponent(importerId)}/runs${suffix}`,
    { signal },
  );
}

export function fetchKnowledgeImportRun(
  baseUrl: string,
  factoryProjectId: string,
  importerId: string,
  runId: string,
  signal?: AbortSignal,
): Promise<KnowledgeImportRunDetailPayload> {
  return requestJson<KnowledgeImportRunDetailPayload>(
    `${importsBase(baseUrl, factoryProjectId)}/${encodeURIComponent(importerId)}/runs/${encodeURIComponent(runId)}`,
    { signal },
  );
}
