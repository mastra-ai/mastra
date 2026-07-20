/**
 * Browser-side helpers for the intake source configuration (Settings › Intake).
 *
 * The config is stored per `(org, user)` on the server. GitHub uses
 * `repositoryIds` (connected repository UUIDs); Linear keeps `projectIds`
 * (Linear Project is the external provider concept). `null` id lists mean
 * "nothing selected" — nothing syncs until the user picks entries.
 */

export interface IntakeConfig {
  github: {
    enabled: boolean;
    /** Connected GitHub repository ids to sync; `null` = nothing selected. */
    repositoryIds: string[] | null;
  };
  linear: {
    enabled: boolean;
    /** Linear project ids to sync; `null` = nothing selected. */
    projectIds: string[] | null;
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
  const { config } = (await res.json()) as { config: IntakeConfig };
  return config;
}

/** Read the caller's intake config (server falls back to the defaults). */
export async function fetchIntakeConfig(baseUrl: string): Promise<IntakeConfig> {
  return requestIntakeConfig(baseUrl);
}

/** Save the caller's intake config; resolves to the persisted config. */
export async function saveIntakeConfig(baseUrl: string, config: IntakeConfig): Promise<IntakeConfig> {
  return requestIntakeConfig(baseUrl, { method: 'PUT', body: JSON.stringify(config) });
}
