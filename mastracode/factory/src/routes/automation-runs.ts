import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { FactoryRules } from '../rules/types.js';
import { isFactoryRole } from '../rules/types.js';
import { FactoryRuleValidationError, validateFactoryRuleDecision } from '../rules/validation.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { RouteAuth } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set(['requestId', 'expectedRevision', 'role', 'skillName', 'arguments']);

interface AutomationRunRequest {
  requestId: string;
  expectedRevision: number;
  role: string;
  skillName: string;
  arguments?: string;
}

export interface AutomationRunRoutesDeps {
  auth: RouteAuth;
  audit: AuditEmitter;
  projects: FactoryProjectsStorage;
  workItems: WorkItemsStorage;
  rules: FactoryRules;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAutomationRunRequest(body: unknown): AutomationRunRequest | null {
  if (!isRecord(body) || Object.keys(body).some(key => !ALLOWED_KEYS.has(key))) return null;
  if (typeof body.requestId !== 'string' || !UUID_RE.test(body.requestId)) return null;
  if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 1) return null;
  if (typeof body.role !== 'string' || !isFactoryRole(body.role)) return null;
  if (typeof body.skillName !== 'string' || body.skillName.trim().length === 0) return null;
  if (body.arguments !== undefined && typeof body.arguments !== 'string') return null;
  return {
    requestId: body.requestId,
    expectedRevision: Number(body.expectedRevision),
    role: body.role,
    skillName: body.skillName.trim(),
    ...(body.arguments !== undefined ? { arguments: body.arguments } : {}),
  };
}

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

async function resolveProject(
  c: Context,
  deps: Pick<AutomationRunRoutesDeps, 'auth' | 'projects'>,
): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
  let orgId: string;
  let userId: string;

  if (deps.auth.enabled()) {
    await deps.auth.ensureUser(c);
    const tenant = deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'The Factory board requires an organization.' },
          403,
        ),
      };
    }
    if (!(await deps.auth.isOrganizationAdmin(c, tenant.orgId))) {
      return {
        response: c.json(
          { error: 'forbidden', message: 'Organization administrator access is required for automation ingress.' },
          403,
        ),
      };
    }
    orgId = tenant.orgId;
    userId = tenant.userId;
  } else {
    // Match Factory's existing no-auth storage scope. This keeps the trusted
    // loopback/self-hosted controller path usable without inventing a fake user.
    orgId = 'local';
    userId = 'local';
  }

  const projectId = c.req.param('id');
  if (!projectId || !UUID_RE.test(projectId)) return { response: c.json({ error: 'Project not found' }, 404) };
  await deps.projects.ensureReady();
  const project = await deps.projects.get({ orgId, id: projectId });
  if (!project) return { response: c.json({ error: 'Project not found' }, 404) };
  return { orgId, userId, factoryProjectId: projectId };
}

/**
 * Constrained durable ingress for a trusted external orchestrator.
 *
 * Local/no-auth deployments may call this through their trusted loopback
 * boundary. In tenant mode the caller must be an organization administrator.
 * The caller may enqueue exactly one validated invokeSkill decision for an
 * existing work item. It cannot move the board, send arbitrary messages, stamp
 * human consent, or create a source-control session. Those responsibilities stay
 * with Factory's rule store and FactoryDecisionDispatcher.
 */
export function buildAutomationRunRoutes(deps: AutomationRunRoutesDeps): ApiRoute[] {
  return [
    registerApiRoute('/web/factory/projects/:id/work-items/:workItemId/automation-runs', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const context = c as Context;
        const resolved = await resolveProject(context, deps);
        if ('response' in resolved) return resolved.response;

        const workItemId = context.req.param('workItemId');
        if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);

        const parsed = parseAutomationRunRequest(await readJson(context));
        if (!parsed) return c.json({ error: 'invalid_automation_run_request' }, 400);

        await deps.workItems.ensureReady();
        const item = await deps.workItems.getForProject(resolved.orgId, resolved.factoryProjectId, workItemId);
        if (!item) return c.json({ error: 'Work item not found' }, 404);

        const ingressIdentity = `external-orchestrator:${parsed.requestId}`;
        let decision: Record<string, unknown>;
        try {
          decision = {
            ...validateFactoryRuleDecision({
              type: 'invokeSkill',
              idempotencyKey: `${ingressIdentity}:invoke-skill`,
              role: parsed.role,
              skillName: parsed.skillName,
              ...(parsed.arguments !== undefined ? { arguments: parsed.arguments } : {}),
            }),
          };
        } catch (error) {
          if (error instanceof FactoryRuleValidationError) {
            return c.json({ error: error.code, message: error.message }, 400);
          }
          throw error;
        }
        if (decision.type !== 'invokeSkill') return c.json({ error: 'invalid_automation_run_request' }, 400);

        const committed = await deps.workItems.commitRuleEvaluation({
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          workItemId,
          ingress: { identity: ingressIdentity, triggerType: 'external-orchestrator.invoke-skill' },
          ruleSetVersion: deps.rules.version,
          expectedRevision: parsed.expectedRevision,
          actor: { type: 'system', id: 'factory-external-orchestrator' },
          outcome: { status: 'accepted' },
          decisions: [decision],
          causalChain: [],
          now: new Date(),
        });

        if (committed.status === 'missing') return c.json({ error: 'Work item not found' }, 404);
        const result = committed.result;
        const rejected = result.status === 'rejected';

        await deps.audit.emit({
          context,
          input: {
            action: rejected ? 'factory.automation_run.rejected' : 'factory.automation_run.queued',
            factoryProjectId: resolved.factoryProjectId,
            targets: [{ type: 'work_item', id: workItemId, name: item.title }],
            metadata: {
              requestId: parsed.requestId,
              role: parsed.role,
              skillName: parsed.skillName,
              commitStatus: committed.status,
              resultStatus: result.status,
              ...(typeof result.code === 'string' ? { code: result.code } : {}),
            },
          },
        });

        if (rejected) return c.json({ status: committed.status, result }, result.code === 'stale' ? 409 : 422);
        return c.json({ status: committed.status, result }, committed.status === 'replayed' ? 200 : 202);
      },
    }),
  ];
}
