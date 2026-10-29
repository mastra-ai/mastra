import type { ClientOptions } from '../types';
import { BaseResource } from './base';

export type KnowledgeImporterOptionValue = string[] | string | number | boolean;

export interface KnowledgeImporterOptionField {
  key: string;
  label: string;
  type: 'list' | 'string' | 'number' | 'boolean';
  help?: string;
  envVar?: string;
}

export interface KnowledgeImporterSettings {
  importerId: string;
  enabled: boolean;
  /** 5-field cron; null falls back to the env/default schedule. */
  schedule: string | null;
  /** null picks the single linked connection automatically. */
  connectionId: string | null;
  options: Record<string, KnowledgeImporterOptionValue>;
  /** Optimistic concurrency token; 0 means no saved row. */
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  source: 'saved' | 'env';
}

export type KnowledgeImporterConnectionStatus = 'ok' | 'none' | 'ambiguous' | 'needs_reauth' | 'error';

export interface KnowledgeImporterRunSummary {
  id: string;
  importerId: string;
  kind: 'dry-run' | 'run' | 'scheduled' | 'webhook';
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  counts?: {
    nodesCreated?: number;
    nodesUpdated?: number;
    nodesRemoved?: number;
    recordsWritten?: number;
    skipped?: number;
  };
  skipped?: { reason: string; count: number }[];
  error?: string | null;
}

export interface KnowledgeImporterSummary {
  importerId: string;
  label: string;
  settings: KnowledgeImporterSettings;
  optionsSchema: KnowledgeImporterOptionField[];
  /** What the scheduler will actually use; null when disabled. */
  effectiveSchedule: string | null;
  connection: { status: KnowledgeImporterConnectionStatus; connectionId: string | null; message?: string };
  lastRun: KnowledgeImporterRunSummary | null;
}

export interface ListKnowledgeImportersResponse {
  summaries: KnowledgeImporterSummary[];
}

export interface KnowledgeImporterConnection {
  id: string;
  provider: string;
  accountName: string;
  status: string;
}

export interface ListKnowledgeImporterConnectionsResponse {
  connections: KnowledgeImporterConnection[];
}

export interface SaveKnowledgeImporterSettingsParams {
  enabled: boolean;
  schedule: string | null;
  connectionId: string | null;
  options: Record<string, KnowledgeImporterOptionValue>;
  expectedVersion: number;
}

export interface StartKnowledgeImporterRunResponse {
  runId: string;
}

export interface ListKnowledgeImporterRunsResponse {
  runs: KnowledgeImporterRunSummary[];
}

/**
 * Settings, dry runs and run history for the knowledge importers deployment.
 *
 * The routes are custom server routes, which mount at their own path rather than under the
 * client's `apiPrefix`, so this resource requests them unprefixed.
 */
export class KnowledgeImporters extends BaseResource {
  constructor(options: ClientOptions) {
    super({ ...options, apiPrefix: '' });
  }

  #path(importerId: string, suffix: string) {
    return `/knowledge-importers/${encodeURIComponent(importerId)}/${suffix}`;
  }

  /** Every importer with its effective settings, connection state and last run. */
  list(): Promise<ListKnowledgeImportersResponse> {
    return this.request('/knowledge-importers');
  }

  /** Platform connections linked for the importer's provider. */
  connections(importerId: string): Promise<ListKnowledgeImporterConnectionsResponse> {
    return this.request(this.#path(importerId, 'connections'));
  }

  /** Saves settings; rejects with 409 when `expectedVersion` is stale. */
  saveSettings(importerId: string, params: SaveKnowledgeImporterSettingsParams): Promise<KnowledgeImporterSummary> {
    return this.request(this.#path(importerId, 'settings'), { method: 'PUT', body: params, retries: 0 });
  }

  /** Drops the saved row so the importer falls back to env configuration. */
  resetSettings(importerId: string): Promise<KnowledgeImporterSummary> {
    return this.request(this.#path(importerId, 'settings'), { method: 'DELETE', retries: 0 });
  }

  /** Starts a dry run, optionally previewing unsaved settings. Writes nothing to Knowledge. */
  dryRun(
    importerId: string,
    settings?: Partial<KnowledgeImporterSettings>,
  ): Promise<StartKnowledgeImporterRunResponse> {
    return this.request(this.#path(importerId, 'dry-run'), {
      method: 'POST',
      body: settings ? { settings } : {},
      retries: 0,
    });
  }

  /** Starts a real import with the effective settings. */
  run(importerId: string): Promise<StartKnowledgeImporterRunResponse> {
    return this.request(this.#path(importerId, 'run'), { method: 'POST', body: {}, retries: 0 });
  }

  getRun(runId: string): Promise<KnowledgeImporterRunSummary> {
    return this.request(`/knowledge-importers/runs/${encodeURIComponent(runId)}`);
  }

  /** Newest-first run history for one importer. */
  runs(importerId: string, limit = 20): Promise<ListKnowledgeImporterRunsResponse> {
    return this.request(`${this.#path(importerId, 'runs')}?limit=${limit}`);
  }
}
