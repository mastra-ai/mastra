import { createHash } from 'node:crypto';

import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  ProcessInputStepArgs,
  Processor,
} from '@mastra/core/processors';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent/message-list';

import type {
  FactoryRunBindingRecord,
  WorkItemsStorage,
  WorkItemRow,
} from '../../storage/domains/work-items/base.js';
import { getFactorySessionCoordinates } from './binding-context.js';
import { resolveFactoryToolRule } from './resolve.js';
import {
  FACTORY_RULE_STAGES,
  type FactoryCommitDecision,
  type FactoryRuleBoard,
  type FactoryRuleDecision,
  type FactoryRuleJsonValue,
  type FactoryRules,
  type FactoryToolResultRuleContext,
} from './types.js';
import { normalizeFactoryRuleJsonValue, validateFactoryRuleDecisions } from './validation.js';
import type { FactoryTransitionService } from './transition-service.js';

const STATE_ID = 'factory-phase';
const RULE_TIMEOUT_MS = 5_000;
const TRANSCRIPT_PAGE_SIZE = 50;
const MAX_LINKED_ITEMS = 5;
const PHASE_LABELS: Record<(typeof FACTORY_RULE_STAGES)[number], string> = {
  intake: 'Intake',
  triage: 'Investigating',
  planning: 'Planning',
  execute: 'Building',
  review: 'Reviewing',
  done: 'Done',
};

type PersistedMessageReader = {
  listMessages(input: {
    threadId: string;
    resourceId?: string;
    page: number;
    perPage: number;
    filter?: { dateRange?: { start?: Date } };
    orderBy: { field: 'createdAt'; direction: 'ASC' };
  }): Promise<{ messages: MastraDBMessage[]; hasMore: boolean }>;
};

type CompletedToolResult = {
  assistantMessageId: string;
  messageCreatedAt: Date;
  toolCallId: string;
  toolName: string;
  status: 'success' | 'error';
  value: FactoryRuleJsonValue;
};

type PhaseSnapshotValue = {
  bindingId?: string;
  itemId?: string;
  revision?: number;
  stage?: string;
  role?: string;
  board?: FactoryRuleBoard;
  ruleSetVersion?: string;
  status: 'active' | 'none';
};

function workItemSource(item: WorkItemRow) {
  if (!item.externalSource) return 'manual' as const;
  if (item.externalSource.integrationId === 'linear') return 'linear-issue' as const;
  return item.externalSource.type === 'pull-request' ? ('github-pr' as const) : ('github-issue' as const);
}

function workItemSourceKey(item: WorkItemRow): string | null {
  const source = item.externalSource;
  return source ? `${source.integrationId}:${source.type}:${source.externalId}` : null;
}

function boardForItem(item: WorkItemRow): FactoryRuleBoard {
  return item.externalSource?.type === 'pull-request' ? 'review' : 'work';
}

function boundedError(value: unknown): FactoryRuleJsonValue {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : 'Tool execution failed.';
  return { message: message.slice(0, 2_000) };
}

function boundedResult(value: unknown): FactoryRuleJsonValue {
  try {
    return normalizeFactoryRuleJsonValue(value);
  } catch {
    return { message: 'Tool result was not serializable.' };
  }
}

function factoryStateSignalId(message: MastraDBMessage): string | undefined {
  if (message.role !== 'signal') return;
  const content = message.content as {
    metadata?: { signal?: { metadata?: { state?: { id?: unknown } } } };
  };
  return content.metadata?.signal?.metadata?.state?.id === STATE_ID ? message.id : undefined;
}

function messageParts(message: MastraDBMessage): unknown[] {
  const content = message.content as { parts?: unknown[]; toolInvocations?: unknown[] } | unknown[] | undefined;
  if (Array.isArray(content)) return content;
  if (Array.isArray(content?.parts)) return content.parts;
  return Array.isArray(content?.toolInvocations) ? content.toolInvocations : [];
}

function completedStepToolCallIds(steps: unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const rawStep of steps) {
    if (!rawStep || typeof rawStep !== 'object') continue;
    const toolResults = (rawStep as { toolResults?: unknown[] }).toolResults;
    if (!Array.isArray(toolResults)) continue;
    for (const rawResult of toolResults) {
      if (!rawResult || typeof rawResult !== 'object') continue;
      const toolCallId = (rawResult as { toolCallId?: unknown }).toolCallId;
      if (typeof toolCallId === 'string') ids.add(toolCallId);
    }
  }
  return ids;
}

function completedToolResults(message: MastraDBMessage): CompletedToolResult[] {
  if (message.role !== 'assistant') return [];
  const createdAt = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
  const completed: CompletedToolResult[] = [];
  for (const rawPart of messageParts(message)) {
    if (!rawPart || typeof rawPart !== 'object') continue;
    const part = rawPart as Record<string, unknown>;
    const invocation =
      part.type === 'tool-invocation' && part.toolInvocation && typeof part.toolInvocation === 'object'
        ? (part.toolInvocation as Record<string, unknown>)
        : part;
    const state = invocation.state;
    if (state !== 'result' && state !== 'error') continue;
    const toolCallId = invocation.toolCallId;
    const toolName = invocation.toolName ?? invocation.name;
    if (typeof toolCallId !== 'string' || typeof toolName !== 'string') continue;
    completed.push({
      assistantMessageId: message.id,
      messageCreatedAt: createdAt,
      toolCallId,
      toolName: toolName.slice(0, 256),
      status: state === 'error' ? 'error' : 'success',
      value: state === 'error' ? boundedError(invocation.result ?? invocation.error) : boundedResult(invocation.result),
    });
  }
  return completed;
}

function currentCompletedToolMessage(
  messages: MastraDBMessage[],
  toolCallIds: ReadonlySet<string>,
): MastraDBMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (completedToolResults(message).some(result => toolCallIds.has(result.toolCallId))) return message;
  }
  return undefined;
}

function phaseCacheKey(value: Omit<PhaseSnapshotValue, 'status'>, linked: WorkItemRow[]): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...value,
        linked: linked.map(item => [item.id, item.revision, item.stages[0]]),
      }),
    )
    .digest('hex');
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function priorPhase(args: ComputeStateSignalArgs): PhaseSnapshotValue | undefined {
  return (args.lastSnapshot?.metadata?.value as { phase?: PhaseSnapshotValue } | undefined)?.phase;
}

async function withRuleTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('FACTORY_RULE_TIMEOUT')), RULE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class FactoryPhaseStateProcessor implements Processor<'factory-phase'> {
  readonly id = STATE_ID;
  readonly stateId = STATE_ID;

  constructor(
    private readonly options: {
      rules: FactoryRules;
      storage: WorkItemsStorage;
      transitionService?: Pick<FactoryTransitionService, 'transition'>;
      messageReader?: PersistedMessageReader;
    },
  ) {}

  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | undefined> {
    const address = getFactorySessionCoordinates(args.requestContext);
    if (!address) return;
    const binding = await this.options.storage.findRunBindingBySession(address);
    const signalIds = args.messages.map(factoryStateSignalId).filter((id): id is string => Boolean(id));
    let removedSignals = false;
    if (!binding) return;
    if (binding.status !== 'active') {
      if (signalIds.length > 0) {
        args.messageList.removeByIds(signalIds);
        removedSignals = true;
      }
      return removedSignals ? args.messageList : undefined;
    }
    if (signalIds.length > 1) {
      args.messageList.removeByIds(signalIds.slice(0, -1));
      removedSignals = true;
    }
    const completedToolCallIds = completedStepToolCallIds(args.steps);
    const completedMessage = currentCompletedToolMessage(args.messages, completedToolCallIds);
    if (completedMessage) {
      await this.ingestMessages(binding, [completedMessage], completedToolCallIds);
    }
    return removedSignals ? args.messageList : undefined;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const address = getFactorySessionCoordinates(args.requestContext);
    if (!address) return;
    const binding = await this.options.storage.findRunBindingBySession(address);
    const prior = priorPhase(args);
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;

    if (!binding) return;
    if (binding.status !== 'active') {
      if (prior?.status !== 'active') return;
      return {
        id: STATE_ID,
        cacheKey: `factory:none:${prior.bindingId ?? 'revoked'}`,
        mode: 'snapshot',
        tagName: 'factory-phase',
        contents: '\n',
        value: { phase: { status: 'none' } },
        attributes: { status: 'none' },
        metadata: { value: { phase: { status: 'none' } } },
      };
    }

    const item = await this.options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
    if (!item || item.stages.length !== 1 || !FACTORY_RULE_STAGES.includes(item.stages[0] as never)) return;
    const allItems = await this.options.storage.list({ orgId: binding.orgId, factoryProjectId: binding.factoryProjectId });
    const linked = allItems
      .filter(candidate => candidate.parentWorkItemId === item.id || item.parentWorkItemId === candidate.id)
      .slice(0, MAX_LINKED_ITEMS);
    const board = boardForItem(item);
    const stage = item.stages[0]!;
    const value: PhaseSnapshotValue = {
      status: 'active',
      bindingId: binding.id,
      itemId: item.id,
      revision: item.revision,
      stage,
      role: binding.role,
      board,
      ruleSetVersion: this.options.rules.version,
    };
    const cacheKey = phaseCacheKey(value, linked);
    if (hasBase && (args.tracking?.currentCacheKey ?? args.lastSnapshot?.metadata?.state?.cacheKey) === cacheKey)
      return;

    const linkedText = linked.length
      ? `\nLinked items: ${linked.map(candidate => `${workItemSource(candidate)} ${candidate.title}`).join('; ')}`
      : '';
    return {
      id: STATE_ID,
      cacheKey,
      mode: 'snapshot',
      tagName: 'factory-phase',
      contents:
        `Factory ${board} phase: ${PHASE_LABELS[stage as keyof typeof PHASE_LABELS]} (${escapeText(stage)})\n` +
        `Work item: ${escapeText(item.title)} (${item.id})\n` +
        `Role: ${escapeText(binding.role)}\nRevision: ${item.revision}\nRules: ${escapeText(this.options.rules.version)}\n` +
        `Use factory_transition_work_item with expectedRevision ${item.revision} to request a phase change.${escapeText(linkedText)}`,
      value: { phase: value },
      attributes: { status: 'active', board, stage, role: binding.role, revision: item.revision },
      metadata: { value: { phase: value } },
    };
  }

  async reconcileAllBoundThreads(): Promise<void> {
    if (!this.options.messageReader) return;
    const bindings = await this.options.storage.listActiveRunBindings();
    for (const binding of bindings) await this.reconcileBinding(binding);
  }

  async reconcileBinding(binding: FactoryRunBindingRecord): Promise<void> {
    const reader = this.options.messageReader;
    if (!reader || binding.status !== 'active') return;
    const cursor = await this.options.storage.getToolResultCursor(binding.orgId, binding.factoryProjectId, binding.id);
    let page = 0;
    while (true) {
      const result = await reader.listMessages({
        threadId: binding.threadId,
        resourceId: binding.resourceId,
        page,
        perPage: TRANSCRIPT_PAGE_SIZE,
        ...(cursor ? { filter: { dateRange: { start: cursor.lastMessageCreatedAt } } } : {}),
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });
      await this.ingestMessages(binding, result.messages);
      const last = result.messages.at(-1);
      if (last) {
        await this.options.storage.advanceToolResultCursor({
          bindingId: binding.id,
          orgId: binding.orgId,
          factoryProjectId: binding.factoryProjectId,
          lastMessageId: last.id,
          lastMessageCreatedAt: last.createdAt instanceof Date ? last.createdAt : new Date(last.createdAt),
          updatedAt: new Date(),
        });
      }
      if (!result.hasMore) break;
      page += 1;
    }
  }

  private async ingestMessages(
    binding: FactoryRunBindingRecord,
    messages: MastraDBMessage[],
    toolCallIds?: ReadonlySet<string>,
  ): Promise<void> {
    const item = await this.options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
    if (!item || item.stages.length !== 1 || !FACTORY_RULE_STAGES.includes(item.stages[0] as never)) return;
    for (const message of messages) {
      for (const toolResult of completedToolResults(message)) {
        if (toolCallIds && !toolCallIds.has(toolResult.toolCallId)) continue;
        await this.ingestToolResult(binding, item, toolResult);
      }
    }
  }

  private async ingestToolResult(
    binding: FactoryRunBindingRecord,
    item: WorkItemRow,
    toolResult: CompletedToolResult,
  ): Promise<void> {
    const rule = resolveFactoryToolRule(this.options.rules, toolResult.toolName);
    if (!rule) return;
    const ingressId = JSON.stringify([
      binding.id,
      binding.threadId,
      toolResult.assistantMessageId,
      toolResult.toolCallId,
    ]);
    const prior = await this.options.storage.getTransitionResultByIngress(
      binding.orgId,
      binding.factoryProjectId,
      ingressId,
    );
    if (prior) return;
    const board = boardForItem(item);
    const context: FactoryToolResultRuleContext = {
      tenant: { orgId: binding.orgId, projectId: binding.factoryProjectId },
      actor: { type: 'agent', bindingId: binding.id, role: binding.role },
      ingress: { type: 'toolResult', id: ingressId },
      cause: `Completed ${toolResult.toolName}`,
      causalChain: [],
      ruleSetVersion: this.options.rules.version,
      item: {
        id: item.id,
        source: workItemSource(item),
        sourceKey: workItemSourceKey(item),
        parentWorkItemId: item.parentWorkItemId,
        title: item.title,
        url: item.externalSource?.url ?? null,
        stages: item.stages,
      },
      board,
      itemRevision: item.revision,
      toolName: toolResult.toolName,
      threadId: binding.threadId,
      assistantMessageId: toolResult.assistantMessageId,
      toolCallId: toolResult.toolCallId,
      result: { status: toolResult.status, value: toolResult.value },
    };

    let decision: FactoryRuleDecision | void = undefined;
    let decisions: FactoryCommitDecision[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = await withRuleTimeout(Promise.resolve(rule(Object.freeze(context))));
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]);
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'FACTORY_RULE_TIMEOUT';
      outcome = {
        status: 'rejected',
        code: timedOut ? 'timeout' : 'rule_error',
        reason: timedOut
          ? 'Factory rule evaluation timed out.'
          : error instanceof Error
            ? error.message.slice(0, 2_000)
            : 'Factory tool-result rule failed.',
      };
    }
    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: binding.orgId,
      factoryProjectId: binding.factoryProjectId,
      workItemId: item.id,
      ingress: { identity: ingressId, triggerType: 'tool.result' },
      ruleSetVersion: this.options.rules.version,
      expectedRevision: item.revision,
      outcome,
      decisions: decisions.map(entry => ({ ...entry })),
      causalChain: [],
      now: new Date(),
    });
    if (committed.status !== 'committed' || !this.options.transitionService) return;
    for (const entry of decisions) {
      if (entry.type !== 'transition') continue;
      await this.options.transitionService.transition({
        orgId: binding.orgId,
        factoryProjectId: binding.factoryProjectId,
        workItemId: item.id,
        board: entry.board,
        stage: entry.stage,
        expectedRevision: item.revision,
        actor: { type: 'system', id: 'factory-tool-result-rule' },
        ingress: { type: 'rule', identity: `decision:${entry.idempotencyKey}` },
        cause: 'tool_result_rule',
        causalChain: [{ ingressId, decisionType: entry.type }],
      });
    }
  }
}
