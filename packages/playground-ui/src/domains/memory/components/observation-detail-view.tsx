import { BrainIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '../../../ds/components/Checkbox';
import { CodeDiff } from '../../../ds/components/CodeDiff';
import { EmptyState } from '../../../ds/components/EmptyState';
import { Skeleton } from '../../../ds/components/Skeleton';
import { cn } from '../../../lib/utils';
import type { OMHistoryRecord } from '../types';

type ParsedItem = {
  text: string;
  time: string | null;
  priority: 'high' | 'medium' | 'low' | 'complete' | null;
  children: ParsedItem[];
};

type ParsedSection = {
  title: string;
  relativeTime: string | null;
  items: ParsedItem[];
};

function formatObservationTime(time: string | null) {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const [, hours, minutes] = match;
  const hour = Number(hours);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${minutes} ${suffix}`;
}

function getPriorityFromEmoji(emoji?: string): ParsedItem['priority'] {
  if (emoji === '🔴') return 'high';
  if (emoji === '🟡') return 'medium';
  if (emoji === '🟢') return 'low';
  if (emoji === '✅') return 'complete';
  return null;
}

function priorityClasses(priority: ParsedItem['priority'], nested: boolean) {
  if (nested) {
    return {
      card: 'bg-transparent border-transparent',
      text: 'text-neutral3',
      time: 'text-icon3',
    };
  }
  switch (priority) {
    case 'high':
      return {
        card: 'border-purple-400/30 bg-purple-500/10',
        text: 'text-neutral6',
        time: 'text-purple-200/80',
      };
    case 'medium':
      return {
        card: 'border-blue-400/30 bg-blue-500/10',
        text: 'text-neutral6',
        time: 'text-blue-200/80',
      };
    case 'low':
      return {
        card: 'border-emerald-400/30 bg-emerald-500/10',
        text: 'text-neutral6',
        time: 'text-emerald-200/80',
      };
    case 'complete':
      return {
        card: 'border-green-400/30 bg-green-500/10',
        text: 'text-neutral6',
        time: 'text-green-200/80',
      };
    default:
      return {
        card: 'border-border1 bg-surface2',
        text: 'text-neutral6',
        time: 'text-icon3',
      };
  }
}

function parseItem(line: string): ParsedItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('* ->') || trimmed.startsWith('->')) {
    const text = trimmed.replace(/^\*?\s*->\s*/, '').trim();
    return text ? { text, time: null, priority: null, children: [] } : null;
  }
  if (trimmed.startsWith('-')) {
    const text = trimmed.replace(/^-\s*/, '').trim();
    return text ? { text, time: null, priority: null, children: [] } : null;
  }
  const match = trimmed.match(/^\*\s*(🔴|🟡|🟢|✅)?\s*(?:\((\d{1,2}:\d{2})\))?\s*(.+)$/);
  if (match) {
    const [, p, t, text] = match;
    if (text !== undefined) {
      return { text: text.trim(), time: t ?? null, priority: getPriorityFromEmoji(p), children: [] };
    }
  }
  return { text: trimmed, time: null, priority: null, children: [] };
}

function parseObservations(raw: string): ParsedSection[] {
  const obsMatch = raw.match(/<observations>\s*([\s\S]*?)\s*<\/observations>/);
  const content = (obsMatch?.[1] ?? raw).trim();
  if (!content) return [];
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let lastRoot: ParsedItem | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const dateMatch = trimmed.match(/^Date:\s*(.+?)(?:\s*\(([^)]+)\))?$/);
    if (dateMatch) {
      current = { title: dateMatch[1]?.trim() ?? '', relativeTime: dateMatch[2]?.trim() ?? null, items: [] };
      sections.push(current);
      lastRoot = null;
      continue;
    }
    if (!current) {
      current = { title: 'Recent', relativeTime: null, items: [] };
      sections.push(current);
    }
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    const isNested = indent >= 2 && (trimmed.startsWith('* ->') || trimmed.startsWith('->') || trimmed.startsWith('-'));
    const item = parseItem(line);
    if (!item) continue;
    if (isNested && lastRoot) {
      lastRoot.children.push(item);
      continue;
    }
    current.items.push(item);
    lastRoot = item;
  }
  return sections;
}

function ObservationItems({ items, nested = false }: { items: ParsedItem[]; nested?: boolean }) {
  return (
    <div className={nested ? 'space-y-2 border-l border-border1 pl-4' : 'space-y-3'}>
      {items.map((item, i) => {
        const styles = priorityClasses(item.priority, nested);
        return (
          <div key={`${item.text.slice(0, 20)}-${i}`} className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-12 shrink-0 pt-2 text-right">
                {item.time && (
                  <span className={`font-mono text-ui-xs ${styles.time}`}>{formatObservationTime(item.time)}</span>
                )}
              </div>
              <div className={cn('min-w-0 flex-1 rounded-md border px-3 py-2', styles.card)}>
                <p className={cn('whitespace-pre-wrap break-words text-sm leading-6', styles.text)}>{item.text}</p>
                {item.children.length > 0 && (
                  <div className="mt-3">
                    <ObservationItems items={item.children} nested />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ObservationContent({ observations }: { observations: string }) {
  const sections = useMemo(() => parseObservations(observations), [observations]);
  if (sections.length === 0) {
    return <p className="italic text-xs text-icon3">Initialized</p>;
  }
  return (
    <div className="space-y-5">
      {sections.map((section, i) => (
        <section key={`${section.title}-${i}`} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-border1 pb-2">
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-neutral6">{section.title}</h3>
              {section.relativeTime && <p className="text-ui-xs text-icon3">{section.relativeTime}</p>}
            </div>
          </div>
          <ObservationItems items={section.items} />
        </section>
      ))}
    </div>
  );
}

function ObservationHistoryPanel({
  records,
  selectedRecordId,
  onSelectRecord,
}: {
  records: OMHistoryRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
}) {
  if (records.length <= 1) return null;

  return (
    <div className="border-l border-border1 min-w-[180px] w-[200px] flex flex-col overflow-hidden">
      <div className="border-b border-border1 px-4 py-2">
        <p className="text-sm font-normal text-neutral6">History</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {records.map(record => {
          const isSelected = record.id === selectedRecordId;
          return (
            <button
              key={record.id}
              type="button"
              className={cn(
                'w-full cursor-pointer border-l-2 border-l-transparent px-3 py-2 text-left truncate text-xs text-icon3 transition-all hover:bg-surface3/50',
                isSelected && 'bg-surface3/50 border-l-accent1',
              )}
              onClick={() => onSelectRecord(record.id)}
            >
              {record.activeObservations || (
                <span className="italic text-icon3">
                  {record.isObserving || record.isReflecting ? 'Processing\u2026' : 'Initialized'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface ObservationDetailViewProps {
  records: OMHistoryRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
  isLoading?: boolean;
}

export function ObservationDetailView({
  records,
  selectedRecordId,
  onSelectRecord,
  isLoading,
}: ObservationDetailViewProps) {
  const [showDiff, setShowDiff] = useState(false);

  const sorted = useMemo(
    () => [...records].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [records],
  );

  const selected = selectedRecordId ? sorted.find(r => r.id === selectedRecordId) : sorted[sorted.length - 1];
  const selectedIndex = selected ? sorted.findIndex(r => r.id === selected.id) : -1;
  const previousRecord = selectedIndex > 0 ? sorted[selectedIndex - 1] : null;

  useEffect(() => {
    const last = sorted.at(-1);
    if (!selectedRecordId && last) {
      onSelectRecord(last.id);
    }
  }, [selectedRecordId, sorted, onSelectRecord]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<BrainIcon className="size-4" />}
          titleSlot="No observations"
          descriptionSlot="No observational memory snapshots available for this thread."
        />
      </div>
    );
  }

  const activeObservations = typeof selected.activeObservations === 'string' ? selected.activeObservations : '';

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main observation content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {previousRecord && (
          <div className="border-b border-border1 px-4 py-2">
            <div className="flex items-start justify-end gap-3">
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox checked={showDiff} onCheckedChange={v => setShowDiff(v === true)} />
                <span className="text-xs text-icon3">Show diff</span>
              </label>
            </div>
          </div>
        )}

        <div data-testid="observation-detail-body" className="flex-1 overflow-y-auto p-4">
          {showDiff && previousRecord ? (
            <CodeDiff
              codeA={typeof previousRecord.activeObservations === 'string' ? previousRecord.activeObservations : ''}
              codeB={activeObservations}
            />
          ) : activeObservations ? (
            <ObservationContent observations={activeObservations} />
          ) : (
            <p className="italic text-xs text-icon3">
              {selected.isObserving || selected.isReflecting ? 'Processing…' : 'Initialized'}
            </p>
          )}
        </div>
      </div>

      {/* History sidebar */}
      <ObservationHistoryPanel records={sorted} selectedRecordId={selected.id} onSelectRecord={onSelectRecord} />
    </div>
  );
}
