import { ApiCliError } from '../api/errors.js';
import { parseHeaders } from '../api/headers.js';
import { MASTRA_PLATFORM_API_URL, authHeaders } from '../auth/client.js';
import { getCurrentOrgId, getToken } from '../auth/credentials.js';
import { loadProjectConfig } from '../studio/project-config.js';

export interface PlatformExperimentTargetOptions {
  project?: string;
  organization?: string;
  header?: string[];
}

export interface PlatformExperimentTarget {
  baseUrl: string;
  projectId: string;
  organizationId: string;
  headers: Record<string, string>;
}

export async function resolvePlatformExperimentTarget(
  options: PlatformExperimentTargetOptions,
): Promise<PlatformExperimentTarget> {
  const config = await loadProjectConfig(process.cwd());
  const projectId = options.project ?? process.env.MASTRA_PROJECT_ID ?? config?.projectId;
  if (!projectId) {
    throw new ApiCliError(
      'PLATFORM_RESOLUTION_FAILED',
      'No Platform project selected. Link this directory to a Platform project or pass --project / MASTRA_PROJECT_ID.',
    );
  }

  const organizationId =
    options.organization ??
    process.env.MASTRA_ORGANIZATION_ID ??
    process.env.MASTRA_ORG_ID ??
    config?.organizationId ??
    (await getCurrentOrgId());
  if (!organizationId) {
    throw new ApiCliError(
      'PLATFORM_RESOLUTION_FAILED',
      'No Platform organization selected. Run `mastra auth login` or pass --organization / MASTRA_ORG_ID.',
    );
  }

  const customHeaders = parseHeaders(options.header ?? []);
  const authorization = findHeader(customHeaders, 'authorization');
  if (!authorization) {
    const token = process.env.MASTRA_PLATFORM_ACCESS_TOKEN ?? (await getToken(undefined, { allowLogin: false }));
    Object.assign(customHeaders, authHeaders(token, organizationId));
  } else if (!findHeader(customHeaders, 'x-organization-id')) {
    customHeaders['x-organization-id'] = organizationId;
  }

  return {
    baseUrl: platformApiV1Url(process.env.MASTRA_PLATFORM_API_URL ?? MASTRA_PLATFORM_API_URL),
    projectId,
    organizationId,
    headers: customHeaders,
  };
}

function platformApiV1Url(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find(header => header.toLowerCase() === name);
  return key ? headers[key] : undefined;
}
