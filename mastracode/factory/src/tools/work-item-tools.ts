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
import { factoryWorkItemUrl } from '../links.js';
import { transitionBodySchema } from '../routes/contracts.js';
import type { FactoryTransitionService } from '../rules/transition-service.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { CommentsDomain } from '../storage/domains/comments/domain.js';
import { WorkItemRelationError } from '../storage/domains/work-items/base.js';
import type { UpdateWorkItemInput, WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryWorkItem } from '../work-items/create-work-item.js';
import type { FactoryAuditEmit } from '../work-items/create-work-item.js';
import {
  dismissFactoryDecision,
  resolveFactoryProposal,
  retryFactoryDecision,
} from '../work-items/decision-actions.js';
import type { FactoryDecisionActionResult } from '../work-items/decision-actions.js';
import {
  MAX_TEXT,
  findWorkItem,
  workItemRefSchema,
  truncate,
  workItemNotFound,
  workItemNumber,
  workItemStage,
} from './read-tools.js';
import { requirePerson } from './scope.js';
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
  /** Finds the caller session's source-control provider, whose linked repositories a card can name. */
  sessions: Pick<SourceControlSessionLookup, 'getSourceControlBySessionId'>;
}

const repositorySchema = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[^/\s]+\/[^/\s]+$/, 'Use the owner/name form, e.g. "mastra-ai/mastra".')
  .describe('A repository linked to this Factory, as owner/name.');

const decisionId = z.string().trim().uuid().describe('Decision id, from factory_list_attention or inspect.');

function briefItem(item: WorkItemRow) {
  return {
    id: item.id,
    number: workItemNumber(item),
    title: truncate(item.title, MAX_TEXT),
    stage: workItemStage(item),
    url:
      factoryWorkItemUrl({
        factoryProjectId: item.factoryProjectId,
        board: boardForWorkItem(item),
        workItemId: item.id,
      }) ?? null,
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
    await deps.auditRecorder.record({
      orgId: scope.orgId,
      // Turns nobody signed in started are recorded as this session's agent, as their moves are.
      actorId: scope.interactive ? scope.userId : `agent:session:${scope.sessionId}`,
      actorType: scope.interactive ? 'human' : 'agent',
      ...(scope.actorProfile ? { actorProfile: scope.actorProfile } : {}),
      ...input,
    });
  };
  const requireItem = async (ref: string) => {
    const item = await findWorkItem(deps.workItems, scope, ref);
    if (!item) throw workItemNotFound(ref);
    return item;
  };
  /**
   * Check `slug` is a repository linked to this Factory and that a card with
   * `metadata` would run in it (a card synced from an issue follows the
   * issue's repository, which a slug can't override).
   */
  const requireRepository = async (slug: string, metadata: Record<string, unknown> | null = null) => {
    const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
    if (!sourceControl) throw new Error('This session has no source-control provider to look repositories up in.');
    const resolve = (repository?: string) =>
      resolveWorkItemRepository({
        sourceControl,
        ...project,
        item: { metadata: repository ? { ...metadata, repository } : metadata },
      });
    const resolution = await resolve(slug);
    if (resolution.status === 'resolved' && resolution.slug === slug) return;
    if (resolution.status === 'resolved') {
      throw new Error(`This card runs in ${resolution.slug}, which comes from its linked issue and can't be changed.`);
    }
    const linked = await resolve();
    const candidates =
      linked.status === 'ambiguous' ? linked.candidates : linked.status === 'resolved' ? [linked.slug] : [];
    throw new Error(
      candidates.length > 0
        ? `${slug} is not linked to this Factory. Linked repositories: ${candidates.join(', ')}.`
        : `${slug} is not linked to this Factory, and it has no linked repositories.`,
    );
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
        "File a new work item on this Factory's Work board for the person you are working with. It lands in the board's first phase, exactly like pressing New card, and this session follows it. Check factory_list_work_items for an existing item first. Name the repository when the Factory links more than one; runs refuse to start on a card that doesn't say which.",
      inputSchema: z
        .object({
          title: z.string().trim().min(1).max(512).describe('Short title, as it should read on the card.'),
          brief: z
            .string()
            .trim()
            .min(1)
            .max(8000)
            .describe('What needs doing and why; posted as the first comment on the card.'),
          repository: repositorySchema.optional(),
        })
        .strict(),
      execute: async ({ title, brief, repository }) => {
        if (repository) await requireRepository(repository);
        const created = await createFactoryWorkItem({
          workItems: deps.workItems,
          boards: deps.boards,
          transitionService: deps.transitionService,
          audit,
          ...project,
          userId: scope.userId,
          ...(scope.actorProfile ? { origin: { actorProfile: scope.actorProfile } } : {}),
          input: { title, ...(repository ? { metadata: { repository } } : {}) },
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
        "Move a work item to another stage of its board, as the person you are working with. The board's rules decide whether the move is allowed and what it starts.",
      inputSchema: z
        .object({
          workItem: workItemRefSchema,
          stage: z.string().trim().min(1).max(64).describe('Destination stage, e.g. "planning" or "done".'),
        })
        .strict(),
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
          ...(scope.interactive
            ? {
                actor: { type: 'human' as const, id: scope.userId },
                ...(scope.actorProfile ? { actorProfile: scope.actorProfile } : {}),
                ingress: { ...parsed.data.ingress, identity: `human:${scope.userId}:${parsed.data.ingress.identity}` },
              }
            : {
                // Nobody signed in started this turn: move as this session's agent, so the
                // plan gate and the agent's done gates apply and the move arms no runs.
                actor: { type: 'agent' as const, bindingId: `session:${scope.sessionId}`, role: 'session' },
                ingress: {
                  type: 'agent' as const,
                  identity: `session:${scope.sessionId}:${parsed.data.ingress.identity}`,
                },
              }),
        });
        if (result.status === 'rejected') throw new Error(`The move was refused (${result.code}): ${result.reason}`);
        return { workItemId: item.id, stage: result.stage, revision: result.revision };
      },
    }),

    factory_update_work_item: createTool({
      id: 'factory_update_work_item',
      description:
        "Edit a work item's fields as the person you are working with: its title, the repository its runs use, its parent item, or pre-approving its plans. Move stages with factory_transition_work_item and start roles with factory_start_session; post to the card's feed for anything else.",
      inputSchema: z
        .object({
          workItem: workItemRefSchema,
          title: z.string().trim().min(1).max(500).optional().describe('New card title.'),
          repository: repositorySchema.optional(),
          parentWorkItem: workItemRefSchema
            .nullable()
            .optional()
            .describe('Parent work item (id or #number), or null to detach it from its parent.'),
          plansPreapproved: z
            .literal(true)
            .optional()
            .describe(
              "Pre-approve the item's plans, so its runs no longer stop for plan approval. Can't be undone here.",
            ),
        })
        .strict()
        .refine(input => Object.keys(input).some(key => key !== 'workItem'), 'Pass at least one field to change.'),
      execute: async ({ workItem, title, repository, parentWorkItem, plansPreapproved }) => {
        // Pre-approval drops the plan-approval gate for good, so it is the person's call.
        if (plansPreapproved) requirePerson(scope, 'pre-approve plans');
        const item = await requireItem(workItem);
        if (repository) await requireRepository(repository, item.metadata);
        let parentWorkItemId: string | null | undefined;
        if (parentWorkItem === null) parentWorkItemId = null;
        else if (parentWorkItem !== undefined) parentWorkItemId = (await requireItem(parentWorkItem)).id;
        const patch: UpdateWorkItemInput = {
          ...(title !== undefined ? { title } : {}),
          ...(repository ? { metadata: { repository } } : {}),
          ...(parentWorkItemId !== undefined ? { parentWorkItemId } : {}),
          ...(plansPreapproved ? { plansPreapproved } : {}),
        };
        let updated: Awaited<ReturnType<WorkItemsStorage['update']>>;
        try {
          updated = await deps.workItems.update({ orgId: scope.orgId, id: item.id, userId: scope.userId, patch });
        } catch (error) {
          if (error instanceof WorkItemRelationError) throw new Error(`The parent was refused: ${error.message}`);
          throw error;
        }
        if (!updated) throw workItemNotFound(workItem);
        const fields = [
          ...(title !== undefined ? ['title'] : []),
          ...(repository ? ['metadata'] : []),
          ...(parentWorkItemId !== undefined ? ['parentWorkItemId'] : []),
          ...(plansPreapproved ? ['plansPreapproved'] : []),
        ];
        await audit({
          action: 'factory.work_item.updated',
          factoryProjectId: scope.factoryProjectId,
          targets: [{ type: 'work_item', id: updated.item.id, name: updated.item.title }],
          metadata: { fields, cause: 'factory_tools' },
        });
        const metadata = updated.item.metadata ?? {};
        return {
          workItem: briefItem(updated.item),
          updated: fields.map(field => (field === 'metadata' ? 'repository' : field)),
          repository: typeof metadata.repository === 'string' ? metadata.repository : null,
          parentWorkItemId: updated.item.parentWorkItemId,
          plansPreapproved: updated.item.plansPreapprovedAt !== null,
        };
      },
    }),

    factory_retry_decision: createTool({
      id: 'factory_retry_decision',
      description:
        'Retry one failed Factory run once its cause is fixed. Refused when the failure cannot be fixed by retrying or the item has moved on.',
      inputSchema: z.object({ decisionId }).strict(),
      execute: async ({ decisionId }) =>
        settled(await retryFactoryDecision({ workItems: deps.workItems, boards: deps.boards, ...project, decisionId })),
    }),

    factory_dismiss_decision: createTool({
      id: 'factory_dismiss_decision',
      description: 'Dismiss one proposed Factory run that is no longer wanted.',
      inputSchema: z.object({ decisionId }).strict(),
      execute: async ({ decisionId }) => {
        requirePerson(scope, 'dismiss a proposed run');
        return settled(
          await dismissFactoryDecision({
            workItems: deps.workItems,
            audit,
            ...project,
            userId: scope.userId,
            decisionId,
          }),
        );
      },
    }),

    factory_resolve_proposal: createTool({
      id: 'factory_resolve_proposal',
      description:
        "Approve or dismiss one proposed Factory run. Approving starts the run and lets the item's later runs start without asking.",
      inputSchema: z.object({ decisionId, action: z.enum(['approve', 'dismiss']) }).strict(),
      execute: async ({ decisionId, action }) => {
        requirePerson(scope, 'approve or dismiss a proposed run');
        return settled(
          await resolveFactoryProposal({
            workItems: deps.workItems,
            audit,
            ...project,
            userId: scope.userId,
            decisionId,
            action,
          }),
        );
      },
    }),

    factory_subscribe_work_item: createTool({
      id: 'factory_subscribe_work_item',
      description:
        'Follow a work item from this session, so you hear about its progress and its sessions report to you. Items you file or start are followed already.',
      inputSchema: z.object({ workItem: workItemRefSchema }).strict(),
      execute: async ({ workItem }) => {
        const item = await requireItem(workItem);
        const subscription = await follow(item, 'subscribed');
        return { workItem: briefItem(item), subscribed: true, reason: subscription.reason };
      },
    }),

    factory_unsubscribe_work_item: createTool({
      id: 'factory_unsubscribe_work_item',
      description: 'Stop following a work item from this session.',
      inputSchema: z.object({ workItem: workItemRefSchema }).strict(),
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
