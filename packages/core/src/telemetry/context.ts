import { execFile } from 'node:child_process';
import { z } from 'zod/v4';
import { hashTelemetryValue, isTelemetryEnabled } from './posthog';

export interface ServerTelemetryContext {
  projectId: string;
  projectId2: string | undefined;
  distinctId: string | undefined;
  command: string;
  nodeEnv: string;
}

const platformProjectIdSchema = z.uuid();
let cachedGitProjectId2: Promise<string | undefined> | undefined;

function normalizeGitRemote(remote: string): string | undefined {
  try {
    // Local paths have no cross-machine repository identity.
    if (/^(?:[a-z]:[\\/]|file:)/i.test(remote)) return undefined;

    const scpRemote = /^(?:[^/@:\s]+@)?(\[[^\]]+\]|[^/:\s]+):(.+)$/.exec(remote);
    const url = new URL(!remote.includes('://') && scpRemote ? `ssh://${scpRemote[1]}/${scpRemote[2]}` : remote);
    if (!['https:', 'http:', 'ssh:', 'git:', 'git+ssh:'].includes(url.protocol) || !url.hostname) {
      return undefined;
    }

    const repositoryPath = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
    return repositoryPath ? `${url.hostname.toLowerCase()}/${repositoryPath}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the project's Git `origin` normalized to lowercase `host/path`, so SSH, HTTPS,
 * credentials, and ports all map to one repository identity. Resolves to `undefined` without
 * running Git when telemetry is disabled, and when Git, the origin, or a remote repository
 * identity isn't available. Never rejects.
 */
export async function getGitRepositoryIdentity(
  cwd: string = process.env.MASTRA_PROJECT_ROOT || process.cwd(),
): Promise<string | undefined> {
  if (!isTelemetryEnabled()) {
    return undefined;
  }
  try {
    const remote = await new Promise<string>((resolve, reject) => {
      execFile(
        'git',
        ['remote', 'get-url', 'origin'],
        {
          cwd,
          encoding: 'utf-8',
          timeout: 2000,
          maxBuffer: 4096,
        },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        },
      );
    });
    return normalizeGitRemote(remote.trim());
  } catch {
    // Missing git, an unavailable origin, or a timeout means no repository identity.
    return undefined;
  }
}

/** The 16-hex-character `project_id2` form sent for a non-Platform project identity. */
export function hashProjectIdentity(identity: string): string {
  return hashTelemetryValue(identity).slice(0, 16);
}

async function computeGitProjectId2(): Promise<string | undefined> {
  const identity = await getGitRepositoryIdentity();
  return identity ? hashProjectIdentity(identity) : undefined;
}

/**
 * Preserves UUID-shaped Platform project IDs for direct telemetry lookup.
 * Other values fall back to a hash of the normalized Git origin, if available.
 */
async function resolveProjectId2(): Promise<string | undefined> {
  const platformProjectId = platformProjectIdSchema.safeParse(process.env.MASTRA_PROJECT_ID?.trim());
  if (platformProjectId.success) {
    return `mp_${platformProjectId.data}`;
  }
  cachedGitProjectId2 ??= computeGitProjectId2();
  return cachedGitProjectId2;
}

/** The server telemetry context without `projectId2`, for callers that resolve it themselves. */
export function getServerTelemetryBaseContext(): Omit<ServerTelemetryContext, 'projectId2'> {
  return {
    projectId: hashTelemetryValue(process.env.MASTRA_PROJECT_ROOT || process.cwd()).slice(0, 16),
    distinctId: process.env.MASTRA_CLI_DISTINCT_ID || undefined,
    command: process.env.MASTRA_TELEMETRY_COMMAND || 'server',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

export async function getServerTelemetryContext(): Promise<ServerTelemetryContext> {
  return {
    ...getServerTelemetryBaseContext(),
    projectId2: await resolveProjectId2(),
  };
}

export function resetProjectId2CacheForTests(): void {
  cachedGitProjectId2 = undefined;
}
