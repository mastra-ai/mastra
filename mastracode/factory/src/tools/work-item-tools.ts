/**
 * Factory tools that change work items: file one, move it, settle its
 * decisions, and follow it. They act as the session's person (a human actor),
 * through the same code the board's routes use.
 */

import { randomUUID } from 'node:crypto';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { IntegrationTools } from '../integrations/base.js';
import { transitionBodySchema } from '../routes/contracts.js';
import type { FactoryTransitionService } from '../rules/transition-service.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { CommentsDomain } from '../storage/domains/comments/domain.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryWorkItem } from '../work-items/create-work-item.js';
import type { FactoryAuditEmit } from '../work-items/create-work-item.js';
import {
  dismissFactoryDecision,
  resolveFactoryProposal,
  retryFactoryDecision,
} from '../work-items/decision-actions.js';
import type { FactoryDecisionActionResult } from '../work-items/decision-actions.js';
import { MAX_TEXT, findWorkItem, truncate, workItemNotFound, workItemNumber, workItemStage } from './read-tools.js';
import type { FactoryToolScope } from './scope.js';

export interface FactoryWorkItemToolDependencies {
  workItems: WorkItemsStorage;
  boards: BoardRegistry;
  /** Governed stage moves; filing and moving items refuse while it is unavailable. */
  transitionService: Pick<FactoryTransitionService, 'transition'> | undefined;
  /** Writes audit rows with an explicit actor; tool calls have no HTTP request to read one from. */
  auditRecorder: AuditRecorder;
  /** The feed's front door: validates, touches open boards and mirrors to linked channels. */
  feed: Pick<CommentsDomain, 'createComment'>;
}

const workItemRef = z.string().trim().min(1).max(64).describe('Work item id, or its number like "#123".');
const decisionId = z.string().trim().uuid().describe('Decision id, from factory_list_attention or inspect.');

function briefItem(item: WorkItemRow) {
  return {
    id: item.id,
    number: workItemNumber(item),
    title: truncate(item.title, MAX_TEXT),
    stage: workItemStage(item),
  };
}

function settled(result: FactoryDecisionActionResult) {
  if (!result.ok) throw new Error(result.message);
  const { decision } = result;
  return { decisionId: decision.id, status: decision.status, workItemId: decision.workItemId };
}

/** The work-item write and subscription tools for one user session's turn. */
export function createFactoryWorkItemTools(
  scope: FactoryToolScope,
  deps: FactoryWorkItemToolDependencies,
): IntegrationTools {
  const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
  const audit: FactoryAuditEmit = async input => {
    await deps.auditRecorder.record({ orgId: scope.orgId, actorId: scope.userId, actorType: 'human', ...input });
  };
  const requireItem = async (ref: string) => {
    const item = await findWorkItem(deps.workItems, scope, ref);
    if (!item) throw workItemNotFound(ref);
    return item;
  };
  const follow = (item: WorkItemRow, reason: 'created' | 'subscribed') =>
    deps.workItems.subscribeToWorkItem({
      ...project,
      workItemId: item.id,
      sessionId: scope.sessionId,
      threadId: scope.threadId,
      resourceId: scope.resourceId,
      userId: scope.userId,
      reason,
    });

  return {
    factory_create_work_item: createTool({
      id: 'factory_create_work_item',
      description:
        "File a new work item on this Factory's Work board for the person you are working with. It lands in the board's first phase, exactly like pressing New card, and this session follows it. Check factory_list_work_items for an existing item first.",
      inputSchema: z
        .object({
          title: z.string().trim().min(1).max(512).describe('Short title, as it should read on the card.'),
          brief: z
            .string()
            .trim()
            .min(1)
            .max(8000)
            .describe('What needs doing and why; posted as the first comment on the card.'),
        })
        .strict(),
      execute: async ({ title, brief }) => {
        const created = await createFactoryWorkItem({
          workItems: deps.workItems,
          boards: deps.boards,
          transitionService: deps.transitionService,
          audit,
          ...project,
          userId: scope.userId,
          input: { title },
        });
        if (created.status === 'refused') throw new Error(created.message);
        if (created.status === 'rejected') throw new Error(`The board refused the new item: ${created.reason}`);
        const { item } = created;
        // The card exists from here on: report follow-up failures alongside it
        // rather than failing the call, so the agent doesn't file it twice.
        const warnings: string[] = [];
        try {
          const comment = await deps.feed.createComment({
            orgId: scope.orgId,
            workItemId: item.id,
            author: { kind: 'user', id: scope.userId },
            body: brief,
          });
          if (comment.status !== 'created') {
            warnings.push(
              `The brief was not posted (${comment.status === 'invalid' ? comment.message : comment.status}).`,
            );
          }
        } catch (error) {
          warnings.push(`The brief was not posted: ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
          await follow(item, 'created');
        } catch (error) {
          warnings.push(
            `This session does not follow it yet: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return warnings.length ? { ...briefItem(item), warnings } : briefItem(item);
      },
    }),

    factory_transition_work_item: createTool({
      id: 'factory_transition_work_item',
      description:
        "Move a work item to another stage of its board, as the person you are working with. The board's rules decide whether the move is allowed and what it starts. Confirm with the person first.",
      inputSchema: z
        .object({
          workItem: workItemRef,
          stage: z.string().trim().min(1).max(64).describe('Destination stage, e.g. "planning" or "done".'),
        })
        .strict(),
      requireApproval: true,
      execute: async ({ workItem, stage }) => {
        if (!deps.transitionService) throw new Error('Factory stage transitions are not available right now.');
        const item = await requireItem(workItem);
        const parsed = transitionBodySchema.safeParse({
          board: boardForWorkItem(item),
          stage,
          expectedRevision: item.revision,
          requestId: randomUUID(),
          cause: 'factory_tools',
        });
        if (!parsed.success) throw new Error(`"${stage}" is not a valid stage name.`);
        const result = await deps.transitionService.transition({
          ...parsed.data,
          ...project,
          workItemId: item.id,
          actor: { type: 'human', id: scope.userId },
          ingress: { ...parsed.data.ingress, identity: `human:${scope.userId}:${parsed.data.ingress.identity}` },
        });
        if (result.status === 'rejected') throw new Error(`The move was refused (${result.code}): ${result.reason}`);
        return { workItemId: item.id, stage: result.stage, revision: result.revision };
      },
    }),

    factory_retry_decision: createTool({
      id: 'factory_retry_decision',
      description:
        'Retry one failed Factory run after the person confirms its cause was fixed. Refused when the failure cannot be fixed by retrying or the item has moved on.',
      inputSchema: z.object({ decisionId }).strict(),
      requireApproval: true,
      execute: async ({ decisionId }) =>
        settled(await retryFactoryDecision({ workItems: deps.workItems, boards: deps.boards, ...project, decisionId })),
    }),

    factory_dismiss_decision: createTool({
      id: 'factory_dismiss_decision',
      description: 'Dismiss one proposed Factory run after the person confirms it is no longer wanted.',
      inputSchema: z.object({ decisionId }).strict(),
      requireApproval: true,
      execute: async ({ decisionId }) =>
        settled(
          await dismissFactoryDecision({
            workItems: deps.workItems,
            audit,
            ...project,
            userId: scope.userId,
            decisionId,
          }),
        ),
    }),

    factory_resolve_proposal: createTool({
      id: 'factory_resolve_proposal',
      description:
        "Approve or dismiss one proposed Factory run after the person confirms. Approving starts the run and lets the item's later runs start without asking.",
      inputSchema: z.object({ decisionId, action: z.enum(['approve', 'dismiss']) }).strict(),
      requireApproval: true,
      execute: async ({ decisionId, action }) =>
        settled(
          await resolveFactoryProposal({
            workItems: deps.workItems,
            audit,
            ...project,
            userId: scope.userId,
            decisionId,
            action,
          }),
        ),
    }),

    factory_subscribe_work_item: createTool({
      id: 'factory_subscribe_work_item',
      description:
        'Follow a work item from this session, so you hear about its progress and its sessions report to you. Items you file or start are followed already.',
      inputSchema: z.object({ workItem: workItemRef }).strict(),
      execute: async ({ workItem }) => {
        const item = await requireItem(workItem);
        const subscription = await follow(item, 'subscribed');
        return { workItem: briefItem(item), subscribed: true, reason: subscription.reason };
      },
    }),

    factory_unsubscribe_work_item: createTool({
      id: 'factory_unsubscribe_work_item',
      description: 'Stop following a work item from this session.',
      inputSchema: z.object({ workItem: workItemRef }).strict(),
      execute: async ({ workItem }) => {
        const item = await requireItem(workItem);
        const removed = await deps.workItems.unsubscribeFromWorkItem({
          orgId: scope.orgId,
          workItemId: item.id,
          sessionId: scope.sessionId,
        });
        return { workItem: briefItem(item), subscribed: false, wasSubscribed: removed };
      },
    }),
  };
}
