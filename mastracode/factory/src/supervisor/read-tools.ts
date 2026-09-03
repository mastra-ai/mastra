/**
 * Supervisor read surface. Every tool is bounded (hard row caps, truncated
 * text) and answers with ids a person can click on the board, so the model
 * can explain a card's state without ever touching the database itself.
 */

import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import { FACTORY_RULE_STAGES, factoryRuleStage } from '../rules/types.js';
import type { FactoryRuleStage } from '../rules/types.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type {
  FactoryDeferredDecisionRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import type { FactoryHealthReport, FactoryHealthThresholds } from './health.js';
import { runFactoryHealthCheck } from './health.js';

export interface SupervisorScope {
  orgId: string;
  factoryProjectId: string;
}

export interface SupervisorMessageReader {
  listMessages(input: {
    threadId: string;
    resourceId?: string;
    page: number;
    perPage: number;
    orderBy: { field: 'createdAt'; direction: 'ASC' | 'DESC' };
  }): Promise<{ messages: MastraDBMessage[]; hasMore: boolean }>;
}

export interface SupervisorReadDependencies {
  scope: SupervisorScope;
  workItems: WorkItemsStorage;
  comments: WorkItemCommentsStorage;
  audit: AuditStorage;
  messageReader?: SupervisorMessageReader;
  healthThresholds?: FactoryHealthThresholds;
  now?: () => Date;
}

const MAX_TEXT = 600;
const MAX_ERROR = 400;
const MAX_LIST = 50;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function itemNumber(item: WorkItemRow): number | null {
  const number = item.metadata?.number ?? item.metadata?.githubIssueNumber ?? item.metadata?.githubPullRequestNumber;
  return typeof number === 'number' ? number : null;
}

function itemLabels(item: WorkItemRow): string[] {
  const labels = item.metadata?.labels;
  return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === 'string') : [];
}

function summarizeItem(item: WorkItemRow) {
  return {
    id: item.id,
    number: itemNumber(item),
    title: item.title,
    stage: factoryRuleStage(item.stages) ?? item.stages.join('+'),
    source: item.externalSource ? `${item.externalSource.integrationId}:${item.externalSource.type}` : 'manual',
    url: typeof item.metadata?.url === 'string' ? item.metadata.url : null,
    triageType: item.triageType,
    acceptedAt: iso(item.acceptedAt),
    autonomyArmedAt: iso(item.autonomyArmedAt),
    parentWorkItemId: item.parentWorkItemId,
    revision: item.revision,
    updatedAt: iso(item.updatedAt),
  };
}

function summarizeDecision(decision: FactoryDeferredDecisionRecord) {
  const type = typeof decision.decision.type === 'string' ? decision.decision.type : 'decision';
  const role = typeof decision.decision.role === 'string' ? decision.decision.role : null;
  const skill = typeof decision.decision.skillName === 'string' ? decision.decision.skillName : null;
  return {
    id: decision.id,
    workItemId: decision.workItemId,
    type,
    role,
    skill,
    status: decision.status,
    attempts: decision.attempts,
    availableAt: iso(decision.availableAt),
    leaseOwner: decision.leaseOwner,
    leaseExpiresAt: iso(decision.leaseExpiresAt),
    failureCode: decision.failureCode,
    failureLabel: decision.failureCode ? factoryDispatchFailureMetadata(decision.failureCode).label : null,
    canRetry: decision.status === 'failed' ? factoryDispatchFailureMetadata(decision.failureCode).canRetry : false,
    lastError: decision.lastError ? truncate(decision.lastError, MAX_ERROR) : null,
    approvedBy: decision.approvedBy,
    createdAt: iso(decision.createdAt),
    updatedAt: iso(decision.updatedAt),
    completedAt: iso(decision.completedAt),
  };
}

function messageParts(content: unknown): unknown[] {
  if (Array.isArray(content)) return content;
  if (content && typeof content === 'object') {
    const parts = (content as { parts?: unknown }).parts;
    if (Array.isArray(parts)) return parts;
  }
  return [];
}

function messageText(message: MastraDBMessage): string {
  const content: unknown = message.content;
  const parts = messageParts(content);
  const text: string[] = [];
  for (const part of parts) {
    if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'text') {
      const value = (part as { text?: unknown }).text;
      if (typeof value === 'string') text.push(value);
    }
  }
  if (text.length === 0 && typeof content === 'string') text.push(content);
  return text.join('\n');
}

function messageToolCalls(message: MastraDBMessage): Array<{ tool: string; state: string | null }> {
  const parts = messageParts(message.content);
  const calls: Array<{ tool: string; state: string | null }> = [];
  for (const rawPart of parts) {
    if (!rawPart || typeof rawPart !== 'object') continue;
    const part = rawPart as Record<string, unknown>;
    const invocation =
      part.type === 'tool-invocation' && part.toolInvocation && typeof part.toolInvocation === 'object'
        ? (part.toolInvocation as Record<string, unknown>)
        : typeof part.type === 'string' && part.type.startsWith('tool-')
          ? part
          : undefined;
    if (!invocation) continue;
    const name = invocation.toolName ?? invocation.name ?? (typeof part.type === 'string' ? part.type.slice(5) : null);
    if (typeof name !== 'string') continue;
    calls.push({ tool: name, state: typeof invocation.state === 'string' ? invocation.state : null });
  }
  return calls;
}

async function findItem(
  deps: SupervisorReadDependencies,
  ref: { id?: string; number?: number },
): Promise<WorkItemRow | null> {
  if (ref.id) return deps.workItems.getForProject(deps.scope.orgId, deps.scope.factoryProjectId, ref.id);
  if (ref.number === undefined) return null;
  const items = await deps.workItems.list(deps.scope);
  const matches = items.filter(item => itemNumber(item) === ref.number);
  // Issue and PR numbers share a space on GitHub; prefer the Work-board card.
  return matches.find(item => item.externalSource?.type !== 'pull-request') ?? matches[0] ?? null;
}

const itemRefSchema = z
  .object({
    id: z.string().uuid().optional().describe('Work item id.'),
    number: z.number().int().positive().optional().describe('Card number as shown on the board, e.g. 22874.'),
  })
  .refine(ref => ref.id !== undefined || ref.number !== undefined, { message: 'Provide an id or a number.' });

export function createFactorySupervisorReadTools(deps: SupervisorReadDependencies): IntegrationTools {
  const now = deps.now ?? (() => new Date());
  const scope = deps.scope;

  return {
    factory_overview: createTool({
      id: 'factory_overview',
      description:
        'Counts per pipeline stage, decisions by status, active seats, open proposals and held cards for this Factory. Start here for "what needs me" questions.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const [items, decisions, bindings, pendingStarts] = await Promise.all([
          deps.workItems.list(scope),
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId),
          deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId),
          deps.workItems.listPendingStarts(scope.orgId, scope.factoryProjectId),
        ]);
        const stages = Object.fromEntries(FACTORY_RULE_STAGES.map(stage => [stage, 0])) as Record<
          FactoryRuleStage,
          number
        >;
        let held = 0;
        for (const item of items) {
          const stage = factoryRuleStage(item.stages);
          if (stage) stages[stage] += 1;
          if (stage === 'triage' && item.triageType && item.triageType !== 'bug' && !item.acceptedAt) held += 1;
        }
        const decisionsByStatus: Record<string, number> = {};
        for (const decision of decisions) {
          decisionsByStatus[decision.status] = (decisionsByStatus[decision.status] ?? 0) + 1;
        }
        const activeSeats = bindings.filter(binding => binding.status === 'active');
        const seatsByRole: Record<string, number> = {};
        for (const seat of activeSeats) seatsByRole[seat.role] = (seatsByRole[seat.role] ?? 0) + 1;
        return {
          checkedAt: now().toISOString(),
          workItems: { total: items.length, byStage: stages, heldForDecision: held },
          decisions: decisionsByStatus,
          openProposals: decisions
            .filter(d => d.status === 'proposed')
            .map(summarizeDecision)
            .slice(0, MAX_LIST),
          failedDecisions: decisions
            .filter(d => d.status === 'failed')
            .map(summarizeDecision)
            .slice(0, MAX_LIST),
          activeSeats: { total: activeSeats.length, byRole: seatsByRole },
          pendingStarts: pendingStarts.filter(start => start.status !== 'sent').length,
        };
      },
    }),

    factory_health_check: createTool({
      id: 'factory_health_check',
      description:
        'Deterministic list of things wrong with this Factory right now (failed or stuck decisions, stalled starts, orphaned or missing seats, proposals and held cards waiting on a person, label drift). Each finding carries evidence and the standard repair. Explain these; do not invent findings that are not listed.',
      inputSchema: z.object({}).strict(),
      execute: async (): Promise<FactoryHealthReport> =>
        runFactoryHealthCheck(deps.workItems, scope, { now: now(), thresholds: deps.healthThresholds }),
    }),

    factory_inspect_work_item: createTool({
      id: 'factory_inspect_work_item',
      description:
        'Everything the Factory knows about one card: row, stage history, seats (run bindings), decisions with errors, recent audit events, recent feed comments, linked parent/children and last observed labels. Use for "why is #N in this state".',
      inputSchema: itemRefSchema,
      execute: async ref => {
        const item = await findItem(deps, ref);
        if (!item) throw new Error(`No work item matches ${ref.id ?? `#${ref.number}`} in this Factory.`);
        const [decisions, bindings, audit, feed, all] = await Promise.all([
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId),
          deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, item.id),
          deps.audit.list({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId, limit: 200 }),
          deps.comments.listRecent({ ...scope, workItemId: item.id, limit: 10 }),
          deps.workItems.list(scope),
        ]);
        const parent = item.parentWorkItemId
          ? all.find(candidate => candidate.id === item.parentWorkItemId)
          : undefined;
        const children = all.filter(candidate => candidate.parentWorkItemId === item.id);
        return {
          item: summarizeItem(item),
          labels: itemLabels(item),
          stageHistory: item.stageHistory.map(entry => ({
            stage: entry.stage,
            enteredAt: entry.enteredAt,
            exitedAt: entry.exitedAt ?? null,
            by: entry.by,
          })),
          sessions: Object.entries(item.sessions).map(([role, ref]) => ({
            role,
            sessionId: ref.sessionId,
            threadId: ref.threadId,
            branch: ref.branch,
            startedBy: ref.startedBy,
          })),
          seats: bindings.map(binding => ({
            id: binding.id,
            role: binding.role,
            status: binding.status,
            sessionId: binding.sessionId,
            threadId: binding.threadId,
            createdAt: iso(binding.createdAt),
            revokedAt: iso(binding.revokedAt),
          })),
          decisions: decisions
            .filter(decision => decision.workItemId === item.id)
            .map(summarizeDecision)
            .slice(-MAX_LIST),
          audit: audit.events
            .filter(event => event.targets.some(target => target.type === 'work_item' && target.id === item.id))
            .slice(0, 25)
            .map(event => ({
              id: event.id,
              action: event.action,
              actorId: event.actorId,
              actorType: event.actorType,
              occurredAt: iso(event.occurredAt),
              metadata: event.metadata,
            })),
          feed: feed.map(comment => ({
            id: comment.id,
            kind: comment.kind,
            author: comment.author,
            occurredAt: iso(comment.occurredAt),
            body: truncate(comment.body, MAX_TEXT),
          })),
          parent: parent ? summarizeItem(parent) : null,
          children: children.map(summarizeItem),
        };
      },
    }),

    factory_list_attention: createTool({
      id: 'factory_list_attention',
      description:
        'Failed decisions grouped by failure code and error text, so a batch of cards that broke the same way reads as one incident. Also lists proposals waiting on a person and terminal cards that still hold seats.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_LIST).default(25) }).strict(),
      execute: async ({ limit }) => {
        const [decisions, items] = await Promise.all([
          deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId),
          deps.workItems.list(scope),
        ]);
        const itemsById = new Map(items.map(item => [item.id, item]));
        const groups = new Map<
          string,
          { failureCode: string; error: string; decisions: FactoryDeferredDecisionRecord[] }
        >();
        for (const decision of decisions) {
          if (decision.status !== 'failed') continue;
          const error = truncate(decision.lastError ?? '', 160);
          const key = `${decision.failureCode ?? 'unknown'}|${error}`;
          const group = groups.get(key) ?? { failureCode: decision.failureCode ?? 'unknown', error, decisions: [] };
          group.decisions.push(decision);
          groups.set(key, group);
        }
        const incidents = [...groups.values()]
          .sort((a, b) => b.decisions.length - a.decisions.length)
          .slice(0, limit)
          .map(group => ({
            failureCode: group.failureCode,
            failureLabel: factoryDispatchFailureMetadata(group.decisions[0]!.failureCode).label,
            error: group.error,
            count: group.decisions.length,
            firstFailedAt: iso(
              new Date(
                group.decisions.reduce(
                  (earliest, decision) => Math.min(earliest, decision.updatedAt.getTime()),
                  Infinity,
                ),
              ),
            ),
            lastFailedAt: iso(
              new Date(
                group.decisions.reduce((latest, decision) => Math.max(latest, decision.updatedAt.getTime()), -Infinity),
              ),
            ),
            decisions: group.decisions.slice(0, limit).map(decision => {
              const item = decision.workItemId ? itemsById.get(decision.workItemId) : undefined;
              return {
                id: decision.id,
                workItemId: decision.workItemId,
                number: item ? itemNumber(item) : null,
                title: item?.title ?? null,
                attempts: decision.attempts,
              };
            }),
          }));
        return {
          incidents,
          proposals: decisions
            .filter(d => d.status === 'proposed')
            .slice(0, limit)
            .map(summarizeDecision),
        };
      },
    }),

    factory_read_session: createTool({
      id: 'factory_read_session',
      description:
        "The most recent turns of a card's shared agent thread: who spoke, when, the text (truncated) and which tools were called. Use to see what a worker actually did. Give a work item (id or number) or a threadId.",
      inputSchema: z
        .object({
          id: z.string().uuid().optional(),
          number: z.number().int().positive().optional(),
          threadId: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(40).default(20),
        })
        .strict()
        .refine(ref => ref.id !== undefined || ref.number !== undefined || ref.threadId !== undefined, {
          message: 'Provide a work item id, a number, or a threadId.',
        }),
      execute: async ({ limit, ...ref }) => {
        if (!deps.messageReader) throw new Error('Session transcripts are not available on this deployment.');
        let threadId = ref.threadId;
        let resourceId: string | undefined;
        if (!threadId) {
          const item = await findItem(deps, ref);
          if (!item) throw new Error(`No work item matches ${ref.id ?? `#${ref.number}`} in this Factory.`);
          const session = Object.values(item.sessions)[0];
          if (!session) return { threadId: null, item: summarizeItem(item), turns: [] };
          threadId = session.threadId;
          resourceId = session.sessionId;
        } else {
          // A thread the caller named must still belong to a card in this Factory.
          const bindings = await deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId);
          const binding = bindings.find(candidate => candidate.threadId === threadId);
          if (!binding) throw new Error(`Thread ${threadId} is not bound to a card in this Factory.`);
          resourceId = binding.resourceId;
        }
        const page = await deps.messageReader.listMessages({
          threadId,
          ...(resourceId ? { resourceId } : {}),
          page: 0,
          perPage: limit,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });
        const turns = [...page.messages].reverse().map(message => ({
          id: message.id,
          role: message.role,
          createdAt: iso(message.createdAt),
          text: truncate(messageText(message), MAX_TEXT),
          tools: messageToolCalls(message),
        }));
        return { threadId, hasOlder: page.hasMore, turns };
      },
    }),
  };
}
