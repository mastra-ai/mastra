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
  options: Record<string, KnowledgeImporterOptionValue>;
  /** Optimistic concurrency token; 0 means no saved row. */
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  source: 'saved' | 'env';
}

export type KnowledgeImporterConnectionStatus = 'ok' | 'needs_reauth' | 'error';

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
  /** `label` is the plain-English reason, e.g. "Private Slack channels are never imported". */
  skipped?: { reason: string; label?: string; count: number }[];
  error?: string | null;
  /** Where the run's items land; present on dry runs. */
  preview?: KnowledgeImporterRunPreview;
}

/**
 * Where the sink placed an item: the shared org-wide area, or a container of its own.
 * Placement only — importers don't read provider ACLs, so this is never an access claim.
 */
export type KnowledgeImporterPlacement = 'org-wide' | 'container';

export interface KnowledgeImporterPreviewDestination {
  /** The scope/container identity the items land in. */
  scope: string;
  /** Human name, e.g. "Linear · Engineering". */
  label: string;
  placement: KnowledgeImporterPlacement;
  nodes: number;
  records: number;
  /** Up to five page titles. */
  sampleTitles: string[];
}

export interface KnowledgeImporterRunPreview {
  destinations: KnowledgeImporterPreviewDestination[];
  /** Reserved. The preview lists every destination today, so this is always false. */
  truncated: boolean;
}

/** One importer for one linked Platform connection. */
export interface KnowledgeImporterSummary {
  /** `<importerId>:<connectionId>`; identifies this entry in every per-importer route. */
  key: string;
  importerId: string;
  /** Provider name, e.g. "Linear". */
  label: string;
  /** One plain sentence: what this importer brings in and where it lands. */
  description?: string;
  settings: KnowledgeImporterSettings;
  optionsSchema: KnowledgeImporterOptionField[];
  /** What the scheduler will actually use; null when disabled. */
  effectiveSchedule: string | null;
  connection: {
    id: string;
    status: KnowledgeImporterConnectionStatus;
    message?: string;
    /** The linked account/workspace label, for display. */
    accountName?: string;
  };
  lastRun: KnowledgeImporterRunSummary | null;
}

export interface ListKnowledgeImportersResponse {
  summaries: KnowledgeImporterSummary[];
  /** Whether the caller may save settings or start runs. Read-only callers get 403 `forbidden` on writes. */
  canWrite: boolean;
  /** The project's Platform Connect settings page (an `https://` URL), or null when the server has none configured. */
  connectUrl: string | null;
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
  options: Record<string, KnowledgeImporterOptionValue>;
  expectedVersion: number;
}

export interface StartKnowledgeImporterRunResponse {
  runId: string;
}

export interface ListKnowledgeImporterRunsResponse {
  runs: KnowledgeImporterRunSummary[];
}

/** `debug` lines are plumbing (one per provider request); UIs hide them by default. */
export type KnowledgeImporterRunEventLevel = 'debug' | 'info' | 'warn' | 'error';

/** One plain-English line of a run's log. Messages never carry tokens, emails or private names. */
export interface KnowledgeImporterRunEvent {
  /** 1-based and increasing within the run; gaps follow an `omitted` marker. */
  seq: number;
  at: string;
  level: KnowledgeImporterRunEventLevel;
  type:
    | 'started'
    | 'fetch'
    | 'item'
    | 'skipped'
    | 'placed'
    | 'retry'
    | 'rate_limited'
    | 'error'
    | 'omitted'
    | 'finished';
  message: string;
  data?: Record<string, unknown>;
}

export interface ListKnowledgeImporterRunEventsResponse {
  /** Events after the requested `after` seq, oldest first (one page). */
  events: KnowledgeImporterRunEvent[];
  /** The run has finished and this page reached its last event; stop polling. */
  done: boolean;
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

  #path(key: string, suffix: string) {
    return `/knowledge-importers/${encodeURIComponent(key)}/${suffix}`;
  }

  /** One entry per linked connection, with its effective settings, connection state and last run. */
  list(): Promise<ListKnowledgeImportersResponse> {
    return this.request('/knowledge-importers');
  }

  /** Platform connections linked for the entry's provider. */
  connections(key: string): Promise<ListKnowledgeImporterConnectionsResponse> {
    return this.request(this.#path(key, 'connections'));
  }

  /** Saves settings; rejects with 409 when `expectedVersion` is stale. */
  saveSettings(key: string, params: SaveKnowledgeImporterSettingsParams): Promise<KnowledgeImporterSummary> {
    return this.request(this.#path(key, 'settings'), { method: 'PUT', body: params, retries: 0 });
  }

  /** Drops the saved row so the importer falls back to env configuration. */
  resetSettings(key: string): Promise<KnowledgeImporterSummary> {
    return this.request(this.#path(key, 'settings'), { method: 'DELETE', retries: 0 });
  }

  /** Starts a dry run, optionally previewing unsaved settings. Writes nothing to Knowledge. */
  dryRun(key: string, settings?: Partial<KnowledgeImporterSettings>): Promise<StartKnowledgeImporterRunResponse> {
    return this.request(this.#path(key, 'dry-run'), {
      method: 'POST',
      body: settings ? { settings } : {},
      retries: 0,
    });
  }

  /** Starts a real import with the effective settings. */
  run(key: string): Promise<StartKnowledgeImporterRunResponse> {
    return this.request(this.#path(key, 'run'), { method: 'POST', body: {}, retries: 0 });
  }

  getRun(runId: string): Promise<KnowledgeImporterRunSummary> {
    return this.request(`/knowledge-importers/runs/${encodeURIComponent(runId)}`);
  }

  /** Newest-first run history for one entry. */
  runs(key: string, limit = 20): Promise<ListKnowledgeImporterRunsResponse> {
    return this.request(`${this.#path(key, 'runs')}?limit=${limit}`);
  }

  /** A run's log after `after` (a seq; omit for the start). Poll with the last seq until `done`. */
  listRunEvents(key: string, runId: string, after?: number): Promise<ListKnowledgeImporterRunEventsResponse> {
    const query = after === undefined ? '' : `?after=${after}`;
    return this.request(`${this.#path(key, `runs/${encodeURIComponent(runId)}/events`)}${query}`);
  }
}
