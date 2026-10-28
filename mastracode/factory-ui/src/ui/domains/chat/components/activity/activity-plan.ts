import { groupConsecutive } from '@mastra/playground-ui/components/ai/tool-call';
import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';
import type { ReasoningPart } from '@mastra/react/ui';

import type { MessageEntry, SuspensionPrompt, TimelineEntry, ToolCall } from '../../services/transcript';
import { messageEntryView } from '../message-entry-view';
import { draws, hasVisibleText, renderableParts, toolFromInvocationPart } from '../transcript-parts';
import type { MessagePart, ToolPart } from '../transcript-parts';

// Drawn as their own messages, so they end a stretch of tool work instead of joining it.
const UNGROUPABLE_TOOLS = new Set(['ask_user', 'submit_plan', 'skill', 'reply_in_thread']);

export type StretchMember =
  | {
      kind: 'tool';
      key: string;
      entryId: string;
      index: number;
      part: ToolPart;
      runtime: ToolCall | undefined;
      messageCreatedAt: Date | string | undefined;
    }
  | { kind: 'reasoning'; key: string; entryId: string; index: number; part: ReasoningPart; entryStreaming: boolean };

/** One uninterrupted run of tool calls and reasoning, drawn as a single activity line. */
export interface ActivityStretch {
  key: string;
  members: StretchMember[];
  live: boolean;
  /** From the first member to whatever ended the stretch; unknown while live or when nothing followed. */
  elapsedMs?: number;
}

/** What one entry does with its parts: draw the stretches it hosts, skip the parts an earlier host draws. */
export interface EntryActivity {
  hosts: ReadonlyMap<string, ActivityStretch>;
  hidden: ReadonlySet<string>;
}

export type PartRole = 'joins' | 'ends' | 'ignored';

interface PlanItem {
  key: string;
  entryId: string;
  role: PartRole;
  at?: number;
  member?: StretchMember;
}

type JoinItem = PlanItem & { member: StretchMember };

/** A part's identity across renders: tool calls by id, anything else by its slot in `renderableParts`. */
export function activityPartKey(entryId: string, part: MessagePart, index: number): string {
  return part.type === 'tool-invocation' ? part.toolInvocation.toolCallId : `${entryId}:${index}`;
}

/** Persisted reasoning carries no state; it is streaming exactly while its message is. */
export function reasoningWithState(part: ReasoningPart, streaming: boolean): ReasoningPart {
  return { ...part, state: part.state ?? (streaming ? 'streaming' : 'done') };
}

export function classifyPart(
  part: MessagePart,
  entry: MessageEntry,
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
): PartRole {
  switch (part.type) {
    case 'text':
      return hasVisibleText(part.text) ? 'ends' : 'ignored';
    case 'reasoning':
      return getReasoningContent(reasoningWithState(part, Boolean(entry.streaming))) ? 'joins' : 'ignored';
    case 'file':
    case 'error':
      return 'ends';
    case 'tool-invocation': {
      const { toolName, toolCallId } = part.toolInvocation;
      return UNGROUPABLE_TOOLS.has(toolName) || suspensions.has(toolCallId) ? 'ends' : 'joins';
    }
    default:
      return 'ignored';
  }
}

function member(entry: MessageEntry, part: MessagePart, index: number): StretchMember | undefined {
  const key = activityPartKey(entry.id, part, index);
  if (part.type === 'tool-invocation') {
    return {
      kind: 'tool',
      key,
      entryId: entry.id,
      index,
      part,
      runtime: entry.runtimeTools?.[part.toolInvocation.toolCallId],
      messageCreatedAt: entry.message.createdAt,
    };
  }
  if (part.type === 'reasoning') {
    return { kind: 'reasoning', key, entryId: entry.id, index, part, entryStreaming: Boolean(entry.streaming) };
  }
  return undefined;
}

function messageTime(entry: MessageEntry): number | undefined {
  const time = new Date(entry.message.createdAt).getTime();
  return Number.isNaN(time) ? undefined : time;
}

function entryItems(entry: TimelineEntry, suspensions: ReadonlyMap<string, SuspensionPrompt>): PlanItem[] {
  if (entry.kind !== 'message') return [{ key: entry.id, entryId: entry.id, role: 'ends' }];

  const parts = renderableParts(entry);
  const view = messageEntryView(entry, parts);
  if (view.kind === 'hidden') return [];
  const at = messageTime(entry);
  if (view.kind !== 'parts') return [{ key: entry.id, entryId: entry.id, role: 'ends', at }];
  if (entry.message.role !== 'assistant') {
    const drawsAny = parts.some(part => draws(part, suspensions, entry.runtimeTools));
    return drawsAny ? [{ key: entry.id, entryId: entry.id, role: 'ends', at }] : [];
  }

  return parts.map((part, index) => {
    const role = classifyPart(part, entry, suspensions);
    return {
      key: activityPartKey(entry.id, part, index),
      entryId: entry.id,
      role,
      at: part.createdAt ?? at,
      member: role === 'joins' ? member(entry, part, index) : undefined,
    };
  });
}

function elapsedBetween(start: number | undefined, end: number | undefined): number | undefined {
  return start !== undefined && end !== undefined && end >= start ? end - start : undefined;
}

/**
 * Cuts a turn into stretches of tool work, across however many entries the server split it into.
 * Each stretch is hosted by the entry holding its first member; later members draw nothing of their own.
 */
export function planTurnActivity(
  entries: readonly TimelineEntry[],
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runningTurn: boolean,
): ReadonlyMap<string, EntryActivity> {
  const items = entries.flatMap(entry => entryItems(entry, suspensions)).filter(item => item.role !== 'ignored');
  const runs = groupConsecutive<PlanItem, JoinItem>(items, {
    key: item => item.key,
    joins: (item): item is JoinItem => item.member !== undefined,
    min: 1,
  });

  const lastItem = items.at(-1);
  const after = new Map(items.slice(0, -1).map((item, index) => [item, items[index + 1]]));
  const plan = new Map<string, { hosts: Map<string, ActivityStretch>; hidden: Set<string> }>();
  const activityOf = (entryId: string) => {
    let activity = plan.get(entryId);
    if (!activity) {
      activity = { hosts: new Map(), hidden: new Set() };
      plan.set(entryId, activity);
    }
    return activity;
  };

  for (const [key, run] of runs.byFirstKey) {
    const [first, ...rest] = run;
    if (!first) continue;
    const last = run.at(-1);
    const live =
      runningTurn &&
      (last === lastItem ||
        run.some(
          ({ member }) =>
            member.kind === 'tool' && toolFromInvocationPart(member.part, member.runtime).status === 'running',
        ));
    activityOf(first.entryId).hosts.set(key, {
      key,
      members: run.map(item => item.member),
      live,
      elapsedMs: live || !last ? undefined : elapsedBetween(first.at, after.get(last)?.at),
    });
    for (const item of rest) activityOf(item.entryId).hidden.add(item.key);
  }

  return plan;
}

function sameMember(a: StretchMember, b: StretchMember): boolean {
  if (a.key !== b.key || a.part !== b.part) return false;
  if (a.kind === 'tool') return b.kind === 'tool' && a.runtime === b.runtime;
  return b.kind === 'reasoning' && a.entryStreaming === b.entryStreaming;
}

function sameStretch(a: ActivityStretch, b: ActivityStretch | undefined): boolean {
  return (
    b !== undefined &&
    a.live === b.live &&
    a.elapsedMs === b.elapsedMs &&
    a.members.length === b.members.length &&
    a.members.every((member, index) => sameMember(member, b.members[index]))
  );
}

/** Whether two plans draw an entry the same, so a settled entry skips the re-render a new plan object would cause. */
export function sameEntryActivity(a: EntryActivity | undefined, b: EntryActivity | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.hidden.size !== b.hidden.size || a.hosts.size !== b.hosts.size) return false;
  for (const key of a.hidden) if (!b.hidden.has(key)) return false;
  for (const [key, stretch] of a.hosts) if (!sameStretch(stretch, b.hosts.get(key))) return false;
  return true;
}
