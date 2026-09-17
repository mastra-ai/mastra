/**
 * Transport for the factory server's HTTP API: JSON parsing and the per-project
 * POST helper, shared by every service module in this domain.
 */

export async function readJsonOrThrow<T>(res: Response, failure: string): Promise<T> {
  if (!res.ok) {
    const error = new Error(`${failure} (${res.status})`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as T;
}

/**
 * An error from a git write operation (worktree/commit/push/pr) that carries the
 * server's error code so the UI can distinguish actionable failures (e.g.
 * `authRequired` for a 401, `Invalid branch` for a 400) from generic failures.
 */
export interface GitOpError extends Error {
  code?: string;
  status?: number;
  authRequired?: boolean;
}

/**
 * POST helper for the per-project git endpoints. Parses the server's JSON body,
 * surfacing `error`/`message` codes on failure (and `authRequired` for 401) so
 * callers can react without re-implementing the parsing dance each time.
 */
export async function postRepositoryGitOp<T>(
  baseUrl: string,
  projectRepositoryId: string,
  action: string,
  payload: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.error) code = body.error;
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    const err = new Error(message) as GitOpError;
    err.code = code;
    err.status = res.status;
    if (res.status === 401) err.authRequired = true;
    throw err;
  }
  return (await res.json()) as T;
}
