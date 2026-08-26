import { MASTRA_GATEWAY_URL, authHeaders } from '../../auth/client.js';
import { getCurrentOrgId, getToken } from '../../auth/credentials.js';
import { loadProjectConfig } from '../../studio/project-config.js';
import { ApiCliError } from '../errors.js';
import { parseHeaders } from '../headers.js';

export interface PlatformExperimentTargetOptions {
  project?: string;
  organization?: string;
  header?: string[];
  url?: string;
  serverApiPrefix?: string;
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
  if (options.url || options.serverApiPrefix) {
    throw new ApiCliError(
      'PLATFORM_RESOLUTION_FAILED',
      'Platform experiment commands use the authenticated Platform control plane and do not accept --url or --server-api-prefix.',
    );
  }

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
    baseUrl: (process.env.MASTRA_GATEWAY_URL ?? MASTRA_GATEWAY_URL).replace(/\/$/, ''),
    projectId,
    organizationId,
    headers: customHeaders,
  };
}

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find(header => header.toLowerCase() === name);
  return key ? headers[key] : undefined;
}
