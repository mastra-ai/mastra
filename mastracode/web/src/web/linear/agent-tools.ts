/**
 * Linear tools exposed to the coding agent.
 *
 * Wired into the agent through the SDK's async `extraTools` provider: on each
 * tool-set resolution we map the session's resourceId (which is the GitHub
 * project id in the web app) to its owning WorkOS org and only expose the
 * Linear tools when that org has a Linear connection. Projects whose org never
 * connected Linear (or when the feature is disabled) see no Linear tools at
 * all — the model is never shown tools it can't use.
 *
 * Tenancy mirrors the Linear API routes: everything is scoped by the org that
 * owns the project, and tokens are refreshed through the same shared
 * connection helpers the routes use.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getAppDb } from '../github/db';
import { githubProjects } from '../github/schema';
import { createLinearIssueComment, fetchLinearIssueDetail } from './client';
import { isLinearFeatureEnabled } from './config';
import { getFreshLinearAccessToken, LinearReauthRequiredError, loadLinearConnection } from './connection';

/**
 * A project's org never changes, so the resourceId → orgId mapping is cached
 * forever. `null` marks resource ids that aren't GitHub projects (e.g. local
 * default resources) so we don't re-query them on every tool-set resolution.
 */
const orgIdByResourceId = new Map<string, string | null>();

/** Re-check "is Linear connected" for an org at most this often. */
const CONNECTION_TTL_MS = 60_000;
const connectionCheckByOrg = new Map<string, { connected: boolean; checkedAt: number }>();

async function resolveOrgId(resourceId: string): Promise<string | null> {
  const cached = orgIdByResourceId.get(resourceId);
  if (cached !== undefined) return cached;
  let orgId: string | null = null;
  try {
    const [row] = await getAppDb()
      .select({ orgId: githubProjects.orgId })
      .from(githubProjects)
      .where(eq(githubProjects.id, resourceId));
    orgId = row?.orgId ?? null;
  } catch {
    // Non-UUID resource ids (local/dev resources) make the uuid comparison
    // throw — treat them as "not a project" rather than failing tool resolution.
    orgId = null;
  }
  orgIdByResourceId.set(resourceId, orgId);
  return orgId;
}

async function isLinearConnected(orgId: string): Promise<boolean> {
  const cached = connectionCheckByOrg.get(orgId);
  if (cached && Date.now() - cached.checkedAt < CONNECTION_TTL_MS) return cached.connected;
  const connected = (await loadLinearConnection(orgId)) !== null;
  connectionCheckByOrg.set(orgId, { connected, checkedAt: Date.now() });
  return connected;
}

/** Test hook: clear the org/connection caches between specs. */
export function clearLinearAgentToolCaches(): void {
  orgIdByResourceId.clear();
  connectionCheckByOrg.clear();
}

/**
 * Drop the cached connection check for an org. Called by the OAuth callback
 * after a connection is persisted so the tools show up on the very next run
 * instead of after the TTL lapses.
 */
export function invalidateLinearConnectionCache(orgId: string): void {
  connectionCheckByOrg.delete(orgId);
}

function createLinearGetIssueTool(orgId: string) {
  return createTool({
    id: 'linear_get_issue',
    description:
      "Fetch a Linear issue's full details — title, description, state, assignee, labels, priority, and discussion comments. Use this whenever you're working on a Linear issue (e.g. ENG-123) to get its complete context.",
    inputSchema: z.object({
      issue: z.string().min(1).describe('The Linear issue identifier (e.g. "ENG-123") or issue UUID.'),
    }),
    execute: async ({ issue }: { issue: string }) => {
      const connection = await loadLinearConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this project. Connect Linear in Settings to fetch issues.' };
      }
      try {
        const accessToken = await getFreshLinearAccessToken(connection);
        const detail = await fetchLinearIssueDetail(accessToken, issue.trim());
        if (!detail) {
          return { error: `Linear issue "${issue}" was not found in this workspace.` };
        }
        return detail;
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to fetch Linear issue: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}

function createLinearCommentTool(orgId: string) {
  return createTool({
    id: 'linear_create_comment',
    description:
      'Post a comment on a Linear issue (e.g. to report investigation findings, link a PR, or ask a clarifying question). The comment is posted as the connected Linear integration, so make clear it comes from the agent.',
    inputSchema: z.object({
      issue: z.string().min(1).describe('The Linear issue identifier (e.g. "ENG-123") or issue UUID.'),
      body: z.string().min(1).describe('The comment body, as Linear-flavored markdown.'),
    }),
    execute: async ({ issue, body }: { issue: string; body: string }) => {
      const connection = await loadLinearConnection(orgId);
      if (!connection) {
        return { error: 'Linear is not connected for this project. Connect Linear in Settings to post comments.' };
      }
      try {
        const accessToken = await getFreshLinearAccessToken(connection);
        const comment = await createLinearIssueComment(accessToken, issue.trim(), body);
        if (!comment) {
          return { error: `Linear issue "${issue}" was not found in this workspace.` };
        }
        return { posted: true, url: comment.url };
      } catch (err) {
        if (err instanceof LinearReauthRequiredError) {
          return { error: err.message };
        }
        return { error: `Failed to post Linear comment: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  });
}

/**
 * Async `extraTools` provider: expose Linear tools only when the session's
 * project belongs to an org with an active Linear connection.
 */
export async function buildLinearAgentTools({
  requestContext,
}: {
  requestContext: RequestContext;
}): Promise<Record<string, ReturnType<typeof createLinearGetIssueTool> | ReturnType<typeof createLinearCommentTool>>> {
  if (!isLinearFeatureEnabled()) return {};

  const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const resourceId = ctx?.resourceId;
  if (!resourceId) return {};

  const orgId = await resolveOrgId(resourceId);
  if (!orgId) return {};
  if (!(await isLinearConnected(orgId))) return {};

  return {
    linear_get_issue: createLinearGetIssueTool(orgId),
    linear_create_comment: createLinearCommentTool(orgId),
  };
}
