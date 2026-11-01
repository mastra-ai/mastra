import { mastraDBMessageToSignal } from '@mastra/core/signals';
import { SESSION_OWNER_SIGNAL_TAG } from '@mastra/factory/session-owner-signal';

import { pinnedKnowledgeFromSignal } from '@mastra/playground-ui/domains/chat/knowledge';
import type { PinnedKnowledge } from '@mastra/playground-ui/domains/chat/knowledge';
import { parseSkillBody } from '@mastra/playground-ui/domains/chat/messages/skill-activation';
import type { SkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';

import type { MessageEntry, TimelineEntry } from '../services/transcript';
import { isRecord } from './transcript-shared';

export function signalPartsText(entry: MessageEntry): string {
  const { contents } = mastraDBMessageToSignal(entry.message);
  if (typeof contents === 'string') return contents.trim();

  return contents
    .flatMap(part => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n')
    .trim();
}

/** A typed `skill` signal (how Factory starts a skill run), parsed for the skill row. */
export function skillSignalActivation(entry: MessageEntry): SkillActivation | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || signal.type !== 'reactive' || signal.tagName !== 'skill') return undefined;
  const name = isRecord(signal.attributes) ? signal.attributes.name : undefined;
  return typeof name === 'string' ? parseSkillBody(name, signalPartsText(entry)) : undefined;
}

/** The pause reminder the agent gets before a message sent after a while; the transcript draws its own divider. */
export function isTemporalGapSignal(entry: MessageEntry): boolean {
  const signal = entry.message.content.metadata?.signal;
  return isRecord(signal) && isRecord(signal.attributes) && signal.attributes.type === 'temporal-gap';
}

export const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
export const SUPPRESSED_STATE_SIGNAL_IDS = new Set(['tasks', 'goal']);

export type SignalRowView =
  | { kind: 'state'; stateId: string; mode: 'snapshot' | 'delta'; text: string }
  | { kind: 'pinned'; pinned: PinnedKnowledge }
  | { kind: 'divider'; label: string }
  | { kind: 'reminder'; text: string }
  | { kind: 'reactive'; tagName?: string; text: string };

export function signalRowView(entry: MessageEntry): SignalRowView | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal)) return undefined;

  const tagName = typeof signal.tagName === 'string' ? signal.tagName : undefined;
  const text = signalPartsText(entry);
  const reminder: SignalRowView = { kind: 'reminder', text };

  if (signal.type === 'state') {
    const pinned = pinnedKnowledgeFromSignal(signal);
    if (pinned) return { kind: 'pinned', pinned };
    const metadata = isRecord(signal.metadata) ? signal.metadata : {};
    const stateMeta = isRecord(metadata.state) ? metadata.state : {};
    return {
      kind: 'state',
      stateId: (typeof stateMeta.id === 'string' ? stateMeta.id : undefined) ?? tagName ?? 'state',
      mode: stateMeta.mode === 'delta' ? 'delta' : 'snapshot',
      text,
    };
  }
  // `normalizeSignal` maps `system-reminder` to `reactive` + `system-reminder`
  // tag before persistence, but live pre-normalized signals may carry the raw type.
  if (signal.type === 'system-reminder') return reminder;
  if (signal.type === 'reactive' && tagName === 'system-reminder') return reminder;
  if (signal.type === 'reactive' && tagName === SESSION_OWNER_SIGNAL_TAG) return { kind: 'divider', label: text };
  if (signal.type === 'reactive') return { kind: 'reactive', tagName, text };
  return undefined;
}

function environmentWorkingDirectory(entry: TimelineEntry): string | undefined {
  if (entry.kind !== 'message' || entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || signal.tagName !== 'factory-environment' || !isRecord(signal.attributes)) return undefined;
  const { workingDirectory } = signal.attributes;
  return typeof workingDirectory === 'string' ? workingDirectory : undefined;
}

export function agentWorkingDirectory(entries: readonly TimelineEntry[]): string | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const directory = environmentWorkingDirectory(entries[index]);
    if (directory) return directory;
  }
  return undefined;
}

export function isTurnDivider(entry: TimelineEntry | undefined): boolean {
  return entry?.kind === 'message' && signalRowView(entry)?.kind === 'divider';
}
