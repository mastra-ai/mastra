import { getToken } from '../auth/credentials.js';
import { fetchServerProjects } from '../server/platform-api.js';
import { loadProjectConfig } from '../studio/project-config.js';
import { ApiCliError } from './errors.js';
import { parseHeaders } from './headers.js';

const LOCAL_URL = 'http://localhost:4111';

export interface ApiGlobalOptions {
  url?: string;
  header: string[];
  timeout?: string;
  pretty: boolean;
  schema?: boolean;
}

export interface ResolvedTarget {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
}

export async function resolveTarget(options: ApiGlobalOptions): Promise<ResolvedTarget> {
  const timeoutMs = parseTimeout(options.timeout);
  const customHeaders = parseHeaders(options.header);

  if (options.url) {
    return { baseUrl: options.url, headers: customHeaders, timeoutMs };
  }

  if (await canReachLocal(timeoutMs)) {
    return { baseUrl: LOCAL_URL, headers: customHeaders, timeoutMs };
  }

  const config = await loadProjectConfig(process.cwd());
  if (!config) {
    throw new ApiCliError('SERVER_UNREACHABLE', 'Could not connect to target server');
  }

  try {
    const token = await getToken();
    const projects = await fetchServerProjects(token, config.organizationId);
    const project = projects.find(
      candidate => candidate.id === config.projectId || candidate.slug === config.projectSlug,
    );
    const baseUrl = project?.instanceUrl;

    if (!baseUrl) {
      throw new ApiCliError('PLATFORM_RESOLUTION_FAILED', 'Could not resolve platform deployment URL', {
        projectId: config.projectId,
        projectSlug: config.projectSlug,
      });
    }

    return {
      baseUrl,
      headers: { Authorization: `Bearer ${token}`, ...customHeaders },
      timeoutMs,
    };
  } catch (error) {
    if (error instanceof ApiCliError) throw error;
    throw new ApiCliError('PLATFORM_RESOLUTION_FAILED', 'Could not resolve platform deployment URL', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseTimeout(timeout?: string): number {
  if (!timeout) return 30_000;
  const parsed = Number(timeout);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
  return parsed;
}

async function canReachLocal(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 1_000));
  try {
    const response = await fetch(`${LOCAL_URL}/api/system/api-schema`, { method: 'GET', signal: controller.signal });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
