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
  serverApiPrefix?: string;
}

export interface ResolvedTarget {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  fallbackHeaders?: Record<string, string>;
  /** API route prefix of the target server (e.g. `/api/mastra-studio`). Undefined when the default `/api` applies. */
  apiPrefix?: string;
}

export async function resolveTarget(
  options: ApiGlobalOptions,
  fetchFn: typeof fetch = fetch,
  path?: string,
): Promise<ResolvedTarget> {
  const timeoutMs = parseTimeout(options.timeout);
  const customHeaders = parseHeaders(options.header);
  const apiPrefix = resolveApiPrefix(options);

  if (options.url) {
    return { baseUrl: options.url, headers: customHeaders, timeoutMs, apiPrefix };
  }

  if (isObservabilityPath(path)) {
    return resolveObservabilityTarget(options, customHeaders, timeoutMs);
  }

  if (await canReachLocal(timeoutMs, fetchFn, apiPrefix)) {
    return { baseUrl: LOCAL_URL, headers: customHeaders, timeoutMs, apiPrefix };
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
      apiPrefix,
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

/**
 * Resolves the server API route prefix from the `--server-api-prefix` flag or the `MASTRA_API_PREFIX`
 * env var, normalizing it to a leading-slash, no-trailing-slash form. Returns undefined when the
 * default `/api` prefix applies so callers can omit it from the resolved target.
 */
function resolveApiPrefix(options: ApiGlobalOptions): string | undefined {
  const raw = options.serverApiPrefix ?? process.env.MASTRA_API_PREFIX;
  if (!raw) return undefined;
  const normalized = normalizeApiPrefix(raw);
  return normalized === '/api' ? undefined : normalized;
}

function normalizeApiPrefix(prefix: string): string {
  const value = prefix.trim();
  if (!value) return '/api';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const trimmed = withLeadingSlash.replace(/\/+$/, '');
  return trimmed || '/api';
}

function parseTimeout(timeout?: string): number {
  if (!timeout) return 30_000;
  const parsed = Number(timeout);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
  return parsed;
}

async function canReachLocal(timeoutMs: number, fetchFn: typeof fetch, apiPrefix?: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 1_000));
  try {
    const response = await fetchFn(`${LOCAL_URL}${apiPrefix ?? '/api'}/system/api-schema`, {
      method: 'GET',
      signal: controller.signal,
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
