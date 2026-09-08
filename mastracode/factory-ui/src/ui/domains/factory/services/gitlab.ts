/**
 * Browser-side helpers for the GitLab intake integration.
 *
 * Mirrors `./linear.ts`, with two deliberate differences:
 *
 * - **Status degrades instead of throwing.** A deployment without the GitLab
 *   integration registered serves no `/web/gitlab/status` route at all, so a
 *   404 reads as "not configured on this server" rather than an error. Callers
 *   read `data`, never `error` — the same contract Linear's status has.
 * - **Sources come from the generic intake endpoint.** GitLab has no dedicated
 *   `/web/gitlab/projects` route; `/web/intake/sources` already asks every
 *   registered integration for its sources, so the projects list is that
 *   response filtered to `integrationId === 'gitlab'`.
 */

export interface GitLabStatus {
  /** False when this deployment has no GitLab integration registered. */
  serverConfigured: boolean;
  /** True once a usable credential resolves (OAuth connection or static token). */
  connected: boolean;
  /** Whether a connect flow is available (an OAuth app is configured). */
  oauthAvailable: boolean;
  /** Instance origin the server talks to, e.g. `https://gitlab.example.com`. */
  baseUrl?: string;
  /** GitLab username behind the active credential. */
  connectedAs?: string;
  credential?: 'oauth' | 'static-token';
  /** Epoch ms; `null` for a static token, which does not expire. */
  expiresAt?: number | null;
  instanceVersion?: string;
  /** Machine-readable cause when `connected` is false. */
  reason?: 'no_connection' | 'credential_rejected' | string;
  /** Human-readable detail for `credential_rejected` (TLS, unreachable host, revoked token). */
  detail?: string;
}

export interface GitLabProject {
  /** Numeric GitLab project id, as a string — the intake `sourceId`. */
  id: string;
  /** `group / project` display name. */
  name: string;
  /** `group/project` path, when the server supplied it. */
  path?: string;
}

interface RawStatus {
  configured?: boolean;
  oauthAvailable?: boolean;
  baseUrl?: string;
  connectedAs?: string;
  credential?: string;
  expiresAt?: number | null;
  instanceVersion?: string;
  reason?: string;
  detail?: string;
}

const DISABLED_STATUS: GitLabStatus = { serverConfigured: false, connected: false, oauthAvailable: false };

/**
 * Read GitLab status. Never throws: an absent route, an unauthenticated
 * caller, or an unparseable body all resolve to a disabled status so the
 * settings section can render a reason instead of an error boundary.
 */
export async function fetchGitLabStatus(baseUrl: string): Promise<GitLabStatus> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/web/gitlab/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
  } catch {
    return DISABLED_STATUS;
  }
  if (!res.ok) return DISABLED_STATUS;

  let raw: RawStatus;
  try {
    raw = (await res.json()) as RawStatus;
  } catch {
    return DISABLED_STATUS;
  }

  return {
    serverConfigured: true,
    connected: raw.configured === true,
    oauthAvailable: raw.oauthAvailable === true,
    ...(raw.baseUrl ? { baseUrl: raw.baseUrl } : {}),
    ...(raw.connectedAs ? { connectedAs: raw.connectedAs } : {}),
    ...(raw.credential === 'oauth' || raw.credential === 'static-token' ? { credential: raw.credential } : {}),
    ...(raw.expiresAt !== undefined ? { expiresAt: raw.expiresAt } : {}),
    ...(raw.instanceVersion ? { instanceVersion: raw.instanceVersion } : {}),
    ...(raw.reason ? { reason: raw.reason } : {}),
    ...(raw.detail ? { detail: raw.detail } : {}),
  };
}

/**
 * Start the OAuth connect flow. A full navigation, not a fetch: the server
 * redirects to GitLab's consent screen, which then redirects back to
 * `/?gitlab=connected`.
 */
export function connectGitLab(baseUrl: string): void {
  window.location.assign(`${baseUrl}/web/gitlab/oauth/start`);
}

interface RawIntakeSource {
  integrationId?: string;
  id?: string;
  name?: string;
  type?: string;
  metadata?: { path?: unknown } | null;
}

/** GitLab projects the active credential can act on, via the generic intake endpoint. */
export async function listGitLabProjects(baseUrl: string): Promise<GitLabProject[]> {
  const res = await fetch(`${baseUrl}/web/intake/sources`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const { sources } = (await res.json()) as { sources?: RawIntakeSource[] };
  return (sources ?? [])
    .filter(source => source.integrationId === 'gitlab' && typeof source.id === 'string')
    .map(source => {
      const path = source.metadata?.path;
      return {
        id: source.id as string,
        name: source.name ?? (source.id as string),
        ...(typeof path === 'string' ? { path } : {}),
      };
    });
}
