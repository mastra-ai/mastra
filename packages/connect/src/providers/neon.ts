import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_NEON_CONNECTION_ID';

/**
 * Neon console API. The Nango proxy base is https://console.neon.tech/api,
 * so every path carries the v2 prefix.
 */
const API = 'v2';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function arrayOf(raw: unknown, key: string): Record<string, unknown>[] {
  const list = asRecord(raw)[key];
  return Array.isArray(list) ? list.map(asRecord) : [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== null && value !== '' ? parsed : null;
}

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  regionId: z.string(),
  pgVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function shapeProject(raw: unknown) {
  const project = asRecord(raw);
  return {
    id: String(project.id ?? ''),
    name: String(project.name ?? ''),
    regionId: String(project.region_id ?? ''),
    pgVersion: String(asRecord(project.default_endpoint_settings).pg_version ?? ''),
    createdAt: String(project.created_at ?? ''),
    updatedAt: String(project.updated_at ?? ''),
  };
}

const branchSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  default: z.boolean(),
  currentState: z.string(),
  logicalSize: z.number().nullable(),
  createdAt: z.string(),
});

function shapeBranch(raw: unknown) {
  const branch = asRecord(raw);
  return {
    id: String(branch.id ?? ''),
    name: String(branch.name ?? ''),
    parentId: typeof branch.parent_id === 'string' ? branch.parent_id : null,
    default: branch.default === true,
    currentState: String(branch.current_state ?? ''),
    logicalSize: toNumber(branch.logical_size),
    createdAt: String(branch.created_at ?? ''),
  };
}

/**
 * Curated Neon toolset executing through the platform connection proxy.
 * All tools resolve the connection from `options.connectionId` or
 * MASTRA_NEON_CONNECTION_ID at execute time.
 */
export function createNeonTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    neon_list_projects: defineProxyTool(context, {
      id: 'neon_list_projects',
      description: 'List Neon Postgres projects accessible with the connected API key.',
      inputSchema: z.object({
        search: z.string().optional().describe('Filter projects by name substring'),
      }),
      outputSchema: z.object({ projects: z.array(projectSchema) }),
      request: input => ({ method: 'GET', path: `${API}/projects`, query: { search: input.search } }),
      transform: raw => ({ projects: arrayOf(raw, 'projects').map(shapeProject) }),
    }),

    neon_get_project: defineProxyTool(context, {
      id: 'neon_get_project',
      description: 'Get one Neon project by id.',
      inputSchema: z.object({ projectId: z.string().min(1) }),
      outputSchema: projectSchema,
      request: input => ({ method: 'GET', path: `${API}/projects/${encodeURIComponent(input.projectId)}` }),
      transform: raw => shapeProject(asRecord(raw).project),
    }),

    neon_list_branches: defineProxyTool(context, {
      id: 'neon_list_branches',
      description: 'List the branches of a Neon project.',
      inputSchema: z.object({ projectId: z.string().min(1) }),
      outputSchema: z.object({ branches: z.array(branchSchema) }),
      request: input => ({
        method: 'GET',
        path: `${API}/projects/${encodeURIComponent(input.projectId)}/branches`,
      }),
      transform: raw => ({ branches: arrayOf(raw, 'branches').map(shapeBranch) }),
    }),

    neon_create_branch: defineProxyTool(context, {
      id: 'neon_create_branch',
      description: 'Create a branch in a Neon project, optionally from a parent branch.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        name: z.string().optional().describe('Branch name; Neon generates one when omitted'),
        parentId: z.string().optional().describe('Branch id to fork from; defaults to the project default branch'),
      }),
      outputSchema: branchSchema,
      request: input => ({
        method: 'POST',
        path: `${API}/projects/${encodeURIComponent(input.projectId)}/branches`,
        body: { branch: { name: input.name, parent_id: input.parentId } },
      }),
      transform: raw => shapeBranch(asRecord(raw).branch),
    }),

    neon_delete_branch: defineProxyTool(context, {
      id: 'neon_delete_branch',
      description:
        'DESTRUCTIVE: permanently deletes a Neon branch and its data. Only use when the user explicitly asks to delete a branch.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        branchId: z.string().min(1),
      }),
      outputSchema: z.object({ branchId: z.string(), name: z.string() }),
      request: input => ({
        method: 'DELETE',
        path: `${API}/projects/${encodeURIComponent(input.projectId)}/branches/${encodeURIComponent(input.branchId)}`,
      }),
      transform: (raw, input) => {
        const branch = asRecord(asRecord(raw).branch);
        return { branchId: String(branch.id ?? input.branchId), name: String(branch.name ?? '') };
      },
    }),

    neon_list_databases: defineProxyTool(context, {
      id: 'neon_list_databases',
      description: 'List the Postgres databases of a Neon project branch.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        branchId: z.string().min(1),
      }),
      outputSchema: z.object({
        databases: z.array(z.object({ id: z.number(), name: z.string(), ownerName: z.string(), branchId: z.string() })),
      }),
      request: input => ({
        method: 'GET',
        path: `${API}/projects/${encodeURIComponent(input.projectId)}/branches/${encodeURIComponent(input.branchId)}/databases`,
      }),
      transform: raw => ({
        databases: arrayOf(raw, 'databases').map(database => ({
          id: toNumber(database.id) ?? 0,
          name: String(database.name ?? ''),
          ownerName: String(database.owner_name ?? ''),
          branchId: String(database.branch_id ?? ''),
        })),
      }),
    }),

    neon_list_endpoints: defineProxyTool(context, {
      id: 'neon_list_endpoints',
      description:
        'List the compute endpoints (connection hosts and roles metadata) of a Neon project. Returns connection metadata only — no passwords or credentials.',
      inputSchema: z.object({ projectId: z.string().min(1) }),
      outputSchema: z.object({
        endpoints: z.array(
          z.object({
            id: z.string(),
            branchId: z.string(),
            host: z.string(),
            type: z.string(),
            currentState: z.string(),
          }),
        ),
      }),
      request: input => ({
        method: 'GET',
        path: `${API}/projects/${encodeURIComponent(input.projectId)}/endpoints`,
      }),
      transform: raw => ({
        endpoints: arrayOf(raw, 'endpoints').map(endpoint => ({
          id: String(endpoint.id ?? ''),
          branchId: String(endpoint.branch_id ?? ''),
          host: String(endpoint.host ?? ''),
          type: String(endpoint.type ?? ''),
          currentState: String(endpoint.current_state ?? ''),
        })),
      }),
    }),
  };

  return applyAllowTools(tools, options?.allowTools);
}
