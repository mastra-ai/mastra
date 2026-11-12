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
 * so every synthetic placeholder stays disabled. Saves send one integration
 * at a time, so placeholders only reach the server when that integration is
 * edited. Custom integration keys pass through.
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

/** Save one integration's selection; the server keeps the others. Resolves to the persisted config. */
export async function saveIntakeSelection(
  baseUrl: string,
  integrationId: string,
  selection: IntakeSelection,
): Promise<IntakeConfig> {
  return requestIntakeConfig(baseUrl, { method: 'PUT', body: JSON.stringify({ [integrationId]: selection }) });
}

/** Routing of one intake source to the Factory project its items land in. */
export interface IntakeSourceBinding {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string;
  /**
   * Jira only: labels whose issues this factory takes; `null` takes every issue no other factory's
   * labels claim. Absent from servers that predate label filters, which means `null`.
   */
  labels?: string[] | null;
  /** ISO timestamp; when two label filters match one issue, the older binding takes it. */
  createdAt?: string;
}

/** Route one source to a Factory project; `factoryProjectId: null` clears it, omitted `labels` keep the filter. */
export interface IntakeBindingWrite {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string | null;
  labels?: string[] | null;
}

/** One factory's binding of a source; a type alias so it doubles as query parameters. */
export type IntakeBindingTarget = {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string;
};

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

/**
 * Route one source to a Factory project, or clear it with `factoryProjectId: null`. Jira sources
 * can feed several factories, each with its own `labels` filter (omitted keeps the current one);
 * remove a Jira binding with {@link deleteIntakeBinding}. Rejects with
 * {@link IntakeBindingConflictError} when another factory already takes the same issues.
 */
export async function saveIntakeBinding(baseUrl: string, binding: IntakeBindingWrite): Promise<IntakeSourceBinding[]> {
  return requestIntakeBindings(baseUrl, { method: 'PUT', body: JSON.stringify(binding) });
}

/** Remove one factory's binding of a source, leaving other factories' bindings of it in place. */
export async function deleteIntakeBinding(
  baseUrl: string,
  binding: IntakeBindingTarget,
): Promise<IntakeSourceBinding[]> {
  return requestIntakeBindings(baseUrl, { method: 'DELETE' }, `?${new URLSearchParams(binding)}`);
}

/** `bindings` as they read once `write` is saved; an edited binding keeps its place. */
export function withIntakeBinding(bindings: IntakeSourceBinding[], write: IntakeBindingWrite): IntakeSourceBinding[] {
  const current = bindings.find(
    binding =>
      binding.integrationId === write.integrationId &&
      binding.sourceId === write.sourceId &&
      // Jira sources feed several factories, so a Jira binding is also told apart by factory.
      (write.integrationId !== 'jira' || binding.factoryProjectId === write.factoryProjectId),
  );
  if (write.factoryProjectId === null) return bindings.filter(binding => binding !== current);
  const next: IntakeSourceBinding = {
    ...current,
    integrationId: write.integrationId,
    sourceId: write.sourceId,
    factoryProjectId: write.factoryProjectId,
    labels: write.labels === undefined ? (current?.labels ?? null) : write.labels,
  };
  return current ? bindings.map(binding => (binding === current ? next : binding)) : [...bindings, next];
}

/** `bindings` as they read once `target` is deleted. */
export function withoutIntakeBinding(
  bindings: IntakeSourceBinding[],
  target: IntakeBindingTarget,
): IntakeSourceBinding[] {
  return bindings.filter(
    binding =>
      binding.integrationId !== target.integrationId ||
      binding.sourceId !== target.sourceId ||
      binding.factoryProjectId !== target.factoryProjectId,
  );
}
