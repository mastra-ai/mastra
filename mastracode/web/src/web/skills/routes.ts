import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { formatSkillActivation } from '@mastra/core/workspace';
import type { Workspace } from '@mastra/core/workspace';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';

import type { MastraCodeState } from '@mastra/code-sdk/schema';

import { ensureWebAuthUser, isWebAuthEnabled, webAuthTenant } from '../auth';
import { getAppDb } from '../github/db';
import { githubWorktrees } from '../github/schema';

const MAX_RESOURCE_ID_LENGTH = 512;
const MAX_SCOPE_LENGTH = 2048;
const MAX_ARGUMENTS_LENGTH = 16_384;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface SkillInvocationBody {
  resourceId: string;
  scope?: string;
  name: string;
  arguments?: string;
}

interface SessionAuthorizationResult {
  allowed: boolean;
  status?: 401 | 403;
  code?: 'unauthorized' | 'session_forbidden';
  message?: string;
}

interface SkillSession {
  getWorkspace(): Workspace;
  sendMessage(input: { content: string }): Promise<unknown>;
}

export interface BuildSkillRoutesDeps {
  controllerId: string;
  controller: Pick<AgentController<MastraCodeState>, 'getSessionByResource'>;
  authorizeSessionAddress?: (
    context: Context,
    address: { resourceId: string; scope?: string },
  ) => Promise<SessionAuthorizationResult>;
}

function loose(context: unknown): Context {
  return context as Context;
}

function escapeSkillBoundary(value: string): string {
  return value.replaceAll('</skill>', '&lt;/skill&gt;');
}

function parseBody(value: unknown): SkillInvocationBody | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.resourceId !== 'string' || input.resourceId.length === 0) return undefined;
  if (input.resourceId.length > MAX_RESOURCE_ID_LENGTH) return undefined;
  if (input.scope !== undefined && (typeof input.scope !== 'string' || input.scope.length > MAX_SCOPE_LENGTH)) {
    return undefined;
  }
  if (typeof input.name !== 'string' || input.name.length > 64 || !SKILL_NAME_RE.test(input.name)) return undefined;
  if (input.arguments !== undefined) {
    if (typeof input.arguments !== 'string' || input.arguments.length > MAX_ARGUMENTS_LENGTH) return undefined;
  }
  return {
    resourceId: input.resourceId,
    ...(input.scope ? { scope: input.scope } : {}),
    name: input.name,
    ...(input.arguments !== undefined ? { arguments: input.arguments } : {}),
  };
}

async function authorizeSessionAddress(
  context: Context,
  address: { resourceId: string; scope?: string },
): Promise<SessionAuthorizationResult> {
  if (!isWebAuthEnabled()) return { allowed: true };

  await ensureWebAuthUser(context);
  const tenant = webAuthTenant(context);
  if (!tenant) {
    return { allowed: false, status: 401, code: 'unauthorized', message: 'Authentication required.' };
  }

  // Personal sessions are keyed by the authenticated WorkOS user id. Their
  // scope is a client-managed local/user-session worktree and needs no app DB.
  if (address.resourceId === tenant.userId) return { allowed: true };

  // Factory sessions are keyed by githubProjectId and scoped to a worktree that
  // is owned by the current org user. Never accept an arbitrary resource/scope.
  if (!tenant.orgId || !address.scope) {
    return { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
  }
  const rows = await getAppDb()
    .select({ id: githubWorktrees.id })
    .from(githubWorktrees)
    .where(
      and(
        eq(githubWorktrees.orgId, tenant.orgId),
        eq(githubWorktrees.userId, tenant.userId),
        eq(githubWorktrees.githubProjectId, address.resourceId),
        eq(githubWorktrees.worktreePath, address.scope),
      ),
    );
  return rows.length > 0
    ? { allowed: true }
    : { allowed: false, status: 403, code: 'session_forbidden', message: 'Session access denied.' };
}

export function buildSkillRoutes({
  controllerId,
  controller,
  authorizeSessionAddress: authorize = authorizeSessionAddress,
}: BuildSkillRoutesDeps): ApiRoute[] {
  return [
    registerApiRoute('/web/agent-controller/:controllerId/skills/invoke', {
      method: 'POST',
      requiresAuth: false,
      handler: async context => {
        const c = loose(context);
        if (c.req.param('controllerId') !== controllerId) {
          return c.json({ error: 'controller_not_found', message: 'Agent controller not found.' }, 404);
        }

        let rawBody: unknown;
        try {
          rawBody = await c.req.json();
        } catch {
          return c.json({ error: 'invalid_request', message: 'Invalid JSON body.' }, 400);
        }
        const body = parseBody(rawBody);
        if (!body) {
          return c.json({ error: 'invalid_request', message: 'Invalid skill invocation request.' }, 400);
        }

        const authorization = await authorize(c, { resourceId: body.resourceId, scope: body.scope });
        if (!authorization.allowed) {
          return c.json({ error: authorization.code, message: authorization.message }, authorization.status ?? 403);
        }

        const session = (await controller.getSessionByResource(body.resourceId, body.scope)) as
          | SkillSession
          | undefined;
        if (!session) {
          return c.json({ error: 'session_not_found', message: 'Agent controller session not found.' }, 404);
        }

        const skills = session.getWorkspace().skills;
        await skills?.maybeRefresh();
        const skill = await skills?.get(body.name);
        if (!skill || skill['user-invocable'] === false) {
          return c.json({ error: 'skill_not_found', message: `Skill not found: ${body.name}.` }, 404);
        }

        const args = body.arguments?.trim();
        const content = `${formatSkillActivation(skill)}${args ? `\n\nARGUMENTS: ${args}` : ''}`.trim();
        const message = `<skill name="${skill.name}">\n${escapeSkillBoundary(content)}\n</skill>`;
        await session.sendMessage({ content: message });
        return c.json({ ok: true, skill: skill.name, message });
      },
    }),
  ];
}
