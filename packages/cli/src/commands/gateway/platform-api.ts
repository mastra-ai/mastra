import { createApiClient, throwApiError } from '../auth/client.js';
import type { paths } from '../platform-api.js';

type GatewayProjectsResponse = paths['/v1/gateway/projects']['get'] extends {
  responses: { 200: { content: { 'application/json': infer T } } };
}
  ? T
  : never;
export type GatewayProject = GatewayProjectsResponse extends { projects: (infer P)[] } ? P : never;

type ProvisionResponse = paths['/v1/gateway/projects/provision']['post'] extends {
  responses: { 201: { content: { 'application/json': infer T } } };
}
  ? T
  : never;

export async function fetchGatewayProjects(token: string, orgId: string): Promise<GatewayProject[]> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/gateway/projects');

  if (error) {
    throwApiError('Failed to fetch gateway projects', response.status);
  }

  return data.projects;
}

export async function provisionGatewayProject(token: string, orgId: string, name?: string): Promise<ProvisionResponse> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.POST('/v1/gateway/projects/provision', {
    body: { name },
  });

  if (error) {
    throwApiError(`Failed to provision gateway project — ${error.detail ?? 'unknown error'}`, response.status);
  }

  return data;
}
