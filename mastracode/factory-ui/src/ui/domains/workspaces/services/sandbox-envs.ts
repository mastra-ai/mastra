/**
 * Browser-side helpers for a Factory's sandbox environment variables. Mirrors
 * the factory's `/web/factory/projects/:id/sandbox-envs` routes. Values are
 * write-only: no response ever carries one.
 */

import { readJsonOrThrow } from './http';

export type SandboxEnvAppliesTo = 'build' | 'runtime' | 'both';

export interface SandboxEnv {
  name: string;
  appliesTo: SandboxEnvAppliesTo;
  updatedAt: string;
  updatedBy: string;
}

export interface SandboxEnvList {
  envs: SandboxEnv[];
  /** False when the server can't encrypt values yet; every write would be refused. */
  writable: boolean;
}

function envsUrl(baseUrl: string, factoryProjectId: string, name?: string): string {
  const base = `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/sandbox-envs`;
  return name === undefined ? base : `${base}/${encodeURIComponent(name)}`;
}

/** Surfaces the server's message (e.g. a reserved name) instead of a bare status. */
async function throwUnlessOk(res: Response, failure: string): Promise<void> {
  if (res.ok) return;
  let message = `${failure} (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // Keep the status message.
  }
  throw new Error(message);
}

export async function listSandboxEnvs(baseUrl: string, factoryProjectId: string): Promise<SandboxEnvList> {
  const res = await fetch(envsUrl(baseUrl, factoryProjectId), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<SandboxEnvList>(res, 'Failed to load environment variables');
}

export async function setSandboxEnv(
  baseUrl: string,
  factoryProjectId: string,
  input: { name: string; value: string; appliesTo: SandboxEnvAppliesTo },
): Promise<void> {
  const res = await fetch(envsUrl(baseUrl, factoryProjectId, input.name), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ value: input.value, appliesTo: input.appliesTo }),
  });
  await throwUnlessOk(res, 'Failed to save the variable');
}

export async function updateSandboxEnvAppliesTo(
  baseUrl: string,
  factoryProjectId: string,
  input: { name: string; appliesTo: SandboxEnvAppliesTo },
): Promise<void> {
  const res = await fetch(envsUrl(baseUrl, factoryProjectId, input.name), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appliesTo: input.appliesTo }),
  });
  await throwUnlessOk(res, 'Failed to update the variable');
}

export async function deleteSandboxEnv(baseUrl: string, factoryProjectId: string, name: string): Promise<void> {
  const res = await fetch(envsUrl(baseUrl, factoryProjectId, name), {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  await throwUnlessOk(res, 'Failed to delete the variable');
}
