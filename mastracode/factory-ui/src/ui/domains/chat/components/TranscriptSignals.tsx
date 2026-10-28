import { mastraDBMessageToSignal } from '@mastra/core/signals';
import { SESSION_OWNER_SIGNAL_TAG } from '@mastra/factory/session-owner-signal';

import { parseSkillBody } from '@mastra/playground-ui/domains/chat/messages/skill-activation';
import type { SkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';

import type { MessageEntry, TimelineEntry } from '../services/transcript';
import { isRecord } from './transcript-shared';

function timeGapDivider(text: string): SignalRowView {
  const [label = '', title] = text.split(' — ');
  return { kind: 'divider', label, title };
}

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

export const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
export const SUPPRESSED_STATE_SIGNAL_IDS = new Set(['tasks', 'goal']);

export type SignalRowView =
  | { kind: 'state'; stateId: string; mode: 'snapshot' | 'delta'; text: string }
  | { kind: 'divider'; label: string; title?: string }
  | { kind: 'reminder'; text: string }
  | { kind: 'reactive'; tagName?: string; text: string };

export function signalRowView(entry: MessageEntry): SignalRowView | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal)) return undefined;

  const tagName = typeof signal.tagName === 'string' ? signal.tagName : undefined;
  const text = signalPartsText(entry);
  const attributes = isRecord(signal.attributes) ? signal.attributes : {};
  const reminder: SignalRowView =
    attributes.type === 'temporal-gap' ? timeGapDivider(text) : { kind: 'reminder', text };

  if (signal.type === 'state') {
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

export function isTurnDivider(entry: TimelineEntry | undefined): boolean {
  return entry?.kind === 'message' && signalRowView(entry)?.kind === 'divider';
}
