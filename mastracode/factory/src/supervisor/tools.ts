import { randomUUID } from 'node:crypto';

import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { FactoryAuthUser } from '../auth.js';
import { getFactoryAuthOrgId, getFactoryAuthUserId } from '../auth.js';
import type { IntegrationTools } from '../integrations/base.js';
import type { AuditAgentEmitter } from '../storage/domains/audit/domain.js';
import type { FactoryRunBindingRecord, WorkItemRow } from '../storage/domains/work-items/base.js';
import { factorySupervisorThreadId } from './service.js';
import type { FactorySupervisorService } from './service.js';
import { supervisorApprovalSummary } from './state.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_RE);
const workItemInputSchema = z.object({ workItemId: uuidSchema }).strict();
const pendingApprovalInputSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict();
const signalInputSchema = z
  .object({
    workItemId: uuidSchema,
    role: z.string().trim().min(1).max(64).optional(),
    message: z.string().trim().min(1).max(4_000),
  })
  .strict();
const resolveApprovalInputSchema = z
  .object({
    approvalId: uuidSchema,
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

interface SupervisorContext {
  orgId: string;
  userId: string;
  userName?: string;
  factoryProjectId: string;
  threadId: string;
}

function resolveSupervisorContext(requestContext: RequestContext | undefined): SupervisorContext | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const controller = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const user = requestContext.get('user') as FactoryAuthUser | undefined;
  const state = controller?.getState();
  const orgId = getFactoryAuthOrgId(user);
  const userId = getFactoryAuthUserId(user);
  const factoryProjectId = state?.factoryProjectId;
  if (
    !controller?.threadId ||
    !orgId ||
    !userId ||
    !factoryProjectId ||
    state.factoryOrgId !== orgId ||
    (state.factorySupervisor !== true && state.factorySupervisor !== 'true') ||
    controller.resourceId !== factoryProjectId ||
    controller.threadId !== factorySupervisorThreadId(factoryProjectId)
  ) {
    return null;
  }
  return {
    orgId,
    userId,
    ...(typeof user?.name === 'string' && user.name.trim() ? { userName: user.name.trim().slice(0, 128) } : {}),
    factoryProjectId,
    threadId: controller.threadId,
  };
}

function itemSummary(item: WorkItemRow, approvals: Awaited<ReturnType<FactorySupervisorService['approvals']['list']>>) {
  return {
    id: item.id,
    title: item.title,
    board: item.externalSource?.type === 'pull-request' ? 'review' : 'work',
    stages: item.stages,
    stageHistory: item.stageHistory,
    revision: item.revision,
    parentWorkItemId: item.parentWorkItemId,
    sessionRoles: Object.keys(item.sessions).sort(),
    approvals: approvals.map(approval => supervisorApprovalSummary(approval)),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function selectBinding(bindings: FactoryRunBindingRecord[], role: string | undefined): FactoryRunBindingRecord | null {
  const eligible = bindings.filter(binding => binding.status === 'active' && (!role || binding.role === role));
  return eligible.at(-1) ?? null;
}

export async function createFactorySupervisorTools(options: {
  requestContext: RequestContext;
  service: FactorySupervisorService;
  audit: AuditAgentEmitter;
}): Promise<IntegrationTools> {
  const context = resolveSupervisorContext(options.requestContext);
  if (!context) return {};
  await options.service.requireProject(context);

  return {
    factory_get_state: createTool({
      id: 'factory_get_state',
      description: 'Get bounded live counts by board and stage plus pending transition approvals for this Factory.',
      inputSchema: z.object({}).strict(),
      execute: async (_input, execution) => {
        const current = resolveSupervisorContext(execution.requestContext);
        if (!current || current.factoryProjectId !== context.factoryProjectId) {
          throw new Error('Factory supervisor session is no longer canonical.');
        }
        return options.service.getState(current);
      },
    }),
    factory_get_work_item: createTool({
      id: 'factory_get_work_item',
      description: 'Get one work item in this Factory with bounded stage, history, session-role, and approval details.',
      inputSchema: workItemInputSchema,
      execute: async ({ workItemId }, execution) => {
        const current = resolveSupervisorContext(execution.requestContext);
        if (!current || current.factoryProjectId !== context.factoryProjectId) {
          throw new Error('Factory supervisor session is no longer canonical.');
        }
        const item = await options.service.workItems.getForProject(current.orgId, current.factoryProjectId, workItemId);
        if (!item) throw new Error('Factory work item not found.');
        const approvals = await options.service.approvals.list({
          orgId: current.orgId,
          factoryProjectId: current.factoryProjectId,
        });
        return itemSummary(item, approvals.filter(approval => approval.workItemId === item.id).slice(0, 50));
      },
    }),
    factory_list_pending_approvals: createTool({
      id: 'factory_list_pending_approvals',
      description: 'List pending governed transition approvals for this Factory.',
      inputSchema: pendingApprovalInputSchema,
      execute: async ({ limit }, execution) => {
        const current = resolveSupervisorContext(execution.requestContext);
        if (!current || current.factoryProjectId !== context.factoryProjectId) {
          throw new Error('Factory supervisor session is no longer canonical.');
        }
        const approvals = await options.service.approvals.list({
          orgId: current.orgId,
          factoryProjectId: current.factoryProjectId,
          statuses: ['pending'],
        });
        return { approvals: approvals.slice(0, limit).map(approval => supervisorApprovalSummary(approval)) };
      },
    }),
    factory_signal_work_item: createTool({
      id: 'factory_signal_work_item',
      description:
        'Send a supervisor message to an active binding for one work item, injecting active work or waking idle work.',
      inputSchema: signalInputSchema,
      execute: async ({ workItemId, role, message }, execution) => {
        const current = resolveSupervisorContext(execution.requestContext);
        if (!current || current.factoryProjectId !== context.factoryProjectId) {
          throw new Error('Factory supervisor session is no longer canonical.');
        }
        const item = await options.service.workItems.getForProject(current.orgId, current.factoryProjectId, workItemId);
        if (!item) throw new Error('Factory work item not found.');
        const binding = selectBinding(
          await options.service.workItems.listRunBindings(current.orgId, current.factoryProjectId, workItemId),
          role,
        );
        if (!binding)
          throw new Error(role ? `No active Factory binding for role '${role}'.` : 'No active Factory binding found.');
        const session = await options.service.controller.getSessionByResource(binding.resourceId);
        if (!session) throw new Error('Bound Factory session is unavailable.');
        if (session.thread.getId() !== binding.threadId) {
          await session.thread.switch({ threadId: binding.threadId, emitEvent: false });
        }
        const signalId = randomUUID();
        const accepted = await session.sendSignal(
          {
            id: signalId,
            type: 'user',
            tagName: 'factory-supervisor-message',
            contents: message,
            attributes: {
              factoryProjectId: current.factoryProjectId,
              workItemId,
              role: binding.role,
              supervisorThreadId: current.threadId,
              userId: current.userId,
              ...(current.userName ? { name: current.userName } : {}),
            },
            ifActive: { attributes: { delivery: 'while-active' } },
            ifIdle: { attributes: { delivery: 'message' } },
          },
          { requestContext: execution.requestContext },
        ).accepted;
        await options.audit.emitAgent({
          requestContext: execution.requestContext,
          input: {
            action: 'factory.supervisor.message_sent',
            targets: [{ type: 'work_item', id: workItemId, name: item.title }],
            metadata: { bindingId: binding.id, role: binding.role, signalId, runId: accepted.runId ?? null },
          },
        });
        return {
          status: 'accepted',
          bindingId: binding.id,
          role: binding.role,
          signalId,
          runId: accepted.runId ?? null,
        };
      },
    }),
    factory_resolve_transition_approval: createTool({
      id: 'factory_resolve_transition_approval',
      description:
        'Approve or reject one pending transition approval. Approval applies the captured move only if its revision is current.',
      inputSchema: resolveApprovalInputSchema,
      execute: async ({ approvalId, decision, reason }, execution) => {
        const current = resolveSupervisorContext(execution.requestContext);
        if (!current || current.factoryProjectId !== context.factoryProjectId) {
          throw new Error('Factory supervisor session is no longer canonical.');
        }
        const approval = await options.service.approvals.get({
          orgId: current.orgId,
          factoryProjectId: current.factoryProjectId,
          approvalId,
        });
        if (!approval) throw new Error('Factory transition approval not found.');
        if (approval.status !== 'pending')
          throw new Error(`Factory transition approval is already ${approval.status}.`);
        const result = await options.service.approvals.resolve({
          orgId: current.orgId,
          factoryProjectId: current.factoryProjectId,
          approvalId,
          decision,
          resolvedBy: current.userId,
          resolverType: 'agent',
          ...(reason ? { resolutionReason: reason } : {}),
        });
        if (result.status === 'missing') throw new Error('Factory transition approval not found.');
        return {
          status: result.status,
          replayed: result.replayed,
          approvalId,
          workItemId: result.approval.workItemId,
          stage: result.approval.requestedStage,
          revision: result.item?.revision ?? null,
        };
      },
    }),
  };
}
