import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  awaitsAcceptance,
  boardFlow,
  boardForWorkItem,
  pullRequestSourceNumber,
  pullRequestSources,
} from '../boards/index.js';
import type { BoardRegistry, InstalledBoard } from '../boards/index.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { IntegrationTools } from '../integrations/base.js';
import { factorySessionUrl, factoryWorkItemUrl } from '../links.js';
import { parkedRunLabel } from '../routes/attention-parked.js';
import { decisionRetryable, overtakenDecisionIds } from '../rules/decision-applicability.js';
import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import { needsApproval } from '../rules/types.js';
import type { LiveSessions } from '../session/live-sessions.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryRunBindingRecord,
  Card,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { cardFacts } from '../work-items/card-facts.js';
import { workItemNumber } from '../work-items/card-number.js';
import { cardCarries, isCardFor, isSourceReference } from '../work-items/card-reference.js';
import { matchesSearch, searchTerms } from '../work-items/search-terms.js';
import { sessionActivity } from './deliver.js';
import type { FactorySessionActivity } from './deliver.js';
import type { FactoryMessaging } from './messaging-tools.js';
import type { FactoryToolScope } from './scope.js';

export const MAX_TEXT = 600;
export const MAX_ERROR = 400;
export const MAX_LIST = 50;
const DEFAULT_LIST = 25;

export interface FactoryReadToolDependencies {
  workItems: Pick<
    WorkItemsStorage,
    | 'listShared'
    | 'getForProject'
    | 'listRunBindings'
    | 'listDeferredDecisions'
    | 'listByIds'
    | 'listDecisionsForEvaluations'
    | 'listWorkItemSubscribers'
    | 'listSessionSubscriptions'
  >;
  audit: Pick<AuditStorage, 'list'>;
  /** A fixed registry, or the per-project boards. */
  boards: BoardRegistry | ProjectBoardSource;
  /** The live controller, for whether a session is mid-run and when it last moved; absent before the mount is up. */
  messaging?: () => Promise<Pick<FactoryMessaging, 'controller'> | null>;
  /** Which live sessions are parked on a tool prompt; absent before the mount is up. */
  liveSessions?: () => Pick<LiveSessions, 'parked' | 'parkedIn'> | undefined;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function workItemStage(item: Pick<Card, 'stages'>): string {
  return item.stages.join('+');
}

/**
 * A work item id, its card number, or the issue or pull request it tracks, as people paste it: a
 * link, `owner/repo#123`, `group/project!7` or a tracker key like `ENG-42`. Anything else can't
 * name an item.
 */
export const workItemRefSchema = z
  .string()
  .trim()
  .max(512)
  .refine(ref => z.string().uuid().safeParse(ref).success || /^#?\d+$/.test(ref) || isSourceReference(ref), {
    message:
      'Use a work item id (UUID), its number like "#123", or the link or owner/repo#123 of the issue or pull request it tracks.',
  })
  .describe(
    'Work item id, its number like "#123", or the issue or pull request it tracks: its link, owner/repo#123, or a key like ENG-42. With several repositories, prefer the link: a bare number can belong to more than one.',
  );

/**
 * Resolve a ref validated by `workItemRefSchema` to an item in this Factory only. A link or
 * shorthand finds the card of that issue or pull request, else the card it is attached to.
 */
export async function findWorkItem(
  workItems: Pick<WorkItemsStorage, 'listShared' | 'getForProject'>,
  scope: Pick<FactoryToolScope, 'orgId' | 'factoryProjectId'>,
  ref: string,
): Promise<Card | null> {
  const trimmed = ref.trim();
  if (z.string().uuid().safeParse(trimmed).success) {
    return workItems.getForProject(scope.orgId, scope.factoryProjectId, trimmed);
  }
  const number = /^#?(\d+)$/.exec(trimmed)?.[1];
  if (number === undefined) return findBySource(await workItems.listShared(scope), trimmed);
  const items = await workItems.listShared(scope);
  const matches = items.filter(item => workItemNumber(item) === Number(number));
  // Issue and PR numbers share a space on GitHub; prefer the issue's card.
  const workCards = matches.filter(item => item.externalSource?.type !== 'pull-request');
  // Hand-filed card numbers and issue numbers from several repositories can repeat; refuse to guess.
  refuseAmbiguous(number, workCards);
  const match = workCards[0] ?? matches[0];
  if (match) return structuredClone(match);
  // A pull request attached to an issue's card is found through that card. Pull request numbers
  // repeat across repositories too.
  const carriers = items.filter(item =>
    pullRequestSources(item).some(source => pullRequestSourceNumber(source) === Number(number)),
  );
  refuseAmbiguous(number, carriers);
  return carriers[0] ? structuredClone(carriers[0]) : null;
}

function findBySource(items: readonly Card[], ref: string): Card | null {
  // The issue's or pull request's own card first, then a card it is attached to (a pull request on its issue's card).
  for (const tier of [items.filter(item => isCardFor(item, ref)), items.filter(item => cardCarries(item, ref))]) {
    refuseAmbiguous(ref, tier);
    if (tier[0]) return structuredClone(tier[0]);
  }
  return null;
}

function refuseAmbiguous(ref: string, items: readonly Card[]): void {
  if (items.length <= 1) return;
  const candidates = items
    .map(item => `${item.id} (${item.title}, ${boardForWorkItem(item)} › ${workItemStage(item)})`)
    .join(', ');
  const label = /^\d+$/.test(ref) ? `#${ref}` : ref;
  throw new Error(`${label} matches more than one work item; use its id instead: ${candidates}.`);
}

/** The stage the card is in and where its board lets it go next, as the board shows its move buttons. */
function boardMoves(board: InstalledBoard | undefined, item: Card) {
  const stage = item.stages.length === 1 ? item.stages[0]! : undefined;
  const phase = board && stage !== undefined && Object.hasOwn(board.phases, stage) ? board.phases[stage] : undefined;
  if (!board || !phase || stage === undefined) return null;
  return {
    board: { key: board.id, name: board.name },
    stage: { key: stage, name: phase.name, kind: phase.kind },
    // A working stage runs its skill again when the card is moved to the stage it is in.
    canRerun: phase.kind === 'working',
    next: phase.nextPhases
      .filter(key => Object.hasOwn(board.phases, key))
      .map(key => ({ key, name: board.phases[key]!.name, kind: board.phases[key]!.kind })),
  };
}

export function workItemNotFound(ref: string): Error {
  return new Error(`No work item ${ref} was found in this Factory.`);
}

function activeWorker(bindings: FactoryRunBindingRecord[], itemId: string) {
  const binding = bindings.find(candidate => candidate.workItemId === itemId && candidate.status === 'active');
  return binding ? { role: binding.role, sessionId: binding.sessionId } : null;
}

/** The card on its Factory board; null when the server has no public URL configured. */
function workItemUrl(item: Card) {
  return (
    factoryWorkItemUrl({
      factoryProjectId: item.factoryProjectId,
      workItemId: item.id,
    }) ?? null
  );
}

function summarizeItem(item: Card, bindings: FactoryRunBindingRecord[]) {
  return {
    id: item.id,
    number: workItemNumber(item),
    title: truncate(item.title, MAX_TEXT),
    board: boardForWorkItem(item),
    stage: workItemStage(item),
    url: workItemUrl(item),
    activeWorker: activeWorker(bindings, item.id),
    requestedBy: item.createdBy,
    updatedAt: iso(item.updatedAt),
  };
}

function summarizeDecision(decision: FactoryDeferredDecisionRecord, overtaken = false) {
  const type = typeof decision.decision.type === 'string' ? decision.decision.type : 'decision';
  const role = typeof decision.decision.role === 'string' ? decision.decision.role : null;
  return {
    id: decision.id,
    workItemId: decision.workItemId,
    type,
    role,
    status: decision.status,
    attempts: decision.attempts,
    failureCode: decision.failureCode,
    failureLabel: decision.failureCode ? factoryDispatchFailureMetadata(decision.failureCode).label : null,
    canRetry: decisionRetryable(decision, overtaken),
    error: decision.lastError ? truncate(decision.lastError, MAX_ERROR) : null,
    approvedBy: decision.approvedBy,
    updatedAt: iso(decision.updatedAt),
  };
}

/**
 * Held: a card triage left resting (or whose source asks for approval), until a person moves it
 * on. A card that has been past triage since (parked by self-review, or dragged back) resumes
 * instead, matching the board's held state.
 */
function isHeld(boards: BoardRegistry, item: Card): boolean {
  const board = boards.get(boardForWorkItem(item));
  const stage = item.stages.length === 1 ? item.stages[0]! : undefined;
  if (!board || !stage || board.phaseKind(stage) !== 'resting') return false;
  if (needsApproval(item, phase => awaitsAcceptance(board, phase))) return true;
  const triage = boardFlow(board).triage;
  const triageRole = triage ? board.roleForPhase(triage) : undefined;
  if (!triageRole || item.sessions[triageRole] === undefined) return false;
  return !item.stageHistory.some(entry => entry.stage !== triage && board.isWorking(entry.stage));
}

const listInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe(
        'What the board\'s search box takes: case-insensitive words of the title, a whole card number like "#123", a key (ENG-42, owner/repo#123), a branch or card id, or the link of an issue or pull request, which finds the cards tracking it, a pull request attached to its issue\'s card included.',
      ),
    stage: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .describe(
        'Only items in this stage, by its key as items list it (e.g. "intake" or "planning"); a board\'s review stage key can differ from its name.',
      ),
    board: z.string().min(1).max(64).optional().describe('Only items on this board, by its key, e.g. "work".'),
    role: z.string().min(1).max(64).optional().describe('Only items that have a session for this role.'),
    active: z.boolean().optional().describe('true: only items with an agent working now; false: only idle items.'),
    requestedBy: z.literal('me').optional().describe('"me": only items you filed.'),
    subscribed: z
      .boolean()
      .optional()
      .describe('true: only items this session follows; false: only items it does not.'),
    limit: z.number().int().min(1).max(MAX_LIST).optional().describe(`Default ${DEFAULT_LIST}, max ${MAX_LIST}.`),
  })
  .strict();

export function createFactoryReadTools(scope: FactoryToolScope, deps: FactoryReadToolDependencies): IntegrationTools {
  const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
  return {
    factory_list_work_items: createTool({
      id: 'factory_list_work_items',
      description:
        "List this Factory's work items, newest activity first, with counts per stage for the whole Factory. Filter by text or #number, stage, board, role, whether an agent is working on it, items you filed, or items this session follows. Check here for an existing item before filing a new one.",
      inputSchema: listInputSchema,
      execute: async input => {
        const [items, bindings, followed] = await Promise.all([
          deps.workItems.listShared(project),
          deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId),
          input.subscribed === undefined
            ? undefined
            : deps.workItems.listSessionSubscriptions({ ...project, sessionId: scope.sessionId }),
        ]);
        const followedIds = new Set(followed?.map(subscription => subscription.workItemId));
        const byStage: Record<string, number> = {};
        for (const item of items) {
          const stage = workItemStage(item);
          byStage[stage] = (byStage[stage] ?? 0) + 1;
        }
        // The board's search, with what it computed of each card.
        const terms = searchTerms(input.query ?? '');
        const matches = items
          .filter(item => {
            if (!matchesSearch(cardFacts(item).search, terms)) return false;
            if (input.stage && !item.stages.includes(input.stage)) return false;
            if (input.board && boardForWorkItem(item) !== input.board) return false;
            if (input.role && !item.sessions[input.role]) return false;
            if (input.active !== undefined && (activeWorker(bindings, item.id) !== null) !== input.active) return false;
            if (input.requestedBy === 'me' && item.createdBy !== scope.userId) return false;
            if (input.subscribed !== undefined && followedIds.has(item.id) !== input.subscribed) return false;
            return true;
          })
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        const limit = input.limit ?? DEFAULT_LIST;
        return {
          counts: { total: items.length, byStage },
          items: matches.slice(0, limit).map(item => summarizeItem(item, bindings)),
          truncated: matches.length > limit,
        };
      },
    }),

    factory_inspect_work_item: createTool({
      id: 'factory_inspect_work_item',
      description:
        'Everything the Factory knows about one work item: its description, the stages its board lets it move to next, stage history, sessions by role (with whether each is mid-run and when its thread last moved), decisions with errors, recent audit events, labels, linked items and the sessions following it. Use it to explain why an item is where it is, and to pick the stage key factory_transition_work_item takes.',
      inputSchema: z.object({ workItem: workItemRefSchema }).strict(),
      execute: async ({ workItem }) => {
        const item = await findWorkItem(deps.workItems, scope, workItem);
        if (!item) throw workItemNotFound(workItem);
        const [bindings, decisions, audit, all, subscribers] = await Promise.all([
          deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, item.id),
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, { workItemId: item.id }),
          deps.audit.list({ ...project, limit: 200 }),
          deps.workItems.listShared(project),
          deps.workItems.listWorkItemSubscribers({ orgId: scope.orgId, workItemId: item.id }),
        ]);
        const itemDecisions = decisions.slice(-MAX_LIST);
        const boards = await toBoardSource(deps.boards).load(project);
        const overtaken = await overtakenDecisionIds(
          deps.workItems,
          boards,
          project,
          itemDecisions.filter(decision => decision.status === 'failed'),
        );
        const labels = Array.isArray(item.workItem.labels)
          ? item.workItem.labels.filter((label): label is string => typeof label === 'string').slice(0, MAX_LIST)
          : [];
        const parent = item.parentWorkItemId
          ? all.find(candidate => candidate.id === item.parentWorkItemId)
          : undefined;
        const children = all.filter(candidate => candidate.parentWorkItemId === item.id);
        const controller = (await deps.messaging?.())?.controller;
        const activity = async (sessionId: string, threadId: string): Promise<FactorySessionActivity | null> =>
          controller ? sessionActivity(controller, sessionId, threadId) : null;
        const sessions = await Promise.all(
          Object.entries(item.sessions).map(async ([role, ref]) => ({
            role,
            sessionId: ref.sessionId,
            threadId: ref.threadId,
            url:
              factorySessionUrl({
                factoryProjectId: item.factoryProjectId,
                sessionId: ref.sessionId,
                threadId: ref.threadId,
              }) ?? null,
            startedBy: ref.startedBy,
            active: bindings.some(
              binding => binding.role === role && binding.sessionId === ref.sessionId && binding.status === 'active',
            ),
            // `running` with an old `lastActivityAt` is a stuck run; `running` with a recent one is a long one.
            ...((await activity(ref.sessionId, ref.threadId)) ?? { running: null, lastActivityAt: null }),
          })),
        );
        return {
          item: {
            ...summarizeItem(item, bindings),
            description: item.description,
            source: item.externalSource ? `${item.externalSource.integrationId}:${item.externalSource.type}` : 'manual',
            sourceUrl: typeof item.workItem.url === 'string' ? item.workItem.url : null,
            revision: item.revision,
          },
          moves: boardMoves(boards.get(boardForWorkItem(item)), item),
          labels,
          stageHistory: item.stageHistory.slice(-MAX_LIST).map(entry => ({
            stage: entry.stage,
            enteredAt: entry.enteredAt,
            exitedAt: entry.exitedAt ?? null,
            by: entry.by,
          })),
          sessions,
          decisions: itemDecisions.map(decision => summarizeDecision(decision, overtaken.has(decision.id))),
          audit: audit.events
            .filter(event => event.targets.some(target => target.type === 'work_item' && target.id === item.id))
            .slice(0, 25)
            .map(event => ({
              action: event.action,
              actorId: event.actorId,
              actorType: event.actorType,
              occurredAt: iso(event.occurredAt),
            })),
          parent: parent ? summarizeItem(parent, bindings) : null,
          children: children.slice(0, MAX_LIST).map(child => summarizeItem(child, bindings)),
          subscribers: subscribers.slice(0, MAX_LIST).map(subscription => ({
            sessionId: subscription.sessionId,
            reason: subscription.reason,
            isCaller: subscription.sessionId === scope.sessionId,
          })),
        };
      },
    }),

    factory_list_attention: createTool({
      id: 'factory_list_attention',
      description:
        'What in this Factory needs a person: failed decisions grouped by failure code and error (one incident per group), proposals waiting for approval, runs parked on a tool prompt (a plan to review, a question to answer) while still in flight, and Work cards triage left in Intake for a person to move on.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_LIST).optional() }).strict(),
      execute: async ({ limit = DEFAULT_LIST }) => {
        const [decisions, items] = await Promise.all([
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, {
            statuses: ['failed', 'proposed'],
          }),
          deps.workItems.listShared(project),
        ]);
        const itemsById = new Map(items.map(item => [item.id, item]));
        const failed = decisions.filter(decision => decision.status === 'failed');
        const groups = new Map<
          string,
          { failureCode: string; error: string; decisions: FactoryDeferredDecisionRecord[] }
        >();
        for (const decision of failed) {
          const error = truncate(decision.lastError ?? '', MAX_ERROR);
          const key = `${decision.failureCode ?? 'unknown'}|${error}`;
          const group = groups.get(key) ?? { failureCode: decision.failureCode ?? 'unknown', error, decisions: [] };
          group.decisions.push(decision);
          groups.set(key, group);
        }
        const ref = (workItemId: string | null) => {
          const item = workItemId ? itemsById.get(workItemId) : undefined;
          return {
            workItemId,
            number: item ? workItemNumber(item) : null,
            title: item ? truncate(item.title, MAX_TEXT) : null,
            url: item ? workItemUrl(item) : null,
          };
        };
        const allIncidents = [...groups.values()].sort((a, b) => b.decisions.length - a.decisions.length);
        const incidents = allIncidents
          .slice(0, limit)
          .map(group => ({ ...group, shown: group.decisions.slice(0, limit) }));
        // Check exactly the decisions this call returns, so every canRetry is real.
        const boards = await toBoardSource(deps.boards).load(project);
        const overtaken = await overtakenDecisionIds(
          deps.workItems,
          boards,
          project,
          incidents.flatMap(group => group.shown),
        );
        const proposals = decisions.filter(decision => decision.status === 'proposed');
        const held = items.filter(item => isHeld(boards, item));
        const waiting = (deps.liveSessions?.()?.parkedIn(scope.factoryProjectId) ?? []).sort(
          (a, b) => a.run.suspendedAt - b.run.suspendedAt,
        );
        return {
          incidents: incidents.map(group => ({
            failureCode: group.failureCode,
            failureLabel: factoryDispatchFailureMetadata(group.decisions[0]!.failureCode).label,
            error: group.error,
            count: group.decisions.length,
            decisions: group.shown.map(decision => ({
              id: decision.id,
              ...ref(decision.workItemId),
              attempts: decision.attempts,
              canRetry: decisionRetryable(decision, overtaken.has(decision.id)),
            })),
          })),
          proposals: proposals
            .slice(0, limit)
            .map(decision => ({ ...summarizeDecision(decision), ...ref(decision.workItemId) })),
          waiting: waiting.slice(0, limit).map(({ sessionId, run }) => ({
            sessionId,
            toolName: run.toolName,
            label: parkedRunLabel(run.toolName),
            waitingSince: new Date(run.suspendedAt).toISOString(),
          })),
          held: held.slice(0, limit).map(item => ({
            ...ref(item.id),
            stage: workItemStage(item),
          })),
          truncated:
            allIncidents.length > limit ||
            incidents.some(group => group.shown.length < group.decisions.length) ||
            proposals.length > limit ||
            waiting.length > limit ||
            held.length > limit,
        };
      },
    }),
  };
}
