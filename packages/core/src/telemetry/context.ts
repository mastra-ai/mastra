import { execFile } from 'node:child_process';
import { z } from 'zod/v4';
import { hashTelemetryValue } from './posthog';

export interface ServerTelemetryContext {
  projectId: string;
  projectId2: string | undefined;
  distinctId: string | undefined;
  command: string;
  nodeEnv: string;
}

const platformProjectIdSchema = z.uuid();
let cachedGitProjectId2: Promise<string | undefined> | undefined;

function isWhitespaceCode(code: number): boolean {
  return /\s/.test(String.fromCharCode(code));
}

/** `user@host:path` and `[::1]:path`, including the odd splits the old SCP regex accepted. */
function parseScpRemote(remote: string): { host: string; path: string } | null {
  const parseHostAndPath = (start: number): { host: string; path: string } | null => {
    if (remote[start] === '[') {
      const end = remote.indexOf(']', start + 1);
      if (end > start + 1 && remote[end + 1] === ':') {
        const path = remote.slice(end + 2);
        if (path) return { host: remote.slice(start, end + 1), path };
      }
    }
    let hostEnd = start;
    while (hostEnd < remote.length) {
      const code = remote.charCodeAt(hostEnd);
      if (code === 47 || code === 58 || isWhitespaceCode(code)) break;
      hostEnd++;
    }
    if (hostEnd === start || remote[hostEnd] !== ':') return null;
    const path = remote.slice(hostEnd + 1);
    if (!path) return null;
    return { host: remote.slice(start, hostEnd), path };
  };

  const at = remote.indexOf('@');
  if (at > 0) {
    let userIsToken = true;
    for (let index = 0; index < at; index++) {
      const code = remote.charCodeAt(index);
      if (code === 47 || code === 64 || code === 58 || isWhitespaceCode(code)) {
        userIsToken = false;
        break;
      }
    }
    if (userIsToken) {
      const withUser = parseHostAndPath(at + 1);
      if (withUser) return withUser;
    }
  }
  return parseHostAndPath(0);
}

function trimEdgeSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 47) start++;
  while (end > start && value.charCodeAt(end - 1) === 47) end--;
  return value.slice(start, end);
}

function normalizeGitRemote(remote: string): string | undefined {
  try {
    // Local paths have no cross-machine repository identity.
    if (/^(?:[a-z]:[\\/]|file:)/i.test(remote)) return undefined;

    const scpRemote = !remote.includes('://') ? parseScpRemote(remote) : null;
    const url = new URL(scpRemote ? `ssh://${scpRemote.host}/${scpRemote.path}` : remote);
    if (!['https:', 'http:', 'ssh:', 'git:', 'git+ssh:'].includes(url.protocol) || !url.hostname) {
      return undefined;
    }

    const repositoryPath = trimEdgeSlashes(url.pathname).replace(/\.git$/, '');
    return repositoryPath ? `${url.hostname.toLowerCase()}/${repositoryPath}` : undefined;
  } catch {
    return undefined;
  }
}

async function computeGitProjectId2(): Promise<string | undefined> {
  try {
    const remote = await new Promise<string>((resolve, reject) => {
      execFile(
        'git',
        ['remote', 'get-url', 'origin'],
        {
          cwd: process.env.MASTRA_PROJECT_ROOT || process.cwd(),
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
    const normalizedRemote = normalizeGitRemote(remote.trim());
    return normalizedRemote ? hashTelemetryValue(normalizedRemote).slice(0, 16) : undefined;
  } catch {
    // Missing git, an unavailable origin, or a timeout means no secondary id.
    return undefined;
  }
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

export async function getServerTelemetryContext(): Promise<ServerTelemetryContext> {
  return {
    projectId: hashTelemetryValue(process.env.MASTRA_PROJECT_ROOT || process.cwd()).slice(0, 16),
    distinctId: process.env.MASTRA_CLI_DISTINCT_ID || undefined,
    command: process.env.MASTRA_TELEMETRY_COMMAND || 'server',
    nodeEnv: process.env.NODE_ENV || 'development',
    projectId2: await resolveProjectId2(),
  };
}

export function resetProjectId2CacheForTests(): void {
  cachedGitProjectId2 = undefined;
}
