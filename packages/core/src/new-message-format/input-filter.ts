import type { ActionDraft, AgentInput, ToActionsResult } from './to-actions';
import { toActionsByMessage } from './to-actions';
import type { PersistableAction } from './types';

/**
 * The action form of `MemoryInputFilter`. Clients such as AI SDK's `useChat` resend the whole conversation on
 * every request, and the log already holds it. The input is treated as a resend only with evidence: its last
 * assistant message must match the log's last assistant turn (the same tool-call ids when the input has any,
 * otherwise the same trailing texts). Only that proven prefix is dropped. Then it keeps:
 * - the messages after that assistant message, plus the tool outcomes and approval answers it carries for
 *   calls the log still has open. User input the log already holds after that turn is dropped too, in order:
 *   a retry of a request whose model call failed resends input that was saved before the call;
 * - for input ending in that assistant message (`sendAutomaticallyWhen` sends a client tool result this way),
 *   only those outcomes.
 * Without the evidence the input is new context (few-shot examples ahead of the question, or a new assistant
 * message carrying a client result for an open call) and is kept whole and in order, minus only tool
 * outcomes and approval answers the log already has. An assistant message that ends the input with no open
 * outcomes is also kept:
 * actions carry no client message id, so an echo can't be told apart from assistant input never stored.
 * Tool-role messages are outcome carriers and are always filtered against the log.
 */
export function trimResentInput(input: AgentInput, log: PersistableAction[]): ToActionsResult {
  const { system, messages } = toActionsByMessage(input);
  const all = messages.flatMap(m => m.actions);
  fillApprovalRefs(all, log);
  if (log.length === 0) return { system, actions: all };

  const last = messages.findLastIndex(m => m.role !== 'tool' && m.role !== 'system');
  if (last === -1) return { system, actions: openOutcomes(all, log) };

  const boundary = messages.findLastIndex(m => m.role === 'assistant');
  if (boundary === -1) {
    // No assistant to anchor on: a retry of input the log holds unanswered (the first model call failed)
    // starts with that input, so drop it once.
    const kept = withoutClosedOutcomes(all, log);
    return { system, actions: kept.slice(storedInputPrefix(kept, lastAssistantTurn(log).after)) };
  }
  if (!matchesLastAssistantTurn(messages[boundary]!.actions, log)) {
    return { system, actions: withoutClosedOutcomes(all, log) };
  }
  if (messages[last]!.role === 'assistant') {
    const outcomes = openOutcomes(
      messages.slice(last).flatMap(m => m.actions),
      log,
    );
    return { system, actions: outcomes.length > 0 ? outcomes : messages[last]!.actions };
  }

  const tail = messages.slice(boundary + 1).flatMap(m => (m.role === 'tool' ? [] : m.actions));
  const actions = [
    ...openOutcomes(
      messages.slice(boundary).flatMap(m => (m.role === 'assistant' || m.role === 'tool' ? m.actions : [])),
      log,
    ),
    ...tail.slice(storedInputPrefix(tail, lastAssistantTurn(log).after)),
  ];
  return { system, actions };
}

/** New input kept in order, minus tool outcomes and approval answers the log already has. */
function withoutClosedOutcomes(actions: ActionDraft[], log: PersistableAction[]): ActionDraft[] {
  const closed = new Set(log.flatMap(a => (OUTCOMES.has(a.type) && 'toolCallId' in a ? [a.toolCallId] : [])));
  const answered = new Set(log.flatMap(a => (a.type === 'tool-approval-responded' ? [a.approvalId] : [])));
  return actions.filter(a =>
    OUTCOMES.has(a.type) && 'toolCallId' in a
      ? !closed.has(a.toolCallId)
      : a.type !== 'tool-approval-responded' || !answered.has(a.approvalId),
  );
}

const isUserInput = (a: { type: string; role?: string }) => a.type === 'signal' || a.role === 'user';

/**
 * The log's last assistant turn (from the user input before its last assistant content through that content)
 * and what follows it: user input saved for a run that produced no answer, and that run's closers.
 */
function lastAssistantTurn(log: PersistableAction[]) {
  const lastAssistant = log.findLastIndex(a => 'role' in a && a.role === 'assistant');
  const userBefore = log.slice(0, Math.max(lastAssistant, 0)).findLastIndex(isUserInput);
  return { turn: log.slice(userBefore + 1, lastAssistant + 1), after: log.slice(lastAssistant + 1) };
}

/**
 * Same content, ignoring the engine-stamped fields. Keys are sorted at every depth: stores rebuild rows in
 * their own key order (LibSQL puts `type` in a column; JSONB reorders), so insertion order means nothing.
 */
const inputKey = (a: object) => {
  const {
    id: _id,
    threadId: _t,
    resourceId: _r,
    runId: _run,
    createdAt: _c,
    formatVersion: _f,
    ignorable: _i,
    ...rest
  } = a as Record<string, unknown>;
  return JSON.stringify(canonical(rest));
};

function canonical(value: unknown): unknown {
  if (value && typeof (value as { toJSON?: unknown }).toJSON === 'function') return (value as Date).toJSON();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .flatMap(k => {
          const v = (value as Record<string, unknown>)[k];
          return v === undefined ? [] : [[k, canonical(v)]];
        }),
    );
  return value;
}

/** How many leading tail actions repeat, in order, the user input the log holds after its last assistant turn. */
function storedInputPrefix(tail: ActionDraft[], after: PersistableAction[]): number {
  const stored = after.filter(isUserInput).map(inputKey);
  let n = 0;
  while (n < tail.length && n < stored.length && isUserInput(tail[n]!) && inputKey(tail[n]!) === stored[n]) n++;
  return n;
}

/**
 * Whether an input assistant message is the log's last assistant turn. Tool-call ids decide when the message
 * has any; otherwise its texts must be the turn's last texts.
 */
function matchesLastAssistantTurn(message: ActionDraft[], log: PersistableAction[]): boolean {
  const { turn } = lastAssistantTurn(log);
  const callIds = message.flatMap(a => (a.type === 'tool-call' ? [a.toolCallId] : []));
  if (callIds.length > 0) {
    const logged = new Set(turn.flatMap(a => (a.type === 'tool-call' ? [a.toolCallId] : [])));
    return callIds.every(id => logged.has(id));
  }
  const texts = message.flatMap(a => (a.type === 'text' ? [a.text] : []));
  const turnTexts = turn.flatMap(a => (a.type === 'text' && a.role === 'assistant' ? [a.text] : []));
  return texts.length > 0 && texts.join('\n') === turnTexts.slice(-texts.length).join('\n');
}

const OUTCOMES = new Set(['tool-result', 'tool-error', 'tool-denied']);

/** Tool outcomes and approval answers for calls and approvals the log has but hasn't closed. */
function openOutcomes(actions: ActionDraft[], log: PersistableAction[]): ActionDraft[] {
  const calls = new Set<string>();
  const closed = new Set<string>();
  const approvals = new Set<string>();
  const answered = new Set<string>();
  for (const a of log) {
    if (a.type === 'tool-call') calls.add(a.toolCallId);
    if (OUTCOMES.has(a.type) && 'toolCallId' in a) closed.add(a.toolCallId);
    if (a.type === 'tool-approval-requested') approvals.add(a.approvalId);
    if (a.type === 'tool-approval-responded') answered.add(a.approvalId);
  }
  const kept: ActionDraft[] = [];
  for (const a of actions) {
    if (OUTCOMES.has(a.type) && 'toolCallId' in a && calls.has(a.toolCallId) && !closed.has(a.toolCallId)) {
      closed.add(a.toolCallId);
      kept.push(a);
    }
    if (a.type === 'tool-approval-responded' && approvals.has(a.approvalId) && !answered.has(a.approvalId)) {
      answered.add(a.approvalId);
      kept.push(a);
    }
  }
  return kept;
}

/** Approval answers whose request is only in the log get the call id and tool name from it. */
function fillApprovalRefs(actions: ActionDraft[], log: PersistableAction[]) {
  const requests = new Map<string, { toolCallId: string; toolName: string }>();
  for (const a of log) if (a.type === 'tool-approval-requested') requests.set(a.approvalId, a);
  for (const a of actions) {
    if (a.type !== 'tool-approval-responded') continue;
    const request = requests.get(a.approvalId);
    if (!request) continue;
    a.toolCallId ||= request.toolCallId;
    a.toolName ||= request.toolName;
  }
}
