/**
 * Browser-side helpers for the intake source configuration (Settings › Intake).
 *
 * The config is stored per `(org, user)` on the server. GitHub uses
 * `sourceIds` (connected source ids); Linear keeps `sourceIds`
 * (provider-owned source ids). `null` id lists mean
 * "nothing selected" — nothing syncs until the user picks entries.
 */

export interface IntakeSelection {
  enabled: boolean;
  /** Source ids to sync; `null` = nothing selected. */
  sourceIds: string[] | null;
}

export interface IntakeConfig {
  github: IntakeSelection;
  linear: IntakeSelection;
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
  return {
    github: raw?.github ?? { enabled: true, sourceIds: null },
    linear: raw?.linear ?? { enabled: false, sourceIds: null },
  };
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
