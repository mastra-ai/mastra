import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { getToken, type LoginOptions } from '../auth/credentials.js';
import { fetchServerProjects } from '../server/platform-api.js';
import { loadProjectConfig } from '../studio/project-config.js';
import { ApiCliError } from './errors.js';
import { parseHeaders } from './headers.js';

const LOCAL_URL = 'http://localhost:4111';
const OBSERVABILITY_URL = 'https://observability.mastra.ai';
const OBSERVABILITY_EU_URL = 'https://observability.eu.mastra.ai';
const TRUSTED_OBSERVABILITY_ORIGINS = new Set([OBSERVABILITY_URL, OBSERVABILITY_EU_URL]);
const LEARNING_URL = 'https://output.signals.mastra.ai';
const AUTHORIZATION_HEADER = 'Authorization';
const PROJECT_ID_HEADER = 'X-Mastra-Project-Id';
const ORGANIZATION_ID_HEADER = 'X-Mastra-Organization-Id';

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
    if (isTrustedObservabilityUrl(options.url)) {
      return resolvePlatformServiceTarget(options.url, customHeaders, timeoutMs);
    }

    const headers = { ...customHeaders };
    if (isPlatformHostedInstance(options.url) && !getHeader(customHeaders, AUTHORIZATION_HEADER)) {
      const token = await getOptionalToken();
      if (token) {
        headers[AUTHORIZATION_HEADER] = `Bearer ${token}`;
      }
    }
    return { baseUrl: options.url, headers, timeoutMs, apiPrefix };
  }

  if (isObservabilityPath(path)) {
    return resolvePlatformServiceTarget(OBSERVABILITY_URL, customHeaders, timeoutMs);
  }

  if (isLearningPath(path)) {
    return resolvePlatformServiceTarget(LEARNING_URL, customHeaders, timeoutMs, { includeOrganization: true });
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

/**
 * Resolves a hosted Mastra platform service target (observability or learning)
 * with platform credentials instead of a project deployment URL.
 */
async function resolvePlatformServiceTarget(
  baseUrl: string,
  customHeaders: Record<string, string>,
  timeoutMs: number,
  options: { includeOrganization?: boolean } = {},
): Promise<ResolvedTarget> {
  const env = loadDotenv(process.cwd());
  const explicitAuthorization = getHeader(customHeaders, AUTHORIZATION_HEADER);
  const explicitProjectId = getHeader(customHeaders, PROJECT_ID_HEADER);
  const explicitOrganizationId = getHeader(customHeaders, ORGANIZATION_ID_HEADER);
  const envToken = process.env.MASTRA_PLATFORM_ACCESS_TOKEN || env.MASTRA_PLATFORM_ACCESS_TOKEN;
  const cliToken = explicitAuthorization
    ? undefined
    : await getOptionalToken(envToken ? { allowLogin: false } : undefined);
  const envProjectId = process.env.MASTRA_PROJECT_ID || env.MASTRA_PROJECT_ID;
  const envOrganizationId = process.env.MASTRA_ORGANIZATION_ID || env.MASTRA_ORGANIZATION_ID;
  const projectConfig = await loadProjectConfig(process.cwd());
  const configProjectId = explicitProjectId || envProjectId ? undefined : projectConfig?.projectId;
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

  // The learning endpoint binds tenant scope from the organization header.
  if (options.includeOrganization && !explicitOrganizationId) {
    const organizationId = envOrganizationId || projectConfig?.organizationId;
    if (organizationId) {
      headers[ORGANIZATION_ID_HEADER] = organizationId;
    }
  }

  const fallbackHeaders =
    envToken && cliToken && envToken !== cliToken
      ? { ...headers, [AUTHORIZATION_HEADER]: `Bearer ${cliToken}` }
      : undefined;

  return {
    baseUrl,
    headers,
    timeoutMs,
    fallbackHeaders,
  };
}

function isTrustedObservabilityUrl(url: string): boolean {
  try {
    return TRUSTED_OBSERVABILITY_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

/**
 * True when a URL points at a platform-hosted Mastra Studio or Factory instance
 * (production or staging). Excludes `*.server.mastra.cloud` — those are
 * user-provided instances that authenticate with their own credentials, not the
 * stored CLI user token.
 */
export function isPlatformHostedInstance(url: string): boolean {
  let hostname: string;
  try {
    const parsed = new URL(url);
    // Only attach the stored bearer token over HTTPS to avoid leaking
    // credentials on unencrypted connections.
    if (parsed.protocol !== 'https:') return false;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    hostname.endsWith('.studio.mastra.cloud') ||
    hostname.endsWith('.factory.mastra.cloud') ||
    hostname.endsWith('.studio.staging.mastra.cloud') ||
    hostname.endsWith('.factory.staging.mastra.cloud')
  );
}

function isObservabilityPath(path?: string): boolean {
  return path?.startsWith('/observability/') || path === '/observability';
}

function isLearningPath(path?: string): boolean {
  return path?.startsWith('/learning/') || path === '/learning';
}

function loadDotenv(cwd: string): Record<string, string> {
  const envPath = join(cwd, '.env');
  if (!existsSync(envPath)) return {};
  return parse(readFileSync(envPath));
}

async function getOptionalToken(options?: LoginOptions): Promise<string | undefined> {
  try {
    return await getToken(undefined, options);
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
