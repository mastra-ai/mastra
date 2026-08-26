import { mastraDBMessageToSignal } from '@mastra/core/signals';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Info, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { MessageEntry, TimelineEntry } from '../services/transcript';
import { isRecord, truncate } from './transcript-shared';
import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from './TranscriptRow';

/** A gap reads `1 hour 58 minutes later — 08/11/2026, 5:21 PM GMT+2`; the phrase is the signal, the stamp is detail. */
export function TimeGap({ text }: { text: string }) {
  const [phrase, timestamp] = text.split(' — ');
  if (!phrase) return null;

  return (
    <div className="flex items-center gap-3 py-3" role="separator" aria-label={text}>
      <span aria-hidden className="bg-border1 h-px flex-1" />
      <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0" title={timestamp}>
        {phrase}
      </Txt>
      <span aria-hidden className="bg-border1 h-px flex-1" />
    </div>
  );
}

const SIGNAL_ICONS: Record<string, ReactNode> = {
  state: <Layers size={13} className="text-purple-400" />,
  reminder: <Info size={13} className="text-accent3" />,
};

/** Compact row for state/reminder/reactive signals, collapsible when it has details. */
export function SignalRow({ kind, label, message }: { kind: string; label: string; message: string }) {
  const [expanded, setExpanded] = useState(false);
  const icon = SIGNAL_ICONS[kind] ?? <Info size={13} className="text-icon3" />;

  if (!message) {
    return (
      <div className="max-w-full min-w-0" data-signal-kind={kind} role="group" aria-label={`Signal: ${label}`}>
        <TranscriptRow icon={icon} label={label} />
      </div>
    );
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      data-signal-kind={kind}
      role="group"
      aria-label={`Signal: ${label}`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow icon={icon} label={label} detail={truncate(message, 72)} expanded={expanded} />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={ROW_RAIL}>
          <Txt variant="ui-sm" className="break-words whitespace-pre-wrap">
            {message}
          </Txt>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function signalPartsText(entry: MessageEntry): string {
  const { contents } = mastraDBMessageToSignal(entry.message);
  if (typeof contents === 'string') return contents.trim();

  return contents
    .flatMap(part => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n')
    .trim();
}

// Internal control-plane signals handled by GithubSignals; the user-visible
// result is rendered elsewhere, so showing these would duplicate the UI.
export const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
// State snapshots already surfaced by the pinned task list and GoalPanel.
export const SUPPRESSED_STATE_SIGNAL_IDS = new Set(['tasks', 'goal']);

type SignalRowView =
  | { kind: 'state'; stateId: string; mode: 'snapshot' | 'delta'; text: string }
  | { kind: 'gap'; text: string }
  | { kind: 'reminder'; text: string }
  | { kind: 'reactive'; tagName?: string; text: string };

/**
 * Classify non-notification `role: 'signal'` messages into the row they drive,
 * mirroring the TUI's `getSignalKind` dispatch (state -> reminder -> reactive).
 * Notification signals are rebuilt by `signalNotifications`, and user signals
 * are reclassified to `role: 'user'` in the reducer, so both return undefined.
 */
export function signalRowView(entry: MessageEntry): SignalRowView | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal)) return undefined;

  const tagName = typeof signal.tagName === 'string' ? signal.tagName : undefined;
  const text = signalPartsText(entry);
  const attributes = isRecord(signal.attributes) ? signal.attributes : {};
  const reminderKind = attributes.type === 'temporal-gap' ? 'gap' : 'reminder';

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
  if (signal.type === 'system-reminder') return { kind: reminderKind, text };
  if (signal.type === 'reactive' && tagName === 'system-reminder') return { kind: reminderKind, text };
  if (signal.type === 'reactive') return { kind: 'reactive', tagName, text };
  return undefined;
}

/** The `24 minutes later` separator, written a millisecond before the turn it introduces. */
export function isTimeGap(entry: TimelineEntry | undefined): boolean {
  return entry?.kind === 'message' && signalRowView(entry)?.kind === 'gap';
}
