import { mastraDBMessageToSignal } from '@mastra/core/signals';
import { Link, useLocation } from 'react-router';

import type { MessageEntry, TimelineEntry } from '../services/transcript';
import { isRecord } from './transcript-shared';

import { TranscriptDivider } from '@mastra/playground-ui/components/ai/transcript-divider';

export { SignalActivity as SignalRow } from '@mastra/playground-ui/components/ai/activity';

export function TimeGap({ text }: { text: string }) {
  const [phrase, timestamp] = text.split(' — ');
  if (!phrase) return null;

  return <TranscriptDivider label={phrase} title={timestamp} />;
}

export function signalPartsText(entry: MessageEntry): string {
  const { contents } = mastraDBMessageToSignal(entry.message);
  if (typeof contents === 'string') return contents.trim();

  return contents
    .flatMap(part => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n')
    .trim();
}

export const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
export const SUPPRESSED_STATE_SIGNAL_IDS = new Set(['tasks', 'goal']);

type SignalRowView =
  | { kind: 'state'; stateId: string; mode: 'snapshot' | 'delta'; text: string }
  | { kind: 'gap'; text: string }
  | { kind: 'reminder'; text: string }
  | { kind: 'reactive'; tagName?: string; text: string; sources?: SignalSource[] };

/** A knowledge node a signal cites (`attributes.sourceNodes`, set by the reminder agent). */
export interface SignalSource {
  nodeId: string;
  name: string;
  recordId?: string;
}

function signalSources(value: unknown): SignalSource[] | undefined {
  if (typeof value !== 'string') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const sources = parsed.flatMap(entry =>
    isRecord(entry) && typeof entry.nodeId === 'string' && entry.nodeId && typeof entry.name === 'string'
      ? [
          {
            nodeId: entry.nodeId,
            name: entry.name,
            recordId: typeof entry.recordId === 'string' ? entry.recordId : undefined,
          },
        ]
      : [],
  );
  return sources.length > 0 ? sources : undefined;
}

export function SignalSources({ sources }: { sources: SignalSource[] }) {
  const location = useLocation();
  return (
    <nav aria-label="Signal sources" data-testid="signal-sources" className="flex flex-wrap gap-1.5 pt-1 pl-7">
      {sources.map(source => {
        const params = new URLSearchParams(location.search);
        params.set('node', source.nodeId);
        if (source.recordId) params.set('record', source.recordId);
        else params.delete('record');
        return (
          <Link
            key={`${source.nodeId}:${source.recordId ?? ''}`}
            to={{ search: `?${params}` }}
            preventScrollReset
            className="border-border text-muted-foreground hover:bg-fill hover:text-foreground focus-visible:text-foreground rounded-full border px-2 py-0.5 text-xs focus-visible:outline-2"
          >
            {source.name}
          </Link>
        );
      })}
    </nav>
  );
}

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
  if (signal.type === 'reactive') {
    const sources = signalSources(attributes.sourceNodes);
    return sources ? { kind: 'reactive', tagName, text, sources } : { kind: 'reactive', tagName, text };
  }
  return undefined;
}

export function isTimeGap(entry: TimelineEntry | undefined): boolean {
  return entry?.kind === 'message' && signalRowView(entry)?.kind === 'gap';
}
