/**
 * Factory tools that change work items: file one, move it, settle its
 * decisions, and follow it. They act as the session's person (a human actor),
 * through the same code the board's routes use.
 */

import { randomUUID } from 'node:crypto';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { FactoryBoardEngine } from '../board-engine/engine.js';
import { boardForWorkItem } from '../boards/index.js';

import type { BoardRegistry } from '../boards/index.js';
import type { IntakeRoutesReader } from '../boards/intake-routing.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { IntegrationTools } from '../integrations/base.js';
import { factoryWorkItemUrl } from '../links.js';
import { transitionBodySchema } from '../routes/contracts.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { IntakeEvaluator } from '../storage/domains/boards/base.js';
import { WorkItemRelationError } from '../storage/domains/work-items/base.js';
import type { UpdateWorkItemInput, Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { workItemNumber } from '../work-items/card-number.js';
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
  resolveBoardRef,
  workItemRefSchema,
  truncate,
  workItemNotFound,
  workItemStage,
} from './read-tools.js';
import { requirePerson } from './scope.js';
import type { FactoryToolScope } from './scope.js';

export interface FactoryWorkItemToolDependencies {
  workItems: WorkItemsStorage;
  /** A fixed registry, or the per-project boards. */
  boards: BoardRegistry | ProjectBoardSource;
  /** The project's intake routes, which place a filed card. */
  intakeRoutes?: IntakeRoutesReader;
  /** Which evaluator places a filed card; the old `route-list` by default. */
  intakeEvaluator?: IntakeEvaluator;
  /** The board engine every stage move goes through; filing and moving items refuse while it is unavailable. */
  boardEngine: Pick<FactoryBoardEngine, 'requestMove'> | undefined;
  /** Writes audit rows with an explicit actor; tool calls have no HTTP request to read one from. */
  auditRecorder: AuditRecorder;
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

function briefItem(item: Card) {
  return {
    id: item.id,
    number: workItemNumber(item),
    title: truncate(item.title, MAX_TEXT),
    stage: workItemStage(item),
    url:
      factoryWorkItemUrl({
        factoryProjectId: item.factoryProjectId,
        workItemId: item.id,
      }) ?? null,
  };
}

function workItemLabel(item: Card): string {
  const number = workItemNumber(item);
  return number === null ? `"${item.title}"` : `#${number}`;
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
  const requireRepository = async (slug: string, item?: Pick<Card, 'metadata' | 'workItem'>) => {
    const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
    if (!sourceControl) throw new Error('This session has no source-control provider to look repositories up in.');
    const resolve = (repository?: string) =>
      resolveWorkItemRepository({
        sourceControl,
        ...project,
        item: {
          metadata: repository ? { repository } : (item?.metadata ?? null),
          workItem: item?.workItem ?? { metadata: null },
        },
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
  const follow = (item: Card, reason: 'created' | 'moved' | 'started' | 'subscribed') =>
    deps.workItems.subscribeToWorkItem({
      ...project,
      workItemId: item.id,
      sessionId: scope.sessionId,
      threadId: scope.threadId,
      resourceId: scope.resourceId,
      userId: scope.userId,
      reason,
    });
  /**
   * Approving or retrying a run starts it from this session, so this session follows its card as a
   * move does: the run's report and anything it waits on reach this session, which can pass them on.
   * Only approval acts as the person; a retry keeps the run's original approver. The run has
   * started by now: a failed read or follow is reported with it, not instead of it.
   */
  const followStartedRun = async (result: ReturnType<typeof settled>) => {
    if (!result.workItemId) return result;
    let url: string | null = null;
    try {
      const item = await deps.workItems.getForProject(scope.orgId, scope.factoryProjectId, result.workItemId);
      if (!item) return result;
      url =
        factoryWorkItemUrl({
          factoryProjectId: item.factoryProjectId,
          workItemId: item.id,
        }) ?? null;
      await follow(item, 'started');
      return { ...result, url };
    } catch (error) {
      return {
        ...result,
        url,
        warnings: [`This session does not follow it yet: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  };

  return {
    factory_create_work_item: createTool({
      id: 'factory_create_work_item',
      description:
        'File a new work item on this Factory for the person you are working with, on the board the project\'s intake rules pick (or the board named). It enters its board\'s first phase, or the phase an intake rule names, and this session follows it. Check factory_list_work_items for an existing item first. When no intake rule takes it, the call is refused: ask the person which board it belongs on and call again with that board. Name the repository when you know it; a run on a card that names none determines it from the card. Filing a card does not do the work. When the person asked for the work to be done now ("fix it", "build this", "lets do it", "go for it"), start the card in the same turn with factory_transition_work_item, or start a side session for it when that is where the work belongs, then report only what the result confirms: the stage the card moved to, the side session you started, or the refusal or approval the move is waiting on. Say its work is running only once factory_inspect_work_item shows a session mid-run on it. Leave a card unstarted only when they asked for it to be filed or tracked for later. Someone who asked in this conversation for side sessions, or not to use the board, wants their later work in side sessions too, and so does work that follows from a side session: use a side session for it instead of filing a card. When they now ask for a card ("put this on the board"), file it and start it as usual; that request ends the side-session preference for their later work, until they ask for side sessions again.',
      inputSchema: z
        .object({
          title: z.string().trim().min(1).max(512).describe('Short title, as it should read on the card.'),
          description: z
            .string()
            .trim()
            .min(1)
            .max(8000)
            .describe('What needs doing and why; becomes the card description its runs start from.'),
          repository: repositorySchema.optional(),
          board: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .optional()
            .describe(
              'The board the person picked, by its id (e.g. "work") or its displayed name; files it in that board\'s first phase.',
            ),
        })
        .strict(),
      execute: async ({ title, description, repository, board: boardRef }) => {
        if (repository) await requireRepository(repository);
        const boards = await toBoardSource(deps.boards).load(project);
        const board = boardRef === undefined ? undefined : resolveBoardRef(boards, boardRef);
        const created = await createFactoryWorkItem({
          workItems: deps.workItems,
          boards,
          boardEngine: deps.boardEngine,
          intakeRoutes: deps.intakeRoutes,
          intakeEvaluator: deps.intakeEvaluator,
          audit,
          ...project,
          userId: scope.userId,
          ...(scope.actorProfile ? { origin: { actorProfile: scope.actorProfile } } : {}),
          input: {
            title,
            description,
            ...(board ? { board } : {}),
            ...(repository ? { metadata: { repository } } : {}),
          },
        });
        if (created.status === 'refused') throw new Error(created.message);
        if (created.status === 'rejected') throw new Error(`The board refused the new item: ${created.reason}`);
        const { item } = created;
        // The card exists from here on: report follow-up failures alongside it
        // rather than failing the call, so the agent doesn't file it twice.
        const warnings: string[] = [];
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
      description: [
        "Move a work item to another stage of its board, or with `rerun` run the stage it is already in again, as the person you are working with: the same requests the board's own move and Start buttons send.",
        "The board's rules decide whether the move is allowed and what it starts. The run it starts counts as approved by that person, so it does not wait in the approval queue. The result has the card's `url`, to link it where you report the move.",
        'Use it when someone asks for a card\'s own stage work, such as "review this pull request" on a pull request that has a card: the card\'s review is recorded on the card and posted on the pull request.',
        'When the person asks for a side session, a review in this chat, or work the stage does not do (pushing fixes to a pull request, taking it over), do that instead.',
      ].join(' '),
      inputSchema: z
        .object({
          workItem: workItemRefSchema,
          stage: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .describe('Destination stage key, as factory_inspect_work_item lists it (e.g. "planning" or "done").'),
          rerun: z
            .boolean()
            .optional()
            .describe(
              "With the stage the card is already in: run it again, as the board's Start button does. Without it, a request for the card's own stage changes nothing and says what the stage is doing.",
            ),
        })
        .strict(),
      execute: async ({ workItem, stage, rerun: rerunRequested }) => {
        if (!deps.boardEngine) throw new Error('Factory stage transitions are not available right now.');
        const item = await requireItem(workItem);
        // Following the card is what lets this session hear when its run waits on someone, and
        // answer it from here. It comes after the request: a failed follow is reported with it.
        const followed = async <T extends object>(result: T) => {
          try {
            await follow(item, 'moved');
            return result;
          } catch (error) {
            return {
              ...result,
              warnings: [
                `This session does not follow it yet: ${error instanceof Error ? error.message : String(error)}`,
              ],
            };
          }
        };
        // The card's page, so a chat can link the card it moved; null without a public URL.
        const url =
          factoryWorkItemUrl({
            factoryProjectId: item.factoryProjectId,
            workItemId: item.id,
          }) ?? null;
        const sameStage = item.stages.length === 1 && item.stages[0] === stage;
        // Already there: report the stage instead of starting it again without being asked, which
        // would rerun a finished review or plan on a "move it to review".
        if (sameStage && rerunRequested !== true) {
          const held = (
            await deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, {
              workItemId: item.id,
              statuses: ['proposed'],
            })
          ).filter(decision => decision.decision.type === 'invokeSkill').length;
          return followed({
            workItemId: item.id,
            url,
            stage,
            revision: item.revision,
            unchanged: true,
            message:
              `${workItemLabel(item)} is already in ${stage}` +
              (held > 0 ? ', and its run there is waiting for approval.' : '.') +
              " Pass rerun: true to run the stage again, as the board's Start button does; factory_inspect_work_item shows its sessions and runs.",
          });
        }
        // The board's Start button sends the card's own stage with `reenter`; the rules decide the rest.
        const rerun = sameStage;
        // Rerunning starts a run approved by whoever asks, so like the button it needs a person.
        if (rerun && !scope.interactive) {
          throw new Error(
            `Running ${stage} again on ${workItemLabel(item)} needs a person in this turn: ask them to request it from a signed-in chat or the board.`,
          );
        }
        const parsed = transitionBodySchema.safeParse({
          board: boardForWorkItem(item),
          stage,
          expectedRevision: item.revision,
          requestId: randomUUID(),
          cause: 'factory_tools',
          ...(rerun ? { reenter: true } : {}),
        });
        if (!parsed.success) throw new Error(`"${stage}" is not a valid stage name.`);
        const result = await deps.boardEngine.requestMove({
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
        // The move can start a phase session the Factory owns; the card has moved by now.
        return followed({
          workItemId: item.id,
          url,
          stage: result.stage,
          revision: result.revision,
          ...(rerun ? { reran: true } : {}),
        });
      },
    }),

    factory_update_work_item: createTool({
      id: 'factory_update_work_item',
      description:
        "Edit a work item's fields as the person you are working with: its title, description, the repository its runs use, or its parent item. Move stages, or rerun the stage a card is in, with factory_transition_work_item.",
      inputSchema: z
        .object({
          workItem: workItemRefSchema,
          title: z.string().trim().min(1).max(500).optional().describe('New card title.'),
          description: z
            .string()
            .trim()
            .max(8000)
            .optional()
            .describe('New card description; an empty string clears it.'),
          repository: repositorySchema.optional(),
          parentWorkItem: workItemRefSchema
            .nullable()
            .optional()
            .describe('Parent work item (id or #number), or null to detach it from its parent.'),
        })
        .strict()
        .refine(input => Object.keys(input).some(key => key !== 'workItem'), 'Pass at least one field to change.'),
      execute: async ({ workItem, title, description, repository, parentWorkItem }) => {
        const item = await requireItem(workItem);
        if (repository) await requireRepository(repository, item);
        let parentWorkItemId: string | null | undefined;
        if (parentWorkItem === null) parentWorkItemId = null;
        else if (parentWorkItem !== undefined) parentWorkItemId = (await requireItem(parentWorkItem)).id;
        const patch: UpdateWorkItemInput = {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(repository ? { metadata: { repository } } : {}),
          ...(parentWorkItemId !== undefined ? { parentWorkItemId } : {}),
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
          ...(description !== undefined ? ['description'] : []),
          ...(repository ? ['metadata'] : []),
          ...(parentWorkItemId !== undefined ? ['parentWorkItemId'] : []),
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
        };
      },
    }),

    factory_retry_decision: createTool({
      id: 'factory_retry_decision',
      description:
        "Retry one failed Factory run once its cause is fixed. Refused when the failure cannot be fixed by retrying or the item has moved on. This session follows the run's card, so it hears how the run ends; the result has the card's `url`.",
      inputSchema: z.object({ decisionId }).strict(),
      execute: async ({ decisionId }) =>
        followStartedRun(
          settled(
            await retryFactoryDecision({
              workItems: deps.workItems,
              boards: await toBoardSource(deps.boards).load(project),
              ...project,
              decisionId,
            }),
          ),
        ),
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
        "Approve or dismiss one proposed Factory run. Approving starts the run and lets the item's later runs start without asking, and this session follows the run's card, so it hears how the run ends; the result has the card's `url`.",
      inputSchema: z.object({ decisionId, action: z.enum(['approve', 'dismiss']) }).strict(),
      execute: async ({ decisionId, action }) => {
        requirePerson(scope, 'approve or dismiss a proposed run');
        const result = settled(
          await resolveFactoryProposal({
            workItems: deps.workItems,
            audit,
            ...project,
            userId: scope.userId,
            decisionId,
            action,
          }),
        );
        return action === 'approve' ? followStartedRun(result) : result;
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
          ...project,
          workItemId: item.id,
          sessionId: scope.sessionId,
        });
        return { workItem: briefItem(item), subscribed: false, wasSubscribed: removed };
      },
    }),
  };
}
