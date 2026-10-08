/**
 * Browser-side helpers for a Factory's environment: the sandbox resources, the
 * ordered repository list with per-repository setup and the workspace setup
 * command. Mirrors the factory's `GET`/`PATCH /web/factory/projects/:id/environment`
 * contract.
 */

import { readJsonOrThrow } from './http';

export type EnvironmentRepositoryBuildStatus = 'unbuilt' | 'configured' | 'failed';

export interface FactoryEnvironmentRepository {
  projectRepositoryId: string;
  connectionId: string;
  repositoryId: string;
  /** Null when the repository row behind the link is missing. */
  slug: string | null;
  defaultBranch: string | null;
  position: number;
  inEnvironment: boolean;
  setupCommand: string | null;
  teardownCommand: string | null;
  lastBuildStatus: EnvironmentRepositoryBuildStatus;
  lastBuildError: string | null;
  lastBuiltAt: string | null;
}

export interface FactoryEnvironmentPayload {
  sandboxWorkdir: string | null;
  sandboxCpuCount: number | null;
  sandboxMemoryMb: number | null;
  sandboxIdleTimeoutMinutes: number | null;
  workspaceSetupCommand: string | null;
  activeTemplateId: string | null;
  activeTemplateHeads: Record<string, string> | null;
  repositories: FactoryEnvironmentRepository[];
}

export interface FactoryEnvironmentResponse {
  environment: FactoryEnvironmentPayload;
}

export interface FactoryEnvironmentRepositoryPatch {
  projectRepositoryId: string;
  position?: number;
  inEnvironment?: boolean;
  setupCommand?: string | null;
  teardownCommand?: string | null;
}

export interface FactoryEnvironmentPatch {
  sandboxWorkdir?: string | null;
  sandboxCpuCount?: number | null;
  sandboxMemoryMb?: number | null;
  sandboxIdleTimeoutMinutes?: number | null;
  workspaceSetupCommand?: string | null;
  /** Positions, when given, must be a permutation of 1..n over the listed repositories. */
  repositories?: FactoryEnvironmentRepositoryPatch[];
}

function environmentUrl(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/environment`;
}

export async function getFactoryEnvironment(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactoryEnvironmentPayload> {
  const res = await fetch(environmentUrl(baseUrl, factoryProjectId), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const { environment } = await readJsonOrThrow<FactoryEnvironmentResponse>(res, 'Failed to load environment');
  return environment;
}

export async function patchFactoryEnvironment(
  baseUrl: string,
  factoryProjectId: string,
  input: FactoryEnvironmentPatch,
): Promise<FactoryEnvironmentResponse> {
  const res = await fetch(environmentUrl(baseUrl, factoryProjectId), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  return readJsonOrThrow<FactoryEnvironmentResponse>(res, 'Failed to save environment');
}
