import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { getToken } from '../auth/credentials.js';
import { fetchServerProjects } from '../server/platform-api.js';
import { loadProjectConfig } from '../studio/project-config.js';
import { ApiCliError } from './errors.js';
import { parseHeaders } from './headers.js';

const LOCAL_URL = 'http://localhost:4111';
const OBSERVABILITY_URL = 'https://observability.mastra.ai';
const AUTHORIZATION_HEADER = 'Authorization';
const PROJECT_ID_HEADER = 'X-Mastra-Project-Id';

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
  fallbackHeaders?: Record<string, string>;
}

export async function resolveTarget(
  options: ApiGlobalOptions,
  fetchFn: typeof fetch = fetch,
  path?: string,
): Promise<ResolvedTarget> {
  const timeoutMs = parseTimeout(options.timeout);
  const customHeaders = parseHeaders(options.header);

  if (isObservabilityPath(path)) {
    return resolveObservabilityTarget(options, customHeaders, timeoutMs);
  }

  if (options.url) {
    return { baseUrl: options.url, headers: customHeaders, timeoutMs };
  }

  if (await canReachLocal(timeoutMs, fetchFn)) {
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

async function resolveObservabilityTarget(
  options: ApiGlobalOptions,
  customHeaders: Record<string, string>,
  timeoutMs: number,
): Promise<ResolvedTarget> {
  const env = loadDotenv(process.cwd());
  const explicitAuthorization = getHeader(customHeaders, AUTHORIZATION_HEADER);
  const explicitProjectId = getHeader(customHeaders, PROJECT_ID_HEADER);
  const envToken = process.env.MASTRA_PLATFORM_ACCESS_TOKEN || env.MASTRA_PLATFORM_ACCESS_TOKEN;
  const cliToken = explicitAuthorization || options.url ? undefined : await getOptionalToken();
  const envProjectId = process.env.MASTRA_PROJECT_ID || env.MASTRA_PROJECT_ID;
  const configProjectId =
    explicitProjectId || envProjectId || options.url ? undefined : (await loadProjectConfig(process.cwd()))?.projectId;
  const projectId = explicitProjectId || envProjectId || configProjectId;
  const headers = { ...customHeaders };

  if (!explicitAuthorization && envToken) {
    headers[AUTHORIZATION_HEADER] = `Bearer ${envToken}`;
  } else if (!explicitAuthorization && cliToken) {
    headers[AUTHORIZATION_HEADER] = `Bearer ${cliToken}`;
  }

  if (!explicitProjectId && projectId) {
    headers[PROJECT_ID_HEADER] = projectId;
  }

  const fallbackHeaders =
    envToken && cliToken && envToken !== cliToken
      ? { ...headers, [AUTHORIZATION_HEADER]: `Bearer ${cliToken}` }
      : undefined;

  return {
    baseUrl: options.url ?? OBSERVABILITY_URL,
    headers,
    timeoutMs,
    fallbackHeaders,
  };
}

function isObservabilityPath(path?: string): boolean {
  return path?.startsWith('/observability/') || path === '/observability';
}

function loadDotenv(cwd: string): Record<string, string> {
  const envPath = join(cwd, '.env');
  if (!existsSync(envPath)) return {};
  return parse(readFileSync(envPath));
}

async function getOptionalToken(): Promise<string | undefined> {
  try {
    return await getToken();
  } catch {
    return undefined;
  }
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

function parseTimeout(timeout?: string): number {
  if (!timeout) return 30_000;
  const parsed = Number(timeout);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
  return parsed;
}

async function canReachLocal(timeoutMs: number, fetchFn: typeof fetch): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 1_000));
  try {
    const response = await fetchFn(`${LOCAL_URL}/api/system/api-schema`, { method: 'GET', signal: controller.signal });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
