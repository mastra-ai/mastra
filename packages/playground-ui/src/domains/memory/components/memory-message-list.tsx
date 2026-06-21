import { format } from 'date-fns';
import { BrainIcon, ChevronDownIcon, MessageSquareIcon, WrenchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../ds/components/Collapsible';
import { DashboardCard } from '../../../ds/components/DashboardCard';
import { EmptyState } from '../../../ds/components/EmptyState';
import { MarkdownRenderer } from '../../../ds/components/MarkdownRenderer';
import { Skeleton } from '../../../ds/components/Skeleton';
import { cn } from '../../../lib/utils';
import type { MemoryMessage } from '../types';

interface ContentPart {
  type: string;
  text?: string;
  reasoning?: string;
  details?: Array<{ text?: string }>;
  toolInvocation?: {
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    result?: unknown;
    state?: 'call' | 'partial-call' | 'result';
  };
  data?: {
    cycleId?: string;
    startedAt?: string;
    completedAt?: string;
    activatedAt?: string;
    tokensToObserve?: number;
    tokensObserved?: number;
    observationTokens?: number;
    tokensToBuffer?: number;
    tokensBuffered?: number;
    bufferedTokens?: number;
    tokensActivated?: number;
    config?: { messageTokens?: number; observationTokens?: number };
  };
}

interface MastraV2Content {
  format?: number;
  parts: ContentPart[];
}

function isMastraV2(content: unknown): content is MastraV2Content {
  return (
    typeof content === 'object' &&
    content !== null &&
    'parts' in content &&
    Array.isArray((content as { parts?: unknown }).parts)
  );
}

function parseContent(content: unknown): unknown {
  let value = content;
  for (let i = 0; i < 3 && typeof value === 'string'; i++) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
      if (typeof parsed === 'string' && parsed !== value) {
        value = parsed;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return value;
}

function isOmPart(part: ContentPart): boolean {
  return part.type.startsWith('data-om-');
}

function isVisiblePart(part: ContentPart): boolean {
  return part.type !== 'step-start' && !isOmPart(part);
}

type ToolInvocationPart = ContentPart & { type: 'tool-invocation' };

function formatToolValue(value: unknown): { text: string; language: 'json' | 'text' } {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return { text: JSON.stringify(parsed, null, 2), language: 'json' };
      }
    } catch {
      /* not json */
    }
    return { text: value, language: 'text' };
  }
  return { text: JSON.stringify(value, null, 2), language: 'json' };
}

function ToolPayload({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-medium text-icon3">{title}</span>
      <pre className="max-h-48 overflow-auto rounded-md bg-[var(--mastra-bg-2)] p-3 text-xs whitespace-pre-wrap break-all font-mono text-[var(--mastra-el-5)]">
        {text}
      </pre>
    </div>
  );
}

function ToolMessage({ parts }: { parts: ToolInvocationPart[] }) {
  const callPart = parts.find(p => p.toolInvocation?.state !== 'result') ?? parts[0];
  const resultPart = parts.find(p => p.toolInvocation?.state === 'result');
  const inv = callPart.toolInvocation!;
  const args = formatToolValue(inv.args);
  const result =
    resultPart?.toolInvocation?.result !== undefined ? formatToolValue(resultPart.toolInvocation.result) : null;

  return (
    <Collapsible className="mt-2 w-full">
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-2">
        <Badge variant="default" size="xs" className="gap-1">
          <WrenchIcon className="size-3" />
          <span className="font-mono text-[11px]">{inv.toolName}</span>
          <span className="text-[10px] opacity-70">{result ? '(call + result)' : `(${inv.state})`}</span>
        </Badge>
        <ChevronDownIcon className="size-3.5 transition-transform [[data-panel-open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full pt-2">
        <DashboardCard className="space-y-4 overflow-hidden">
          <ToolPayload title="Arguments" text={args.text} />
          {result ? <ToolPayload title="Result" text={result.text} /> : null}
        </DashboardCard>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningMessage({ part }: { part: ContentPart }) {
  const text = part.details?.[0]?.text ?? part.reasoning;
  if (!text) return null;
  const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;

  return (
    <Collapsible className="mt-2 w-full">
      <CollapsibleTrigger className="flex items-center gap-2">
        <Badge variant="default" size="xs" className="gap-1">
          <BrainIcon className="size-3" />
          <span className="text-[11px]">Reasoning</span>
        </Badge>
        <span className="text-xs text-icon3 italic truncate">{preview}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 w-full">
        <DashboardCard>
          <MarkdownRenderer>{text}</MarkdownRenderer>
        </DashboardCard>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ContentBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg px-3 py-2 bg-[var(--mastra-bg-3)] min-w-0 text-[var(--mastra-el-6)]', className)}>
      {children}
    </div>
  );
}

function PartRenderer({ part }: { part: ContentPart }) {
  switch (part.type) {
    case 'text':
      return part.text ? (
        <ContentBubble>
          <div className="text-sm">
            <MarkdownRenderer>{part.text}</MarkdownRenderer>
          </div>
        </ContentBubble>
      ) : null;
    case 'reasoning':
      return (
        <div className="w-full">
          <ReasoningMessage part={part} />
        </div>
      );
    default:
      return null;
  }
}

function renderParts(parts: ContentPart[]) {
  const rendered: ReactElement[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (part.type === 'tool-invocation') {
      const groupedParts: ToolInvocationPart[] = [part as ToolInvocationPart];
      while (index + 1 < parts.length && parts[index + 1]?.type === 'tool-invocation') {
        groupedParts.push(parts[index + 1] as ToolInvocationPart);
        index += 1;
      }
      rendered.push(
        <div key={`part-${index}`} className="w-full">
          <ToolMessage parts={groupedParts} />
        </div>,
      );
      continue;
    }

    rendered.push(<PartRenderer key={`part-${index}`} part={part} />);
  }

  return rendered;
}

type OmStatus = { label: string; className: string };

function getOmStatusForPart(part: ContentPart): OmStatus | null {
  switch (part.type) {
    case 'data-om-buffering-start':
      return { label: 'Buffering', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
    case 'data-om-buffering-end':
      return { label: 'Buffered Observations', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' };
    case 'data-om-activation':
      return { label: 'Activated Observations', className: 'bg-violet-500/15 text-violet-600 border-violet-500/30' };
    case 'data-om-observation-start':
      return { label: 'Observing', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
    case 'data-om-observation-end':
      return { label: 'Observed', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
    default:
      return null;
  }
}

function formatCompactTokens(value: number): string {
  if (value === 0) return '0';
  const k = value / 1000;
  const formatted = k.toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

type OmMarkerKind = 'buffering-start' | 'buffering-end' | 'activation' | 'observation-start' | 'observation-end';

type OmMetrics = {
  pendingTokens?: number;
  observationTokens?: number;
};

type OmMarkerData = {
  id: string;
  statuses: OmStatus[];
  metrics: OmMetrics;
  kind: OmMarkerKind;
  cycleId?: string;
};

function getOmMarkerKind(part: ContentPart): OmMarkerKind {
  switch (part.type) {
    case 'data-om-buffering-start':
      return 'buffering-start';
    case 'data-om-buffering-end':
      return 'buffering-end';
    case 'data-om-activation':
      return 'activation';
    case 'data-om-observation-start':
      return 'observation-start';
    case 'data-om-observation-end':
      return 'observation-end';
    default:
      return 'activation';
  }
}

function buildOmMarkerData(message: MemoryMessage, part: ContentPart, index: number): OmMarkerData {
  const pendingTokens = part.data?.tokensToObserve ?? part.data?.tokensToBuffer ?? part.data?.tokensActivated;
  const observationTokens = part.data?.observationTokens ?? part.data?.bufferedTokens;
  return {
    id: `${message.id}-om-${index}`,
    statuses: getOmStatusForPart(part) ? [getOmStatusForPart(part)!] : [],
    metrics: { pendingTokens, observationTokens },
    kind: getOmMarkerKind(part),
    cycleId: part.data?.cycleId,
  };
}

function formatCompressionRatio(input?: number, output?: number): string | null {
  if (!input || !output || output <= 0) return null;
  return `-${Math.max(1, Math.round(input / output))}x`;
}

function getOmMarkerSummary(marker: OmMarkerData): string | null {
  const pending = marker.metrics.pendingTokens != null ? `${formatCompactTokens(marker.metrics.pendingTokens)}k` : null;
  const observed =
    marker.metrics.observationTokens != null ? `${formatCompactTokens(marker.metrics.observationTokens)}k` : null;

  switch (marker.kind) {
    case 'buffering-end': {
      const ratio = formatCompressionRatio(marker.metrics.pendingTokens, marker.metrics.observationTokens);
      if (pending && observed && ratio) return `${pending} messages → ${observed} memory (${ratio})`;
      if (pending && observed) return `${pending} messages → ${observed} memory`;
      return pending ?? observed;
    }
    case 'activation':
      if (pending && observed) return `-${pending} messages +${observed} memory`;
      if (pending) return `-${pending} messages`;
      if (observed) return `+${observed} memory`;
      return null;
    case 'observation-end': {
      const ratio = formatCompressionRatio(marker.metrics.pendingTokens, marker.metrics.observationTokens);
      if (pending && observed && ratio) return `${pending} observed → ${observed} memory (${ratio})`;
      if (pending && observed) return `${pending} observed → ${observed} memory`;
      return pending ?? observed;
    }
    default:
      if (pending && observed) return `${pending} · ${observed}`;
      return pending ?? observed;
  }
}

function OmMarker({ marker }: { marker: OmMarkerData }) {
  const primaryStatus = marker.statuses[marker.statuses.length - 1];
  const summary = getOmMarkerSummary(marker);

  return (
    <div className="flex justify-center py-0.5">
      <div className="w-full max-w-3xl px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono uppercase tracking-wide text-icon3">
          {primaryStatus ? (
            <span
              className={cn(
                'h-5 rounded-full border px-2 inline-flex items-center text-[10px] shadow-none',
                primaryStatus.className,
              )}
            >
              {primaryStatus.label}
            </span>
          ) : null}
          {summary ? <span className="text-icon3 normal-case tracking-normal">{summary}</span> : null}
        </div>
      </div>
    </div>
  );
}

function getDisplayRole(message: MemoryMessage): 'user' | 'assistant' | 'tool' {
  if (message.role === 'assistant') return 'assistant';
  if ((message.role as string) === 'tool') return 'tool';
  const content = parseContent(message.content);
  if (isMastraV2(content)) {
    const toolParts = content.parts.filter(p => p.type === 'tool-invocation');
    if (toolParts.length > 0 && toolParts.every(p => p.toolInvocation?.state === 'result')) {
      return 'assistant';
    }
  }
  return 'user';
}

function shouldCollapseMessage(message: MemoryMessage): boolean {
  const content = parseContent(message.content);
  if (typeof content === 'string') {
    return content.length > 1600 || content.split('\n').length > 18;
  }
  if (!isMastraV2(content)) return false;
  const textLength = content.parts.reduce((total, part) => total + (part.text?.length ?? 0), 0);
  return textLength > 1600 || content.parts.length > 12;
}

type TimelineEntry =
  | { type: 'message'; id: string; message: MemoryMessage }
  | { type: 'marker'; id: string; marker: OmMarkerData };

function splitMessageIntoEntries(message: MemoryMessage): TimelineEntry[] {
  const content = parseContent(message.content);

  if (!isMastraV2(content)) {
    return [{ type: 'message', id: message.id, message }];
  }

  const entries: TimelineEntry[] = [];
  let chunk: ContentPart[] = [];
  let chunkIndex = 0;
  let markerIndex = 0;

  const flushChunk = () => {
    const visible = chunk.filter(isVisiblePart);
    if (visible.length === 0) return;
    entries.push({
      type: 'message',
      id: `${message.id}-chunk-${chunkIndex}`,
      message: {
        ...message,
        id: `${message.id}-chunk-${chunkIndex}`,
        content: { ...content, parts: visible } as unknown as MemoryMessage['content'],
      },
    });
    chunkIndex += 1;
    chunk = [];
  };

  for (const part of content.parts) {
    if (isOmPart(part)) {
      flushChunk();
      if (part.type !== 'data-om-status') {
        entries.push({
          type: 'marker',
          id: `${message.id}-om-${markerIndex}`,
          marker: buildOmMarkerData(message, part, markerIndex),
        });
        markerIndex += 1;
      }
      continue;
    }
    if (part.type !== 'step-start') {
      chunk.push(part);
    }
  }

  flushChunk();

  return entries.length > 0 ? entries : [{ type: 'message', id: message.id, message }];
}

function isToolResultOnlyMessage(message: MemoryMessage): boolean {
  const content = parseContent(message.content);
  if (!isMastraV2(content)) return false;
  const toolParts = content.parts.filter(p => p.type === 'tool-invocation');
  return toolParts.length > 0 && toolParts.every(p => p.toolInvocation?.state === 'result');
}

function isAssistantToolCallOnlyMessage(message: MemoryMessage): boolean {
  if (message.role !== 'assistant') return false;
  const content = parseContent(message.content);
  if (!isMastraV2(content) || content.parts.length === 0) return false;
  const visibleParts = content.parts.filter(p => p.type !== 'step-start' && !isOmPart(p));
  return (
    visibleParts.length > 0 &&
    visibleParts.every(p => p.type === 'tool-invocation' && p.toolInvocation?.state !== 'result')
  );
}

function mergeToolCallAndResultMessages(messages: MemoryMessage[]): MemoryMessage[] {
  const merged: MemoryMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i];
    const next = messages[i + 1];
    if (!current || !next || !isAssistantToolCallOnlyMessage(current) || !isToolResultOnlyMessage(next)) {
      merged.push(current);
      continue;
    }
    const currentContent = parseContent(current.content);
    const nextContent = parseContent(next.content);
    if (!isMastraV2(currentContent) || !isMastraV2(nextContent)) {
      merged.push(current);
      continue;
    }
    const currentVisible = currentContent.parts.filter(p => !isOmPart(p));
    const currentOm = currentContent.parts.filter(p => isOmPart(p));
    const nextVisible = nextContent.parts.filter(p => !isOmPart(p));
    merged.push({
      ...current,
      content: {
        ...currentContent,
        parts: [...currentVisible, ...nextVisible, ...currentOm],
      } as unknown as MemoryMessage['content'],
    });
    i += 1;
  }
  return merged;
}

function mergeConsecutiveOmMarkers(entries: TimelineEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [];
  for (const entry of entries) {
    const previous = merged[merged.length - 1];

    if (entry.type === 'marker') {
      let matchingStartIndex = -1;
      if (entry.marker.cycleId) {
        for (let i = merged.length - 1; i >= 0; i -= 1) {
          const candidate = merged[i];
          if (candidate?.type !== 'marker') continue;
          const isBufferingMatch =
            candidate.marker.kind === 'buffering-start' &&
            entry.marker.kind === 'buffering-end' &&
            candidate.marker.cycleId === entry.marker.cycleId;
          const isObservationMatch =
            candidate.marker.kind === 'observation-start' &&
            entry.marker.kind === 'observation-end' &&
            candidate.marker.cycleId === entry.marker.cycleId;
          if (isBufferingMatch || isObservationMatch) {
            matchingStartIndex = i;
            break;
          }
        }
      }
      if (matchingStartIndex >= 0) {
        const matchingStart = merged[matchingStartIndex];
        if (matchingStart?.type === 'marker') {
          matchingStart.marker = {
            ...matchingStart.marker,
            kind: entry.marker.kind,
            statuses: entry.marker.statuses,
            metrics: {
              pendingTokens: entry.marker.metrics.pendingTokens ?? matchingStart.marker.metrics.pendingTokens,
              observationTokens:
                entry.marker.metrics.observationTokens ?? matchingStart.marker.metrics.observationTokens,
            },
          };
          continue;
        }
      }
    }

    if (entry.type === 'marker' && previous?.type === 'marker') {
      const shouldMergeBuffering = previous.marker.kind === 'buffering-start' && entry.marker.kind === 'buffering-end';
      const shouldMergeObservation =
        previous.marker.kind === 'observation-start' && entry.marker.kind === 'observation-end';
      if (shouldMergeBuffering || shouldMergeObservation) {
        previous.marker = {
          ...previous.marker,
          kind: entry.marker.kind,
          statuses: entry.marker.statuses,
          metrics: {
            pendingTokens: entry.marker.metrics.pendingTokens ?? previous.marker.metrics.pendingTokens,
            observationTokens: entry.marker.metrics.observationTokens ?? previous.marker.metrics.observationTokens,
          },
        };
        continue;
      }
    }

    merged.push(entry);
  }
  return merged;
}

function MessageContent({ content: raw }: { content: unknown }) {
  const content = parseContent(raw);

  if (typeof content === 'string') {
    return (
      <ContentBubble>
        <div className="text-sm">
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>
      </ContentBubble>
    );
  }

  if (isMastraV2(content)) {
    const visible = content.parts.filter(p => p.type !== 'step-start' && !p.type.startsWith('data-'));
    if (visible.length > 0) {
      return <>{renderParts(visible)}</>;
    }
  }

  return (
    <ContentBubble>
      <pre className="whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(content, null, 2)}</pre>
    </ContentBubble>
  );
}

function MessageBubble({ message }: { message: MemoryMessage }) {
  const displayRole = getDisplayRole(message);
  const isUser = displayRole === 'user';
  const isTool = displayRole === 'tool';
  const [expanded, setExpanded] = useState(!shouldCollapseMessage(message));

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('min-w-0 w-full', isUser ? 'max-w-[90%] sm:max-w-[80%] md:max-w-[75%]' : 'max-w-full')}>
        <div className={cn('mb-1 flex items-center gap-1.5', isUser ? 'justify-end' : 'justify-start')}>
          {isUser ? (
            <>
              <span className="text-xs font-mono text-icon3">{format(new Date(message.createdAt), 'HH:mm:ss')}</span>
              <span className="text-icon3">·</span>
              <span className="text-[10px] font-semibold font-mono uppercase text-[var(--mastra-el-accent)]">User</span>
            </>
          ) : (
            <>
              <span
                className={cn(
                  'text-[10px] font-semibold font-mono uppercase',
                  isTool ? 'text-violet-400' : 'text-emerald-400',
                )}
              >
                {isTool ? 'Tool' : 'Assistant'}
              </span>
              <span className="text-icon3">·</span>
              <span className="text-xs font-mono text-icon3">{format(new Date(message.createdAt), 'HH:mm:ss')}</span>
            </>
          )}
        </div>
        <div className="flex min-w-0 w-full flex-col gap-2 break-words text-xs text-[var(--mastra-el-5)]">
          <div className={cn('relative', !expanded && 'max-h-[28rem] overflow-hidden')}>
            <MessageContent content={message.content} />
            {!expanded ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--mastra-bg-1)] via-[var(--mastra-bg-1)]/85 to-transparent" />
            ) : null}
          </div>
          {shouldCollapseMessage(message) ? (
            <button
              type="button"
              onClick={() => setExpanded(c => !c)}
              className={cn(
                'text-[11px] font-mono tracking-wide text-icon3 transition-colors hover:text-[var(--mastra-el-6)]',
                isUser ? 'self-end' : 'self-start',
              )}
            >
              {expanded ? 'Show less' : 'Show full message'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export interface MemoryMessageListProps {
  messages: MemoryMessage[];
  isLoading?: boolean;
}

export function MemoryMessageList({ messages, isLoading }: MemoryMessageListProps) {
  const entries = useMemo<TimelineEntry[]>(
    () =>
      mergeConsecutiveOmMarkers(
        mergeToolCallAndResultMessages(messages).flatMap(message => splitMessageIntoEntries(message)),
      ),
    [messages],
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[60%] rounded-lg" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-20 w-[75%] rounded-lg" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-12 w-[50%] rounded-lg" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-24 w-[80%] rounded-lg" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[55%] rounded-lg" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-16 w-[70%] rounded-lg" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        iconSlot={<MessageSquareIcon className="size-4" />}
        titleSlot="No messages"
        descriptionSlot="This thread has no messages yet."
      />
    );
  }

  return (
    <div className="w-full flex-1 space-y-4 p-4">
      {entries.map(entry =>
        entry.type === 'message' ? (
          <MessageBubble key={entry.id} message={entry.message} />
        ) : (
          <OmMarker key={entry.id} marker={entry.marker} />
        ),
      )}
    </div>
  );
}
