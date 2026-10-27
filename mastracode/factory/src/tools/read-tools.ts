import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { IntegrationTools } from '../integrations/base.js';
import { decisionRetryable, overtakenDecisionIds } from '../rules/decision-applicability.js';
import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryRunBindingRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
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
    | 'list'
    | 'getForProject'
    | 'listRunBindings'
    | 'listDeferredDecisions'
    | 'listByIds'
    | 'listDecisionsForEvaluations'
    | 'listWorkItemSubscribers'
    | 'listSessionSubscriptions'
  >;
  comments: Pick<WorkItemCommentsStorage, 'listRecent'>;
  audit: Pick<AuditStorage, 'list'>;
  boards: BoardRegistry;
  /** The live controller, for whether a session is mid-run and when it last moved; absent before the mount is up. */
  messaging?: () => Promise<Pick<FactoryMessaging, 'controller'> | null>;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** The number a person sees on the card: the issue or PR number the item was filed from. */
export function workItemNumber(item: Pick<WorkItemRow, 'metadata'>): number | null {
  const number = item.metadata?.number ?? item.metadata?.githubIssueNumber ?? item.metadata?.githubPullRequestNumber;
  return typeof number === 'number' ? number : null;
}

export function workItemStage(item: Pick<WorkItemRow, 'stages'>): string {
  return item.stages.join('+');
}

/** A work item id or its card number; anything else can't name an item. */
export const workItemRefSchema = z
  .string()
  .trim()
  .max(64)
  .refine(ref => z.string().uuid().safeParse(ref).success || /^#?\d+$/.test(ref), {
    message: 'Use a work item id (UUID) or its number like "#123".',
  })
  .describe('Work item id, or its number like "#123".');

/** Resolve `<uuid>` or `#123` to an item in this Factory only. Pass a ref validated by `workItemRefSchema`. */
export async function findWorkItem(
  workItems: Pick<WorkItemsStorage, 'list' | 'getForProject'>,
  scope: Pick<FactoryToolScope, 'orgId' | 'factoryProjectId'>,
  ref: string,
): Promise<WorkItemRow | null> {
  const trimmed = ref.trim();
  const number = /^#?(\d+)$/.exec(trimmed)?.[1];
  if (number === undefined) return workItems.getForProject(scope.orgId, scope.factoryProjectId, trimmed);
  const items = await workItems.list(scope);
  const matches = items.filter(item => workItemNumber(item) === Number(number));
  // Issue and PR numbers share a space on GitHub; prefer the Work-board card.
  return matches.find(item => item.externalSource?.type !== 'pull-request') ?? matches[0] ?? null;
}

export function workItemNotFound(ref: string): Error {
  return new Error(`No work item ${ref} was found in this Factory.`);
}

function activeWorker(bindings: FactoryRunBindingRecord[], itemId: string) {
  const binding = bindings.find(candidate => candidate.workItemId === itemId && candidate.status === 'active');
  return binding ? { role: binding.role, sessionId: binding.sessionId } : null;
}

function summarizeItem(item: WorkItemRow, bindings: FactoryRunBindingRecord[]) {
  return {
    id: item.id,
    number: workItemNumber(item),
    title: truncate(item.title, MAX_TEXT),
    board: boardForWorkItem(item),
    stage: workItemStage(item),
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

const listInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe('Case-insensitive text in the title, or an exact card number like "#123".'),
    stage: z.string().min(1).max(64).optional().describe('Only items in this stage, e.g. "triage" or "review".'),
    board: z.string().min(1).max(64).optional().describe('Only items on this board, e.g. "work" or "review".'),
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
          deps.workItems.list(project),
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
        const numberQuery = input.query ? /^#(\d+)$/.exec(input.query)?.[1] : undefined;
        const text = input.query?.toLowerCase();
        const matches = items
          .filter(item => {
            if (numberQuery !== undefined) {
              if (workItemNumber(item) !== Number(numberQuery)) return false;
            } else if (text && !item.title.toLowerCase().includes(text)) return false;
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
        'Everything the Factory knows about one work item: stage history, sessions by role (with whether each is mid-run and when its thread last moved), decisions with errors, recent audit events, recent feed comments, labels, linked items and the sessions following it. Use it to explain why an item is where it is.',
      inputSchema: z.object({ workItem: workItemRefSchema }).strict(),
      execute: async ({ workItem }) => {
        const item = await findWorkItem(deps.workItems, scope, workItem);
        if (!item) throw workItemNotFound(workItem);
        const [bindings, decisions, audit, feed, all, subscribers] = await Promise.all([
          deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, item.id),
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, { workItemId: item.id }),
          deps.audit.list({ ...project, limit: 200 }),
          deps.comments.listRecent({ ...project, workItemId: item.id, limit: 10 }),
          deps.workItems.list(project),
          deps.workItems.listWorkItemSubscribers({ orgId: scope.orgId, workItemId: item.id }),
        ]);
        const itemDecisions = decisions.slice(-MAX_LIST);
        const overtaken = await overtakenDecisionIds(
          deps.workItems,
          deps.boards,
          project,
          itemDecisions.filter(decision => decision.status === 'failed'),
        );
        const labels = Array.isArray(item.metadata?.labels)
          ? item.metadata.labels.filter((label): label is string => typeof label === 'string').slice(0, MAX_LIST)
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
            source: item.externalSource ? `${item.externalSource.integrationId}:${item.externalSource.type}` : 'manual',
            url: typeof item.metadata?.url === 'string' ? item.metadata.url : null,
            triageType: item.triageType,
            revision: item.revision,
          },
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
          feed: feed.map(comment => ({
            id: comment.id,
            kind: comment.kind,
            author: comment.author,
            occurredAt: iso(comment.occurredAt),
            body: truncate(comment.body, MAX_TEXT),
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
        'What in this Factory needs a person: failed decisions grouped by failure code and error (one incident per group), proposals waiting for approval, and items triage is holding until someone accepts them.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_LIST).optional() }).strict(),
      execute: async ({ limit = DEFAULT_LIST }) => {
        const [decisions, items] = await Promise.all([
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, {
            statuses: ['failed', 'proposed'],
          }),
          deps.workItems.list(project),
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
          };
        };
        const allIncidents = [...groups.values()].sort((a, b) => b.decisions.length - a.decisions.length);
        const incidents = allIncidents
          .slice(0, limit)
          .map(group => ({ ...group, shown: group.decisions.slice(0, limit) }));
        // Check exactly the decisions this call returns, so every canRetry is real.
        const overtaken = await overtakenDecisionIds(
          deps.workItems,
          deps.boards,
          project,
          incidents.flatMap(group => group.shown),
        );
        const proposals = decisions.filter(decision => decision.status === 'proposed');
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
          truncated:
            allIncidents.length > limit ||
            incidents.some(group => group.shown.length < group.decisions.length) ||
            proposals.length > limit,
        };
      },
    }),
  };
}
