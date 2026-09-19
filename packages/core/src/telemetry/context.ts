import { execFileSync } from 'node:child_process';
import { hashTelemetryValue } from './posthog';

export interface ServerTelemetryContext {
  projectId: string;
  projectId2: string | undefined;
  distinctId: string | undefined;
  command: string;
  nodeEnv: string;
}

/** `undefined` = not yet computed, `null` = computed and unavailable. */
let cachedGitProjectId2: string | null | undefined;

function computeGitProjectId2(): string | undefined {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: process.env.MASTRA_PROJECT_ROOT || process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    return remote ? hashTelemetryValue(remote).slice(0, 16) : undefined;
  } catch {
    // Telemetry must never affect server startup: missing git binary, non-repo
    // directories, or a missing `origin` remote all mean "no secondary id".
    return undefined;
  }
}

/**
 * Secondary project identity for telemetry correlation. Prefers the Mastra
 * Platform project id (`mp_`-prefixed, unhashed) and falls back to a hash of
 * the git `origin` remote, which is stable across machines and checkout paths.
 * Undefined when neither source is available.
 */
function resolveProjectId2(): string | undefined {
  const platformProjectId = process.env.MASTRA_PROJECT_ID?.trim();
  if (platformProjectId) {
    return `mp_${platformProjectId}`;
  }
  if (cachedGitProjectId2 === undefined) {
    cachedGitProjectId2 = computeGitProjectId2() ?? null;
  }
  return cachedGitProjectId2 ?? undefined;
}

export function getServerTelemetryContext(): ServerTelemetryContext {
  return {
    projectId: hashTelemetryValue(process.env.MASTRA_PROJECT_ROOT || process.cwd()).slice(0, 16),
    projectId2: resolveProjectId2(),
    distinctId: process.env.MASTRA_CLI_DISTINCT_ID || undefined,
    command: process.env.MASTRA_TELEMETRY_COMMAND || 'server',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

export function resetProjectId2CacheForTests(): void {
  cachedGitProjectId2 = undefined;
}
