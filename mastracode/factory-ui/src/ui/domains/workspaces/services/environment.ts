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

/** The host's FactorySandbox as the route describes it: provider id, settings JSON Schema, capabilities. */
export interface FactoryEnvironmentSandbox {
  provider: string;
  settingsSchema: Record<string, unknown>;
  capabilities: { template: boolean; builds: { available: boolean; history: boolean } };
}

/** When the environment builds on its own; present only when the sandbox can build. */
export interface FactoryEnvironmentBuildTriggers {
  schedule: {
    enabled: boolean;
    cron: string | null;
    timezone: string | null;
    /** False when the host's storage has no schedules domain; the cron trigger cannot be enabled then. */
    scheduleAvailable: boolean;
  };
  push: { enabled: boolean; debounceMinutes: number };
}

/** The last build factory asked the provider for; its status is read live by id. */
export interface FactoryEnvironmentLastBuild {
  buildId: string;
  attemptedAt: string | null;
}

export type FactoryEnvironmentBuildStatus = 'pending' | 'building' | 'ready' | 'failed' | 'unknown';

export interface FactoryEnvironmentBuild {
  buildId: string;
  status: FactoryEnvironmentBuildStatus;
  templateId?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Log lines, as the provider streams them. */
  logs?: string[];
}

export interface FactoryEnvironmentBuildStart {
  outcome: 'started' | 'skipped' | 'unavailable' | 'failed';
  buildId?: string;
  templateId?: string;
  reason?: string;
}

export interface FactoryEnvironmentPayload {
  sandbox: FactoryEnvironmentSandbox;
  /** Provider settings the user set; absent keys use the provider default. */
  settings: Record<string, unknown>;
  sandboxWorkdir: string | null;
  workspaceSetupCommand: string | null;
  activeTemplateId: string | null;
  activeTemplateHeads: Record<string, string> | null;
  repositories: FactoryEnvironmentRepository[];
  buildTriggers?: FactoryEnvironmentBuildTriggers;
  build?: FactoryEnvironmentLastBuild | null;
  /** On a PATCH response: this update changed the template and a build was started for it. */
  buildRequested?: boolean;
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
  /** Merged onto the stored settings; null removes a key. */
  settings?: Record<string, unknown | null>;
  workspaceSetupCommand?: string | null;
  /** Only accepted when the sandbox can build. */
  buildTriggers?: {
    schedule?: { enabled: boolean; cron?: string; timezone?: string };
    push?: { enabled?: boolean; debounceMinutes?: number };
  };
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

export async function requestEnvironmentBuild(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactoryEnvironmentBuildStart> {
  const res = await fetch(`${environmentUrl(baseUrl, factoryProjectId)}/build`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return readJsonOrThrow<FactoryEnvironmentBuildStart>(res, 'Failed to start the build');
}

export async function listEnvironmentBuilds(
  baseUrl: string,
  factoryProjectId: string,
): Promise<FactoryEnvironmentBuild[]> {
  const res = await fetch(`${environmentUrl(baseUrl, factoryProjectId)}/builds`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const { builds } = await readJsonOrThrow<{ builds: FactoryEnvironmentBuild[] }>(res, 'Failed to load builds');
  return builds;
}

/** The build id may be composite (E2B: `<templateId>:<buildId>`), so it travels encoded. */
export async function getEnvironmentBuild(
  baseUrl: string,
  factoryProjectId: string,
  buildId: string,
): Promise<FactoryEnvironmentBuild> {
  const res = await fetch(`${environmentUrl(baseUrl, factoryProjectId)}/builds/${encodeURIComponent(buildId)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const { build } = await readJsonOrThrow<{ build: FactoryEnvironmentBuild }>(res, 'Failed to load the build');
  return build;
}
