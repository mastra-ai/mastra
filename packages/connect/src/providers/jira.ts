import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_JIRA_CONNECTION_ID';

/**
 * Nango's `jira` provider proxies to the bare `https://api.atlassian.com`
 * origin (the Atlassian cloud id is NOT templated into the base URL), so
 * every Jira REST call must be prefixed with `ex/jira/{cloudId}`. Tools take
 * a `cloudId` input; `jira_get_accessible_resources` discovers it.
 */
const cloudIdInput = z
  .string()
  .describe('Atlassian cloud id of the Jira site (discover it with jira_get_accessible_resources)');

function jiraPath(cloudId: string, rest: string): string {
  return `ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/${rest}`;
}

const paginationInput = {
  limit: z.number().int().min(1).max(50).optional().describe('Max results to return (1-50, default 25)'),
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Wraps plain text in a minimal Atlassian Document Format (ADF) document. */
function adfDocument(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

/** Flattens an ADF node tree to plain text. */
function adfText(node: unknown): string {
  const record = asRecord(node);
  if (record.type === 'text' && typeof record.text === 'string') return record.text;
  if (Array.isArray(record.content)) {
    const inner = record.content.map(adfText).join('');
    return record.type === 'paragraph' ? `${inner}\n` : inner;
  }
  return '';
}

const issueSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  assignee: z.string().nullable(),
  priority: z.string().nullable(),
  issueType: z.string(),
  created: z.string(),
  updated: z.string(),
});

const ISSUE_FIELDS = ['summary', 'status', 'assignee', 'priority', 'issuetype', 'created', 'updated'];

function shapeIssue(issue: Record<string, unknown>) {
  const fields = asRecord(issue.fields);
  const assignee = asRecord(fields.assignee);
  const priority = asRecord(fields.priority);
  return {
    id: String(issue.id ?? ''),
    key: String(issue.key ?? ''),
    summary: String(fields.summary ?? ''),
    status: String(asRecord(fields.status).name ?? ''),
    assignee: typeof assignee.displayName === 'string' ? assignee.displayName : null,
    priority: typeof priority.name === 'string' ? priority.name : null,
    issueType: String(asRecord(fields.issuetype).name ?? ''),
    created: String(fields.created ?? ''),
    updated: String(fields.updated ?? ''),
  };
}

/**
 * Curated Jira Cloud toolset executing through the platform connection proxy.
 * All tools resolve the connection from `options.connectionId` or
 * MASTRA_JIRA_CONNECTION_ID at execute time.
 */
export function createJiraTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    jira_get_accessible_resources: defineProxyTool(context, {
      id: 'jira_get_accessible_resources',
      description:
        'List the Jira sites accessible to this connection, with their cloud ids. Call this first: every other jira_* tool needs a cloudId.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        sites: z.array(z.object({ cloudId: z.string(), name: z.string(), url: z.string() })),
      }),
      request: () => ({ method: 'GET', path: 'oauth/token/accessible-resources' }),
      transform: raw => ({
        sites: (Array.isArray(raw) ? raw.map(asRecord) : []).map(site => ({
          cloudId: String(site.id ?? ''),
          name: String(site.name ?? ''),
          url: String(site.url ?? ''),
        })),
      }),
    }),

    jira_search_issues: defineProxyTool(context, {
      id: 'jira_search_issues',
      description: 'Search Jira issues with a JQL query (e.g. \'project = ENG AND status = "In Progress"\').',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        jql: z.string().describe('JQL query string'),
        nextPageToken: z.string().optional().describe('Pagination token from a previous page'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        issues: z.array(issueSchema),
        nextPageToken: z.string().nullable(),
      }),
      request: input => ({
        method: 'POST',
        path: jiraPath(input.cloudId, 'search/jql'),
        body: {
          jql: input.jql,
          maxResults: input.limit ?? 25,
          nextPageToken: input.nextPageToken,
          fields: ISSUE_FIELDS,
        },
      }),
      transform: raw => {
        const data = asRecord(raw);
        return {
          issues: (Array.isArray(data.issues) ? data.issues.map(asRecord) : []).map(shapeIssue),
          nextPageToken: typeof data.nextPageToken === 'string' ? data.nextPageToken : null,
        };
      },
    }),

    jira_get_issue: defineProxyTool(context, {
      id: 'jira_get_issue',
      description: 'Get a Jira issue by key (e.g. "ENG-123"), including its plain-text description.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        issueKey: z.string().describe('Issue key like "ENG-123"'),
      }),
      outputSchema: z.object({ issue: issueSchema.extend({ description: z.string() }) }),
      request: input => ({
        method: 'GET',
        path: jiraPath(input.cloudId, `issue/${encodeURIComponent(input.issueKey)}`),
        query: { fields: `${ISSUE_FIELDS.join(',')},description` },
      }),
      transform: raw => {
        const issue = asRecord(raw);
        return {
          issue: { ...shapeIssue(issue), description: adfText(asRecord(issue.fields).description).trim() },
        };
      },
    }),

    jira_create_issue: defineProxyTool(context, {
      id: 'jira_create_issue',
      description:
        'Create a Jira issue. The description is plain text and is wrapped into Atlassian Document Format automatically. Issue types are referenced by name, which works for classic projects; team-managed projects that require issue type ids are not supported.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        projectKey: z.string().describe('Project key (e.g. "ENG")'),
        summary: z.string().describe('Issue summary (title)'),
        issueType: z.string().describe('Issue type name (e.g. "Task", "Bug", "Story")'),
        description: z.string().optional().describe('Plain-text description'),
        assigneeAccountId: z.string().optional().describe('Atlassian account id of the assignee'),
        labels: z.array(z.string()).optional().describe('Labels to apply'),
        priority: z.string().optional().describe('Priority name (e.g. "High")'),
      }),
      outputSchema: z.object({ issue: z.object({ id: z.string(), key: z.string() }) }),
      request: input => ({
        method: 'POST',
        path: jiraPath(input.cloudId, 'issue'),
        body: {
          fields: {
            project: { key: input.projectKey },
            summary: input.summary,
            issuetype: { name: input.issueType },
            description: input.description ? adfDocument(input.description) : undefined,
            assignee: input.assigneeAccountId ? { id: input.assigneeAccountId } : undefined,
            labels: input.labels,
            priority: input.priority ? { name: input.priority } : undefined,
          },
        },
      }),
      transform: raw => {
        const data = asRecord(raw);
        return { issue: { id: String(data.id ?? ''), key: String(data.key ?? '') } };
      },
    }),

    jira_update_issue: defineProxyTool(context, {
      id: 'jira_update_issue',
      description:
        'Update fields of a Jira issue (summary, plain-text description, assignee, labels, or priority). Use jira_transition_issue to change status.',
      inputSchema: z
        .object({
          cloudId: cloudIdInput,
          issueKey: z.string().describe('Issue key like "ENG-123"'),
          summary: z.string().min(1).optional().describe('New summary'),
          description: z.string().min(1).optional().describe('New plain-text description'),
          assigneeAccountId: z.string().min(1).optional().describe('Atlassian account id of the new assignee'),
          labels: z.array(z.string()).optional().describe('Replacement labels'),
          priority: z.string().min(1).optional().describe('New priority name'),
        })
        .refine(
          input =>
            input.summary !== undefined ||
            input.description !== undefined ||
            input.assigneeAccountId !== undefined ||
            input.labels !== undefined ||
            input.priority !== undefined,
          { message: 'Provide at least one field to update.' },
        ),
      outputSchema: z.object({ updated: z.boolean() }),
      request: input => ({
        method: 'PUT',
        path: jiraPath(input.cloudId, `issue/${encodeURIComponent(input.issueKey)}`),
        body: {
          fields: {
            summary: input.summary,
            description: input.description ? adfDocument(input.description) : undefined,
            assignee: input.assigneeAccountId ? { id: input.assigneeAccountId } : undefined,
            labels: input.labels,
            priority: input.priority ? { name: input.priority } : undefined,
          },
        },
      }),
      transform: () => ({ updated: true }),
    }),

    jira_list_transitions: defineProxyTool(context, {
      id: 'jira_list_transitions',
      description: 'List the workflow transitions currently available for a Jira issue.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        issueKey: z.string().describe('Issue key like "ENG-123"'),
      }),
      outputSchema: z.object({
        transitions: z.array(z.object({ id: z.string(), name: z.string(), toStatus: z.string() })),
      }),
      request: input => ({
        method: 'GET',
        path: jiraPath(input.cloudId, `issue/${encodeURIComponent(input.issueKey)}/transitions`),
      }),
      transform: raw => {
        const data = asRecord(raw);
        return {
          transitions: (Array.isArray(data.transitions) ? data.transitions.map(asRecord) : []).map(transition => ({
            id: String(transition.id ?? ''),
            name: String(transition.name ?? ''),
            toStatus: String(asRecord(transition.to).name ?? ''),
          })),
        };
      },
    }),

    jira_transition_issue: defineProxyTool(context, {
      id: 'jira_transition_issue',
      description:
        'Move a Jira issue through a workflow transition (changes its status). Get valid transition ids from jira_list_transitions.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        issueKey: z.string().describe('Issue key like "ENG-123"'),
        transitionId: z.string().describe('Transition id (from jira_list_transitions)'),
      }),
      outputSchema: z.object({ transitioned: z.boolean() }),
      request: input => ({
        method: 'POST',
        path: jiraPath(input.cloudId, `issue/${encodeURIComponent(input.issueKey)}/transitions`),
        body: { transition: { id: input.transitionId } },
      }),
      transform: () => ({ transitioned: true }),
    }),

    jira_add_comment: defineProxyTool(context, {
      id: 'jira_add_comment',
      description: 'Add a comment to a Jira issue. Plain text is wrapped into Atlassian Document Format automatically.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        issueKey: z.string().describe('Issue key like "ENG-123"'),
        body: z.string().describe('Comment text (plain text)'),
      }),
      outputSchema: z.object({ comment: z.object({ id: z.string(), created: z.string() }) }),
      request: input => ({
        method: 'POST',
        path: jiraPath(input.cloudId, `issue/${encodeURIComponent(input.issueKey)}/comment`),
        body: { body: adfDocument(input.body) },
      }),
      transform: raw => {
        const data = asRecord(raw);
        return { comment: { id: String(data.id ?? ''), created: String(data.created ?? '') } };
      },
    }),

    jira_list_comments: defineProxyTool(context, {
      id: 'jira_list_comments',
      description: 'List comments on a Jira issue as plain text.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        issueKey: z.string().describe('Issue key like "ENG-123"'),
        startAt: z.number().int().min(0).optional().describe('Offset for pagination (default 0)'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        comments: z.array(z.object({ id: z.string(), author: z.string(), body: z.string(), created: z.string() })),
        total: z.number(),
      }),
      request: input => ({
        method: 'GET',
        path: jiraPath(input.cloudId, `issue/${encodeURIComponent(input.issueKey)}/comment`),
        query: { startAt: input.startAt, maxResults: input.limit ?? 25 },
      }),
      transform: raw => {
        const data = asRecord(raw);
        return {
          comments: (Array.isArray(data.comments) ? data.comments.map(asRecord) : []).map(comment => ({
            id: String(comment.id ?? ''),
            author: String(asRecord(comment.author).displayName ?? ''),
            body: adfText(comment.body).trim(),
            created: String(comment.created ?? ''),
          })),
          total: typeof data.total === 'number' ? data.total : 0,
        };
      },
    }),

    jira_list_projects: defineProxyTool(context, {
      id: 'jira_list_projects',
      description: 'List Jira projects in the site, optionally filtered by a name/key query.',
      inputSchema: z.object({
        cloudId: cloudIdInput,
        query: z.string().optional().describe('Filter projects by name or key'),
        startAt: z.number().int().min(0).optional().describe('Offset for pagination (default 0)'),
        ...paginationInput,
      }),
      outputSchema: z.object({
        projects: z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })),
        total: z.number(),
        isLast: z.boolean(),
      }),
      request: input => ({
        method: 'GET',
        path: jiraPath(input.cloudId, 'project/search'),
        query: { query: input.query, startAt: input.startAt, maxResults: input.limit ?? 25 },
      }),
      transform: raw => {
        const data = asRecord(raw);
        return {
          projects: (Array.isArray(data.values) ? data.values.map(asRecord) : []).map(project => ({
            id: String(project.id ?? ''),
            key: String(project.key ?? ''),
            name: String(project.name ?? ''),
          })),
          total: typeof data.total === 'number' ? data.total : 0,
          isLast: data.isLast === true,
        };
      },
    }),
  } satisfies ToolsInput;

  return applyAllowTools(tools, options?.allowTools);
}
