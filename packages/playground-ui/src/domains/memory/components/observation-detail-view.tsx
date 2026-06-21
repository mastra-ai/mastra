import { BrainIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../../../ds/components/Badge';
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
      text: 'text-[var(--mastra-el-5)]',
      time: 'text-[var(--mastra-el-3)]',
    };
  }
  switch (priority) {
    case 'high':
      return {
        card: 'border-purple-400/30 bg-purple-500/10',
        text: 'text-[var(--mastra-el-6)]',
        time: 'text-purple-200/80',
      };
    case 'medium':
      return { card: 'border-blue-400/30 bg-blue-500/10', text: 'text-[var(--mastra-el-6)]', time: 'text-blue-200/80' };
    case 'low':
      return {
        card: 'border-emerald-400/30 bg-emerald-500/10',
        text: 'text-[var(--mastra-el-6)]',
        time: 'text-emerald-200/80',
      };
    case 'complete':
      return {
        card: 'border-green-400/30 bg-green-500/10',
        text: 'text-[var(--mastra-el-6)]',
        time: 'text-green-200/80',
      };
    default:
      return {
        card: 'border-[var(--mastra-border-1)] bg-[var(--mastra-bg-2)]',
        text: 'text-[var(--mastra-el-6)]',
        time: 'text-[var(--mastra-el-3)]',
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
    return { text: text.trim(), time: t ?? null, priority: getPriorityFromEmoji(p), children: [] };
  }
  return { text: trimmed, time: null, priority: null, children: [] };
}

function parseObservations(raw: string): ParsedSection[] {
  const obsMatch = raw.match(/<observations>\s*([\s\S]*?)\s*<\/observations>/);
  const content = (obsMatch ? obsMatch[1] : raw).trim();
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
      current = { title: dateMatch[1].trim(), relativeTime: dateMatch[2]?.trim() ?? null, items: [] };
      sections.push(current);
      lastRoot = null;
      continue;
    }
    if (!current) {
      current = { title: 'Recent', relativeTime: null, items: [] };
      sections.push(current);
    }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
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
    <div className={nested ? 'space-y-2 border-l border-[var(--mastra-border-1)] pl-4' : 'space-y-3'}>
      {items.map((item, i) => {
        const styles = priorityClasses(item.priority, nested);
        return (
          <div key={`${item.text.slice(0, 20)}-${i}`} className="space-y-2">
            <div className="flex items-start gap-3">
              {item.time && (
                <div className="w-12 shrink-0 pt-2 text-right">
                  <span className={`font-mono text-[10px] ${styles.time}`}>{item.time}</span>
                </div>
              )}
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
    return <p className="italic text-xs text-[var(--mastra-el-3)]">Initialized</p>;
  }
  return (
    <div className="space-y-5">
      {sections.map((section, i) => (
        <section key={`${section.title}-${i}`} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--mastra-border-1)] pb-2">
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-[var(--mastra-el-6)]">{section.title}</h3>
              {section.relativeTime && <p className="text-[10px] text-[var(--mastra-el-3)]">{section.relativeTime}</p>}
            </div>
          </div>
          <ObservationItems items={section.items} />
        </section>
      ))}
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
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="border-b border-[var(--mastra-border-1)] px-4 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-normal text-[var(--mastra-el-6)]">
              <span>Memory</span>
              <span className="font-mono text-[10px] text-[var(--mastra-el-3)] tabular-nums">
                {showDiff && previousRecord ? (
                  <>
                    {previousRecord.observationTokenCount} →{' '}
                    <span className="font-semibold text-[var(--mastra-el-6)]">{selected.observationTokenCount}</span>{' '}
                    tokens
                  </>
                ) : (
                  <>{selected.observationTokenCount} tokens</>
                )}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {previousRecord && (
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox checked={showDiff} onCheckedChange={v => setShowDiff(v === true)} />
                <span className="text-xs text-[var(--mastra-el-3)]">Show diff</span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        {showDiff && previousRecord ? (
          <CodeDiff
            codeA={typeof previousRecord.activeObservations === 'string' ? previousRecord.activeObservations : ''}
            codeB={activeObservations}
          />
        ) : activeObservations ? (
          <ObservationContent observations={activeObservations} />
        ) : (
          <p className="italic text-xs text-[var(--mastra-el-3)]">
            {selected.isObserving || selected.isReflecting ? 'Processing…' : 'Initialized'}
          </p>
        )}
      </div>

      {sorted.length > 1 && (
        <div className="border-t border-[var(--mastra-border-1)] overflow-y-auto max-h-48">
          <div className="p-2 space-y-1">
            <p className="text-[10px] font-medium uppercase text-[var(--mastra-el-3)] px-2 py-1">History</p>
            {sorted.map(record => {
              const isSelected = record.id === selected.id;
              return (
                <button
                  key={record.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-[var(--mastra-bg-3)] text-[var(--mastra-el-6)]'
                      : 'text-[var(--mastra-el-3)] hover:bg-[var(--mastra-bg-2)]',
                  )}
                  onClick={() => onSelectRecord(record.id)}
                >
                  <Badge variant={isSelected ? 'default' : 'default'} size="xs">
                    #{record.generationCount}
                  </Badge>
                  <span className="font-mono tabular-nums">{record.observationTokenCount} tokens</span>
                  {record.isObserving && (
                    <Badge variant="warning" size="xs">
                      Observing
                    </Badge>
                  )}
                  {record.isReflecting && (
                    <Badge variant="info" size="xs">
                      Reflecting
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
