import { MastraConnectError } from '@mastra/connect';
import type { ConnectClient } from '@mastra/connect';

import type { IssueReconcileSummary } from '../../issue-reconciler.js';
import { logPlatformInfo, logPlatformWarn } from '../logging.js';

/** `GET /v2/integrations/linear/migration-status`. */
export interface LinearMigrationStatusResponse {
  pending: Array<{ linearWorkspaceId: string; linearWorkspaceName: string; urlKey: string | null }>;
  migrated: Array<{ linearWorkspaceId: string; connectionId: string; linkedToProject: boolean }>;
}

/** `POST /v2/integrations/linear/migrate`. */
export interface LinearMigrateResponse {
  connections: Array<{
    connectionId: string;
    linearWorkspaceId: string;
    linearWorkspaceName: string;
    urlKey: string | null;
    linearAppUserId: string | null;
    migrated: boolean;
  }>;
  skipped: Array<{ linearWorkspaceId: string; reason: string }>;
  /** Workspaces the platform could not migrate this time; they stay on legacy tokens until a retry. */
  failed?: Array<{ linearWorkspaceId: string }>;
}

export type LinearMigrationTrigger = 'boot' | 'schedule' | 'admin';

export interface LinearMigrationRunResult {
  /** Workspaces sent to the migrate endpoint. */
  requested: string[];
  /** Workspaces now served by a Connect connection linked to the project. */
  connections: LinearMigrateResponse['connections'];
  skipped: LinearMigrateResponse['skipped'];
  /** Migrated connections this project had never had, linked to it now. */
  linked: string[];
}

/** What status and diagnostics report about the migration. */
export interface LinearMigrationState {
  /** Workspaces still on the platform's legacy tokens. */
  required: boolean;
  pending: string[];
  /**
   * Workspaces already migrated whose connection someone detached from this project (or
   * that couldn't be linked), and that nothing linked serves. They are never migrated again.
   */
  notLinked: string[];
  skipped: LinearMigrateResponse['skipped'];
  lastRunAt: string | null;
  lastError: { message: string; at: string } | null;
}

const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 60 * 60_000;

/**
 * Moves the org's legacy Platform Linear workspaces onto Mastra Connect. Each
 * run reads the platform's migration status and migrates only the workspaces
 * that have not been migrated yet, so each legacy workspace becomes exactly one
 * Connect connection. A workspace that is already migrated is never sent
 * again. Its connection is linked to this project only if the project has
 * never had it (it was migrated from another project); one the project had and
 * no longer lists was detached on purpose and is left alone, across restarts.
 */
export class PlatformLinearMigration {
  readonly #connect: () => ConnectClient;
  readonly #coveredWorkspaceIds: () => Promise<ReadonlySet<string>>;
  readonly #linkMigrated: (connectionIds: ReadonlySet<string>) => Promise<{ linked: string[] }>;
  readonly #onMigrated: () => void;
  #state: LinearMigrationState = {
    required: false,
    pending: [],
    notLinked: [],
    skipped: [],
    lastRunAt: null,
    lastError: null,
  };
  #failures = 0;
  #statusKnown = false;
  /** Migrated connections, by id, as the platform last reported them. */
  #migratedConnections = new Map<string, string>();
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<LinearMigrationRunResult> | undefined;

  constructor(options: {
    connect: () => ConnectClient;
    /** Workspaces a project-linked Connect connection already serves; never migrated again. */
    coveredWorkspaceIds: () => Promise<ReadonlySet<string>>;
    /**
     * Links these migrated connections unless the project has had them before,
     * and remembers the ones it has; returns those it linked now.
     */
    linkMigrated: (connectionIds: ReadonlySet<string>) => Promise<{ linked: string[] }>;
    /** Called after a run that linked at least one connection to the project. */
    onMigrated: () => void;
  }) {
    this.#connect = options.connect;
    this.#coveredWorkspaceIds = options.coveredWorkspaceIds;
    this.#linkMigrated = options.linkMigrated;
    this.#onMigrated = options.onMigrated;
  }

  get state(): LinearMigrationState {
    return this.#state;
  }

  /** True once the platform has confirmed no workspace is left on legacy tokens or unlinked. */
  get settled(): boolean {
    return this.#statusKnown && !this.#state.required;
  }

  /** The workspace a migrated connection serves, or null when it isn't one. */
  workspaceOfConnection(connectionId: string): string | null {
    return this.#migratedConnections.get(connectionId) ?? null;
  }

  /** Reads the platform's migration status and updates {@link state}. */
  async refreshStatus(): Promise<LinearMigrationState> {
    const { pending, notLinked } = await this.#needed();
    this.#state = { ...this.#state, required: pending.length > 0, pending, notLinked };
    this.#statusKnown = true;
    return this.#state;
  }

  /** Runs one migration. Concurrent callers share the run in flight. */
  run(trigger: LinearMigrationTrigger): Promise<LinearMigrationRunResult> {
    this.#inFlight ??= this.#run(trigger).finally(() => {
      this.#inFlight = undefined;
    });
    return this.#inFlight;
  }

  /**
   * The migration as an {@link IssueReconcileWorker} sweep, so it runs under
   * the worker's lease on one replica. A failure is counted, not thrown, and
   * schedules a retry with backoff through `retry`.
   */
  sweep(retry: () => void): () => Promise<IssueReconcileSummary> {
    return async () => {
      const summary: IssueReconcileSummary = {
        projects: 0,
        checked: 0,
        updated: 0,
        closed: 0,
        missing: 0,
        failed: 0,
        errors: [],
      };
      try {
        const result = await this.run('schedule');
        summary.checked = result.requested.length;
        summary.updated = result.connections.length;
        summary.missing = result.skipped.length;
      } catch (error) {
        summary.failed = 1;
        summary.errors.push({ projectId: 'linear-migration', error: errorMessage(error) });
        this.#scheduleRetry(retry);
      }
      return summary;
    };
  }

  stop(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = undefined;
  }

  async #run(trigger: LinearMigrationTrigger): Promise<LinearMigrationRunResult> {
    const at = new Date().toISOString();
    try {
      let needed = await this.#needed();
      const { pending } = needed;
      let response: LinearMigrateResponse & { alreadyMigrated?: true } = { connections: [], skipped: [] };
      if (pending.length > 0) {
        logPlatformInfo('Migrating Platform Linear workspaces to Mastra Connect', { trigger, workspaces: pending });
        response = await this.#migrate(pending);
        if (response.connections.length > 0 || response.alreadyMigrated) this.#onMigrated();
        // Read back what is left rather than trusting the response alone.
        needed = await this.#needed();
      }
      const { linked } = await this.#linkMigrated(needed.linkable);
      if (linked.length > 0) {
        logPlatformInfo('Linked migrated Linear connections to the Factory project', { trigger, linked });
        this.#onMigrated();
        needed = await this.#needed();
      }
      const left = needed;
      const state = {
        required: left.pending.length > 0,
        pending: left.pending,
        notLinked: left.notLinked,
        skipped: response.skipped,
        lastRunAt: at,
      };
      const failed = response.failed ?? [];
      if (failed.length > 0) {
        // The others moved; these are retried with backoff, like a failed call.
        this.#state = { ...state, lastError: this.#state.lastError };
        throw new Error(
          `Linear workspaces ${failed.map(workspace => workspace.linearWorkspaceId).join(', ')} could not be migrated`,
        );
      }
      this.#succeeded(state);
      if (response.skipped.length > 0) {
        logPlatformWarn('Platform Linear workspaces were not migrated', { trigger, skipped: response.skipped });
      }
      return { requested: pending, connections: response.connections, skipped: response.skipped, linked };
    } catch (error) {
      this.#failures += 1;
      this.#state = { ...this.#state, lastRunAt: at, lastError: { message: errorMessage(error), at } };
      logPlatformWarn('Platform Linear migration to Mastra Connect failed; it will be retried', {
        trigger,
        error: errorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Workspaces the platform still serves from legacy tokens (the only ones ever
   * sent to migrate); migrated workspaces nothing linked to this project serves;
   * and the migrated connections linking may consider: those already linked (so
   * they are remembered) and those whose workspace nothing else linked serves.
   */
  async #needed(): Promise<{ pending: string[]; notLinked: string[]; linkable: ReadonlySet<string> }> {
    const [status, covered] = await Promise.all([
      this.#connect().request<LinearMigrationStatusResponse>('GET', '/v2/integrations/linear/migration-status'),
      this.#coveredWorkspaceIds(),
    ]);
    const pending = new Set<string>();
    for (const workspace of status.pending) {
      // A workspace connected through Connect directly needs no import; importing would duplicate it.
      if (!covered.has(workspace.linearWorkspaceId)) pending.add(workspace.linearWorkspaceId);
    }
    this.#migratedConnections = new Map(
      status.migrated.map(workspace => [workspace.connectionId, workspace.linearWorkspaceId]),
    );
    const notLinked = new Set<string>();
    const linkable = new Set<string>();
    for (const workspace of status.migrated) {
      if (workspace.linkedToProject) {
        linkable.add(workspace.connectionId);
      } else if (!covered.has(workspace.linearWorkspaceId)) {
        notLinked.add(workspace.linearWorkspaceId);
        linkable.add(workspace.connectionId);
      }
    }
    return { pending: [...pending].sort(), notLinked: [...notLinked].sort(), linkable };
  }

  async #migrate(linearWorkspaceIds: string[]): Promise<LinearMigrateResponse & { alreadyMigrated?: true }> {
    try {
      return await this.#connect().request<LinearMigrateResponse>('POST', '/v2/integrations/linear/migrate', {
        body: { linearWorkspaceIds },
      });
    } catch (error) {
      // Another deployment migrated the workspace first: a success, not a failure.
      if (
        error instanceof MastraConnectError &&
        error.source === 'platform' &&
        error.problemCode === 'linear_workspace_migrated'
      ) {
        return { connections: [], skipped: [], alreadyMigrated: true };
      }
      throw error;
    }
  }

  #succeeded(state: Omit<LinearMigrationState, 'lastError'>): void {
    this.#failures = 0;
    this.#statusKnown = true;
    this.stop();
    this.#state = { ...state, lastError: null };
  }

  #scheduleRetry(retry: () => void): void {
    if (this.#retryTimer) return;
    const delayMs = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, this.#failures - 1));
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = undefined;
      retry();
    }, delayMs);
    this.#retryTimer.unref?.();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
