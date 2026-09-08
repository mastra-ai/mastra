/**
 * Browser-side helpers for the intake source configuration (Settings › Intake).
 *
 * The config is stored per `(org, user)` on the server. GitHub uses
 * `sourceIds` (connected source ids); Linear and GitLab keep `sourceIds`
 * (provider-owned source ids — Linear project ids, GitLab numeric project
 * ids). `null` id lists mean "nothing selected" — nothing syncs until the
 * user picks entries.
 */

export interface IntakeSelection {
  enabled: boolean;
  /** Source ids to sync; `null` = nothing selected. */
  sourceIds: string[] | null;
}

export interface IntakeConfig {
  github: IntakeSelection;
  linear: IntakeSelection;
  gitlab: IntakeSelection;
  /**
   * Selections for integrations this build has no UI for. Preserved verbatim
   * across a read/write round-trip: the server replaces the whole config blob
   * on save, so a key this UI drops on read is a key it deletes on write.
   */
  [integrationId: string]: IntakeSelection;
}

/**
 * The server keeps intake config as a dynamic map keyed by integration id and
 * only returns the integrations registered in the running deployment, so a key
 * is absent whenever that integration isn't connected. Fill the fixed shape the
 * UI relies on so reads like `config.github.enabled` never touch `undefined`.
 * GitHub defaults to enabled (issues sync once a repo is picked); Linear stays
 * off until it's connected and a project is selected.
 */
function normalizeIntakeConfig(raw: Partial<Record<string, IntakeSelection>> | null | undefined): IntakeConfig {
  // Carry unrecognized integrations through untouched (see `IntakeConfig`),
  // dropping only absent values so `config.x.enabled` is never `undefined`.
  const passthrough = Object.fromEntries(
    Object.entries(raw ?? {}).filter((entry): entry is [string, IntakeSelection] => Boolean(entry[1])),
  );
  return {
    ...passthrough,
    github: raw?.github ?? { enabled: true, sourceIds: null },
    linear: raw?.linear ?? { enabled: false, sourceIds: null },
    // GitLab stays off until it is connected and a project is picked, matching
    // Linear: an enabled-by-default source with no selection syncs nothing but
    // reads as active in the UI.
    gitlab: raw?.gitlab ?? { enabled: false, sourceIds: null },
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

/** Read the caller's intake config (server falls back to the defaults). */
export async function fetchIntakeConfig(baseUrl: string): Promise<IntakeConfig> {
  return requestIntakeConfig(baseUrl);
}

/** Save the caller's intake config; resolves to the persisted config. */
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
}

async function requestIntakeBindings(baseUrl: string, init?: RequestInit): Promise<IntakeSourceBinding[]> {
  const res = await fetch(`${baseUrl}/web/intake/bindings`, {
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

/** Route one source to a Factory project, or clear it with `factoryProjectId: null`. */
export async function saveIntakeBinding(
  baseUrl: string,
  binding: { integrationId: string; sourceId: string; factoryProjectId: string | null; board?: string | null },
): Promise<IntakeSourceBinding[]> {
  return requestIntakeBindings(baseUrl, { method: 'PUT', body: JSON.stringify(binding) });
}
