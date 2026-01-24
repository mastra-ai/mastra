import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Span } from '@/types/api';

const statusConfig: Record<Span['status'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  ok: { icon: CheckCircle2, color: 'text-green-500' },
  error: { icon: XCircle, color: 'text-red-500' },
  unset: { icon: Circle, color: 'text-neutral6' },
};

const kindColors: Record<Span['kind'], string> = {
  internal: 'bg-neutral6',
  server: 'bg-green-600',
  client: 'bg-blue-600',
  producer: 'bg-purple-600',
  consumer: 'bg-orange-600',
};

interface SpanNode extends Span {
  children: SpanNode[];
}

interface SpanTreeProps {
  spans: Span[];
  selectedSpanId?: string;
  onSelectSpan?: (span: Span) => void;
}

export function SpanTree({ spans, selectedSpanId, onSelectSpan }: SpanTreeProps) {
  // Build tree structure
  const buildTree = (spans: Span[]): SpanNode[] => {
    const spanMap = new Map<string, SpanNode>();
    const roots: SpanNode[] = [];

    // Initialize nodes
    spans.forEach(span => {
      spanMap.set(span.spanId, { ...span, children: [] });
    });

    // Build tree
    spans.forEach(span => {
      const node = spanMap.get(span.spanId)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        spanMap.get(span.parentSpanId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = buildTree(spans);

  // Calculate total duration for timeline
  const minStart = Math.min(...spans.map(s => new Date(s.startTime).getTime()));
  const maxEnd = Math.max(
    ...spans.map(s => (s.endTime ? new Date(s.endTime).getTime() : new Date(s.startTime).getTime())),
  );
  const totalDuration = maxEnd - minStart;

  return (
    <div className="space-y-1">
      {tree.map(node => (
        <SpanNodeRow
          key={node.spanId}
          node={node}
          depth={0}
          selectedSpanId={selectedSpanId}
          onSelectSpan={onSelectSpan}
          minStart={minStart}
          totalDuration={totalDuration}
        />
      ))}
    </div>
  );
}

interface SpanNodeRowProps {
  node: SpanNode;
  depth: number;
  selectedSpanId?: string;
  onSelectSpan?: (span: Span) => void;
  minStart: number;
  totalDuration: number;
}

function SpanNodeRow({ node, depth, selectedSpanId, onSelectSpan, minStart, totalDuration }: SpanNodeRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedSpanId === node.spanId;

  const statusInfo = statusConfig[node.status];
  const StatusIcon = statusInfo.icon;

  // Calculate timeline position
  const startOffset = ((new Date(node.startTime).getTime() - minStart) / totalDuration) * 100;
  const duration = node.durationMs ?? 0;
  const width = Math.max((duration / (totalDuration || 1)) * 100, 0.5);

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isSelected ? 'bg-accent1/10' : 'hover:bg-surface3',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelectSpan?.(node)}
      >
        {/* Expand/collapse button */}
        <div className="w-4 flex-shrink-0">
          {hasChildren && (
            <button
              onClick={e => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="text-neutral6 hover:text-neutral9"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Status icon */}
        <StatusIcon className={cn('h-4 w-4 flex-shrink-0', statusInfo.color)} />

        {/* Kind badge */}
        <span className={cn('px-1.5 py-0.5 text-xs rounded font-medium text-white', kindColors[node.kind])}>
          {node.kind}
        </span>

        {/* Name */}
        <span className="font-medium truncate flex-1">{node.name}</span>

        {/* Duration */}
        <span className="text-sm text-neutral6 font-mono flex-shrink-0">{formatDuration(node.durationMs)}</span>

        {/* Timeline bar */}
        <div className="w-32 h-2 bg-surface4 rounded-full overflow-hidden flex-shrink-0 relative">
          <div
            className="absolute h-full bg-accent1 rounded-full"
            style={{ left: `${startOffset}%`, width: `${width}%` }}
          />
        </div>
      </div>

      {/* Children */}
      {expanded &&
        node.children.map(child => (
          <SpanNodeRow
            key={child.spanId}
            node={child}
            depth={depth + 1}
            selectedSpanId={selectedSpanId}
            onSelectSpan={onSelectSpan}
            minStart={minStart}
            totalDuration={totalDuration}
          />
        ))}
    </>
  );
}
