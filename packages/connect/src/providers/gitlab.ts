import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_GITLAB_CONNECTION_ID';

/**
 * The connection is a GitLab group access token (Nango `gitlab-group-token`),
 * whose proxy base URL is the connected instance's hostname root — every path
 * therefore carries the `api/v4` prefix. Auth (`private-token` header) is
 * injected by the platform proxy.
 */
const API = 'api/v4';

const projectIdInput = z
  .string()
  .min(1)
  .describe('Project id: a numeric id or a path like "group/project" (URL-encoded automatically)');

const paginationInput = {
  page: z.number().int().min(1).optional().describe('Page number, starting at 1'),
  perPage: z.number().int().min(1).max(50).optional().describe('Results per page (1-50, GitLab default 20)'),
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** GitLab list endpoints return bare JSON arrays (no envelope). */
function listOf(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.map(asRecord) : [];
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const projectSchema = z.object({
  id: z.number(),
  pathWithNamespace: z.string(),
  name: z.string(),
  webUrl: z.string(),
  defaultBranch: z.string(),
  description: z.string().nullable(),
});

function shapeProject(project: Record<string, unknown>) {
  return {
    id: toNumber(project.id),
    pathWithNamespace: String(project.path_with_namespace ?? ''),
    name: String(project.name ?? ''),
    webUrl: String(project.web_url ?? ''),
    defaultBranch: String(project.default_branch ?? ''),
    description: typeof project.description === 'string' ? project.description : null,
  };
}

const issueSchema = z.object({
  iid: z.number(),
  title: z.string(),
  state: z.string(),
  webUrl: z.string(),
  labels: z.array(z.string()),
  updatedAt: z.string(),
});

function shapeIssue(issue: Record<string, unknown>) {
  return {
    iid: toNumber(issue.iid),
    title: String(issue.title ?? ''),
    state: String(issue.state ?? ''),
    webUrl: String(issue.web_url ?? ''),
    labels: toStringArray(issue.labels),
    updatedAt: String(issue.updated_at ?? ''),
  };
}

const mergeRequestSchema = z.object({
  iid: z.number(),
  title: z.string(),
  state: z.string(),
  webUrl: z.string(),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  draft: z.boolean(),
});

function shapeMergeRequest(mr: Record<string, unknown>) {
  return {
    iid: toNumber(mr.iid),
    title: String(mr.title ?? ''),
    state: String(mr.state ?? ''),
    webUrl: String(mr.web_url ?? ''),
    sourceBranch: String(mr.source_branch ?? ''),
    targetBranch: String(mr.target_branch ?? ''),
    draft: mr.draft === true,
  };
}

function projectPath(projectId: string): string {
  return `${API}/projects/${encodeURIComponent(projectId)}`;
}

/**
 * Curated GitLab toolset executing through the platform connection proxy.
 * The connection is a group access token, so tools operate within the
 * connected group. All tools resolve the connection from
 * `options.connectionId` or MASTRA_GITLAB_CONNECTION_ID at execute time.
 */
export function createGitlabTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    gitlab_list_projects: defineProxyTool(context, {
      id: 'gitlab_list_projects',
      description: 'List GitLab projects the connected group token can access.',
      inputSchema: z.object({
        search: z.string().optional().describe('Filter projects by name or path'),
        ...paginationInput,
      }),
      outputSchema: z.object({ projects: z.array(projectSchema), page: z.number(), perPage: z.number() }),
      request: input => ({
        method: 'GET',
        path: `${API}/projects`,
        query: { membership: 'true', search: input.search, page: input.page, per_page: input.perPage },
      }),
      transform: (raw, input) => ({
        projects: listOf(raw).map(shapeProject),
        page: input.page ?? 1,
        perPage: input.perPage ?? 20,
      }),
    }),

    gitlab_get_project: defineProxyTool(context, {
      id: 'gitlab_get_project',
      description: 'Get one GitLab project by numeric id or "group/project" path.',
      inputSchema: z.object({ projectId: projectIdInput }),
      outputSchema: projectSchema,
      request: input => ({ method: 'GET', path: projectPath(input.projectId) }),
      transform: raw => shapeProject(asRecord(raw)),
    }),

    gitlab_list_issues: defineProxyTool(context, {
      id: 'gitlab_list_issues',
      description: 'List issues of a GitLab project.',
      inputSchema: z.object({
        projectId: projectIdInput,
        state: z.enum(['opened', 'closed', 'all']).optional().describe('Filter by issue state (default opened)'),
        ...paginationInput,
      }),
      outputSchema: z.object({ issues: z.array(issueSchema), page: z.number(), perPage: z.number() }),
      request: input => ({
        method: 'GET',
        path: `${projectPath(input.projectId)}/issues`,
        query: { state: input.state ?? 'opened', page: input.page, per_page: input.perPage },
      }),
      transform: (raw, input) => ({
        issues: listOf(raw).map(shapeIssue),
        page: input.page ?? 1,
        perPage: input.perPage ?? 20,
      }),
    }),

    gitlab_create_issue: defineProxyTool(context, {
      id: 'gitlab_create_issue',
      description: 'Create an issue in a GitLab project.',
      inputSchema: z.object({
        projectId: projectIdInput,
        title: z.string().min(1).describe('Issue title'),
        description: z.string().optional().describe('Issue description (Markdown)'),
        labels: z.array(z.string()).optional().describe('Labels to attach'),
      }),
      outputSchema: issueSchema,
      request: input => ({
        method: 'POST',
        path: `${projectPath(input.projectId)}/issues`,
        body: { title: input.title, description: input.description, labels: input.labels?.join(',') },
      }),
      transform: raw => shapeIssue(asRecord(raw)),
    }),

    gitlab_update_issue: defineProxyTool(context, {
      id: 'gitlab_update_issue',
      description: 'Update an existing GitLab issue (title, description, labels, or open/close state).',
      inputSchema: z
        .object({
          projectId: projectIdInput,
          issueIid: z.number().int().min(1).describe('Issue iid (the per-project number shown in the URL)'),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          labels: z.array(z.string()).optional().describe('Replace the issue labels with this list'),
          stateEvent: z.enum(['close', 'reopen']).optional().describe('Close or reopen the issue'),
        })
        .refine(
          input =>
            input.title !== undefined ||
            input.description !== undefined ||
            input.labels !== undefined ||
            input.stateEvent !== undefined,
          { message: 'Provide at least one field to update (title, description, labels, or stateEvent).' },
        ),
      outputSchema: issueSchema,
      request: input => ({
        method: 'PUT',
        path: `${projectPath(input.projectId)}/issues/${input.issueIid}`,
        body: {
          title: input.title,
          description: input.description,
          labels: input.labels?.join(','),
          state_event: input.stateEvent,
        },
      }),
      transform: raw => shapeIssue(asRecord(raw)),
    }),

    gitlab_list_merge_requests: defineProxyTool(context, {
      id: 'gitlab_list_merge_requests',
      description: 'List merge requests of a GitLab project.',
      inputSchema: z.object({
        projectId: projectIdInput,
        state: z
          .enum(['opened', 'closed', 'merged', 'all'])
          .optional()
          .describe('Filter by merge request state (default opened)'),
        ...paginationInput,
      }),
      outputSchema: z.object({ mergeRequests: z.array(mergeRequestSchema), page: z.number(), perPage: z.number() }),
      request: input => ({
        method: 'GET',
        path: `${projectPath(input.projectId)}/merge_requests`,
        query: { state: input.state ?? 'opened', page: input.page, per_page: input.perPage },
      }),
      transform: (raw, input) => ({
        mergeRequests: listOf(raw).map(shapeMergeRequest),
        page: input.page ?? 1,
        perPage: input.perPage ?? 20,
      }),
    }),

    gitlab_get_merge_request: defineProxyTool(context, {
      id: 'gitlab_get_merge_request',
      description: 'Get one merge request of a GitLab project by its iid.',
      inputSchema: z.object({
        projectId: projectIdInput,
        mergeRequestIid: z.number().int().min(1).describe('Merge request iid (the number shown in the URL)'),
      }),
      outputSchema: mergeRequestSchema,
      request: input => ({
        method: 'GET',
        path: `${projectPath(input.projectId)}/merge_requests/${input.mergeRequestIid}`,
      }),
      transform: raw => shapeMergeRequest(asRecord(raw)),
    }),

    gitlab_create_mr_note: defineProxyTool(context, {
      id: 'gitlab_create_mr_note',
      description: 'Add a comment (note) to a GitLab merge request.',
      inputSchema: z.object({
        projectId: projectIdInput,
        mergeRequestIid: z.number().int().min(1).describe('Merge request iid (the number shown in the URL)'),
        body: z.string().min(1).describe('Comment text (Markdown)'),
      }),
      outputSchema: z.object({ id: z.number(), body: z.string(), createdAt: z.string(), authorName: z.string() }),
      request: input => ({
        method: 'POST',
        path: `${projectPath(input.projectId)}/merge_requests/${input.mergeRequestIid}/notes`,
        body: { body: input.body },
      }),
      transform: raw => {
        const note = asRecord(raw);
        return {
          id: toNumber(note.id),
          body: String(note.body ?? ''),
          createdAt: String(note.created_at ?? ''),
          authorName: String(asRecord(note.author).name ?? ''),
        };
      },
    }),

    gitlab_get_file: defineProxyTool(context, {
      id: 'gitlab_get_file',
      description:
        'Read a file from a GitLab repository at a ref. Returns the file contents decoded as UTF-8 text (binary files may contain replacement characters).',
      inputSchema: z.object({
        projectId: projectIdInput,
        filePath: z.string().min(1).describe('File path within the repository, e.g. "src/index.ts"'),
        ref: z.string().min(1).describe('Branch, tag, or commit SHA'),
      }),
      outputSchema: z.object({
        fileName: z.string(),
        filePath: z.string(),
        ref: z.string(),
        size: z.number(),
        encoding: z.string(),
        text: z.string(),
      }),
      request: input => ({
        method: 'GET',
        path: `${projectPath(input.projectId)}/repository/files/${encodeURIComponent(input.filePath)}`,
        query: { ref: input.ref },
      }),
      transform: (raw, input) => {
        const file = asRecord(raw);
        const content = typeof file.content === 'string' ? file.content : '';
        return {
          fileName: String(file.file_name ?? ''),
          filePath: String(file.file_path ?? input.filePath),
          ref: String(file.ref ?? input.ref),
          size: toNumber(file.size),
          encoding: String(file.encoding ?? 'base64'),
          text: Buffer.from(content, 'base64').toString('utf8'),
        };
      },
    }),

    gitlab_list_pipelines: defineProxyTool(context, {
      id: 'gitlab_list_pipelines',
      description: 'List CI/CD pipelines of a GitLab project.',
      inputSchema: z.object({
        projectId: projectIdInput,
        ref: z.string().optional().describe('Filter by branch/tag ref'),
        status: z
          .enum([
            'created',
            'waiting_for_resource',
            'preparing',
            'pending',
            'running',
            'success',
            'failed',
            'canceled',
            'skipped',
            'manual',
            'scheduled',
          ])
          .optional()
          .describe('Filter by pipeline status'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        pipelines: z.array(
          z.object({ id: z.number(), status: z.string(), ref: z.string(), webUrl: z.string(), createdAt: z.string() }),
        ),
        page: z.number(),
        perPage: z.number(),
      }),
      request: input => ({
        method: 'GET',
        path: `${projectPath(input.projectId)}/pipelines`,
        query: { ref: input.ref, status: input.status, page: input.page, per_page: input.perPage },
      }),
      transform: (raw, input) => ({
        pipelines: listOf(raw).map(pipeline => ({
          id: toNumber(pipeline.id),
          status: String(pipeline.status ?? ''),
          ref: String(pipeline.ref ?? ''),
          webUrl: String(pipeline.web_url ?? ''),
          createdAt: String(pipeline.created_at ?? ''),
        })),
        page: input.page ?? 1,
        perPage: input.perPage ?? 20,
      }),
    }),
  };

  return applyAllowTools(tools, options?.allowTools);
}
