/**
 * Browser-side helpers for a Factory's environment: the sandbox resources, the
 * ordered repository list with per-repository setup, the workspace setup
 * command, the build triggers and the last build's status. Mirrors the factory's
 * `GET`/`PATCH /web/factory/projects/:id/environment` and
 * `POST …/environment/build` contracts.
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

export interface FactoryEnvironmentBuildTriggers {
  schedule: { enabled: boolean; hours: number };
  onPush: {
    enabled: boolean;
    debounceMinutes: number;
    /** Null = unlimited. */
    maxPerHour: number | null;
  };
}

export type FactoryEnvironmentBuildStatus = 'ready' | 'partial' | 'failed' | 'building';

/** How this host learns about pushes: the Platform polling worker, the self-hosted webhook, or nothing. */
export type FactoryEnvironmentPushSignal = 'polling' | 'webhook' | 'none';

export interface FactoryEnvironmentBuild {
  status: FactoryEnvironmentBuildStatus | null;
  error: string | null;
  lastBuiltAt: string | null;
  activeTemplateId: string | null;
  requestedAt: string | null;
  pushSignal: FactoryEnvironmentPushSignal;
}

export interface FactoryEnvironmentPayload {
  sandboxProvider: string | null;
  sandboxWorkdir: string | null;
  sandboxCpuCount: number;
  sandboxMemoryMb: number;
  sandboxIdleTimeoutMinutes: number | null;
  workspaceSetupCommand: string | null;
  activeTemplateId: string | null;
  activeTemplateHeads: Record<string, string> | null;
  repositories: FactoryEnvironmentRepository[];
  buildTriggers: FactoryEnvironmentBuildTriggers;
  build: FactoryEnvironmentBuild;
}

export interface FactoryEnvironmentResponse {
  environment: FactoryEnvironmentPayload;
  /** Present on PATCH when the change affects the template and a build was queued. */
  buildRequested?: boolean;
}

export interface FactoryEnvironmentRepositoryPatch {
  projectRepositoryId: string;
  position?: number;
  inEnvironment?: boolean;
  setupCommand?: string | null;
  teardownCommand?: string | null;
}

export interface FactoryEnvironmentPatch {
  sandboxProvider?: string | null;
  sandboxWorkdir?: string | null;
  sandboxCpuCount?: number;
  sandboxMemoryMb?: number;
  sandboxIdleTimeoutMinutes?: number | null;
  workspaceSetupCommand?: string | null;
  /** Positions, when given, must be a permutation of 1..n over the listed repositories. */
  repositories?: FactoryEnvironmentRepositoryPatch[];
  buildTriggers?: {
    schedule?: { enabled?: boolean; hours?: number };
    onPush?: { enabled?: boolean; debounceMinutes?: number; maxPerHour?: number | null };
  };
}

export interface FactoryEnvironmentBuildResponse {
  requested: true;
  build: FactoryEnvironmentBuild;
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

export async function requestEnvironmentBuild(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactoryEnvironmentBuildResponse> {
  const res = await fetch(`${environmentUrl(baseUrl, factoryProjectId)}/build`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<FactoryEnvironmentBuildResponse>(res, 'Failed to request a build');
}
