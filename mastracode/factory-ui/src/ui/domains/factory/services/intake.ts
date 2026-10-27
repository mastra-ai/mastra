/**
 * Browser-side helpers for the intake source configuration (Settings › Intake).
 *
 * The config is stored per org on the server. GitHub uses
 * `sourceIds` (connected source ids); Linear keeps `sourceIds`
 * (provider-owned source ids). `null` id lists mean
 * "nothing selected" — nothing syncs until the user picks entries.
 */

export interface IntakeSelection {
  enabled: boolean;
  /** Source ids to sync; `null` = nothing selected. */
  sourceIds: string[] | null;
  repositoryByLinearProject?: Record<string, string>;
}

/** Built-in providers always present, plus any custom integration ids the server returns. */
export type IntakeConfig = Record<string, IntakeSelection> & {
  github: IntakeSelection;
  gitlab: IntakeSelection;
  linear: IntakeSelection;
  jira: IntakeSelection;
  incidentio: IntakeSelection;
};

/**
 * The server keeps intake config as a dynamic map keyed by integration id and
 * only returns the integrations registered in the running deployment, so a key
 * is absent whenever that integration isn't connected. Fill the fixed shape the
 * UI relies on so reads like `config.github.enabled` never touch `undefined`.
 * An absent key means the integration is not registered in this deployment,
 * so every synthetic placeholder stays disabled. Registered integrations are
 * returned by the server with their effective defaults, and saving the fixed
 * shape back is safe because the server ignores disabled/unselected keys for
 * unregistered integrations. Other keys (custom integrations) pass through so
 * every save sends them back unchanged.
 */
function normalizeIntakeConfig(raw: Partial<Record<string, IntakeSelection>> | null | undefined): IntakeConfig {
  return {
    ...raw,
    github: raw?.github ?? { enabled: false, sourceIds: null },
    gitlab: raw?.gitlab ?? { enabled: false, sourceIds: null },
    linear: raw?.linear ?? { enabled: false, sourceIds: null },
    jira: raw?.jira ?? { enabled: false, sourceIds: null },
    incidentio: raw?.incidentio ?? { enabled: false, sourceIds: null },
  };
}

/** Enable sync and pick `id`; returns the same object when nothing changes. */
export function selectIntakeSource(selection: IntakeSelection, id: string): IntakeSelection {
  if (selection.sourceIds === null) return { enabled: true, sourceIds: [id] };
  if (!selection.sourceIds.includes(id)) return { enabled: true, sourceIds: [...selection.sourceIds, id] };
  return selection.enabled ? selection : { ...selection, enabled: true };
}

async function requestIntakeConfig(baseUrl: string, init?: RequestInit): Promise<IntakeConfig> {
  const res = await fetch(`${baseUrl}/web/intake/config`, {
    headers: { Accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  const { config } = (await res.json()) as { config?: Partial<Record<string, IntakeSelection>> };
  return normalizeIntakeConfig(config);
}

/** Read the org's intake config (server falls back to the defaults). */
export async function fetchIntakeConfig(baseUrl: string): Promise<IntakeConfig> {
  return requestIntakeConfig(baseUrl);
}

/** Save the org's intake config; resolves to the persisted config. */
export async function saveIntakeConfig(baseUrl: string, config: IntakeConfig): Promise<IntakeConfig> {
  return requestIntakeConfig(baseUrl, { method: 'PUT', body: JSON.stringify(config) });
}

/** Routing of one intake source to the Factory project its items land in. */
export interface IntakeSourceBinding {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string;
  /** Installed board the source feeds; `null` keeps the built-in routing (issues → Work, PRs → Review). */
  board: string | null;
  /**
   * Jira only: labels whose issues this factory takes; `null` takes every issue no other factory's
   * labels claim. Absent from servers that predate label filters, which means `null`.
   */
  labels?: string[] | null;
  /** ISO timestamp; when two label filters match one issue, the older binding takes it. */
  createdAt?: string;
}

/** Another factory's binding that already takes some of the requested issues. */
export interface IntakeBindingConflict {
  factoryProjectId: string;
  /** Overlapping labels, or `null` when both bindings would take all issues. */
  labels: string[] | null;
}

/** The server refused a binding because another factory already takes some of the same issues. */
export class IntakeBindingConflictError extends Error {
  readonly conflicts: IntakeBindingConflict[];

  constructor(message: string, conflicts: IntakeBindingConflict[]) {
    super(message);
    this.name = 'IntakeBindingConflictError';
    this.conflicts = conflicts;
  }
}

async function requestIntakeBindings(baseUrl: string, init?: RequestInit, query = ''): Promise<IntakeSourceBinding[]> {
  const res = await fetch(`${baseUrl}/web/intake/bindings${query}`, {
    headers: { Accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let conflicts: IntakeBindingConflict[] | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string; conflicts?: IntakeBindingConflict[] };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
      if (body.error === 'binding_conflict') conflicts = body.conflicts ?? [];
    } catch {
      /* ignore non-JSON */
    }
    throw conflicts ? new IntakeBindingConflictError(message, conflicts) : new Error(message);
  }
  const { bindings } = (await res.json()) as { bindings?: IntakeSourceBinding[] };
  return bindings ?? [];
}

/** Read every intake source binding in the caller's organization. */
export async function fetchIntakeBindings(baseUrl: string): Promise<IntakeSourceBinding[]> {
  return requestIntakeBindings(baseUrl);
}

/** One GitHub label routed to an installed board within a Factory project. */
export interface IntakeLabelRoute {
  factoryProjectId: string;
  integrationId: string;
  /** Normalized (trimmed, lower-cased) label name. */
  label: string;
  board: string;
}

async function requestIntakeLabelRoutes(
  baseUrl: string,
  query: string,
  init?: RequestInit,
): Promise<IntakeLabelRoute[]> {
  const res = await fetch(`${baseUrl}/web/intake/label-routes${query}`, {
    headers: { Accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  const { routes } = (await res.json()) as { routes?: IntakeLabelRoute[] };
  return routes ?? [];
}

/** Read the label → board routes of one Factory project. */
export async function fetchIntakeLabelRoutes(baseUrl: string, factoryProjectId: string): Promise<IntakeLabelRoute[]> {
  return requestIntakeLabelRoutes(baseUrl, `?factoryProjectId=${encodeURIComponent(factoryProjectId)}`);
}

/** Route a label to a board, or clear it with `board: null`. Resolves to the project's routes. */
export async function saveIntakeLabelRoute(
  baseUrl: string,
  route: { factoryProjectId: string; integrationId: string; label: string; board: string | null },
): Promise<IntakeLabelRoute[]> {
  return requestIntakeLabelRoutes(baseUrl, '', { method: 'PUT', body: JSON.stringify(route) });
}

/**
 * Route one source to a Factory project, or clear it with `factoryProjectId: null`. Jira sources
 * can feed several factories, each with its own `labels` filter (omitted keeps the current one);
 * remove a Jira binding with {@link deleteIntakeBinding}. Rejects with
 * {@link IntakeBindingConflictError} when another factory already takes the same issues.
 */
export async function saveIntakeBinding(
  baseUrl: string,
  binding: {
    integrationId: string;
    sourceId: string;
    factoryProjectId: string | null;
    board?: string | null;
    labels?: string[] | null;
  },
): Promise<IntakeSourceBinding[]> {
  return requestIntakeBindings(baseUrl, { method: 'PUT', body: JSON.stringify(binding) });
}

/** Remove one factory's binding of a source, leaving other factories' bindings of it in place. */
export async function deleteIntakeBinding(
  baseUrl: string,
  binding: { integrationId: string; sourceId: string; factoryProjectId: string },
): Promise<IntakeSourceBinding[]> {
  return requestIntakeBindings(baseUrl, { method: 'DELETE' }, `?${new URLSearchParams(binding)}`);
}
