import { Txt } from '@mastra/playground-ui/components/Txt';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Brain, MessagesSquare, SquareKanban, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

import type { FlowRow, FlowSource } from './modelRouting';
import { ExplainedPayee } from './StoryPayee';
import type { StoryState } from './storyState';

export type FlowControls = { model?: ReactNode; payer?: ReactNode; payerWhy?: string; route?: ReactNode };

function SourceIcon({ source }: { source: FlowSource }) {
  const className = 'text-muted-foreground size-4 shrink-0';
  switch (source) {
    case 'sessions':
      return <MessagesSquare aria-hidden className={className} />;
    case 'slack':
      return <SlackIcon aria-hidden className="size-4 shrink-0" />;
    case 'cards':
      return <SquareKanban aria-hidden className={className} />;
    case 'memory':
      return <Brain aria-hidden className={className} />;
    case 'auto':
      return <Zap aria-hidden className={className} />;
  }
}

function Arrow({ faint, hidden = false }: { faint: boolean; hidden?: boolean }) {
  return (
    <ArrowRight
      aria-hidden
      className={cn('size-3.5 shrink-0', faint ? 'text-border-strong' : 'text-muted-foreground', hidden && 'invisible')}
    />
  );
}

function ModelCell({ row }: { row: FlowRow }) {
  const text = row.status === 'waiting' ? 'Waits' : row.model;
  return (
    <Txt
      as="span"
      variant="meta"
      tone={row.status === 'blocked' ? undefined : row.status === 'ready' ? 'ink' : 'muted'}
      className={cn('truncate', row.status === 'blocked' && 'text-destructive-indicator')}
    >
      {text}
    </Txt>
  );
}

const FLOW_GRID =
  'grid grid-cols-[minmax(9rem,1fr)_auto_minmax(0,11rem)_auto_minmax(0,13rem)_11rem] items-center gap-3';

export type FlowColumns = { source: string; model: string; payer: string; route?: string };

function ColumnHeader({ children }: { children?: string }) {
  return (
    <Txt as="span" variant="caption" tone="faint" className="truncate">
      {children}
    </Txt>
  );
}

function FlowHeader({ columns }: { columns: FlowColumns }) {
  return (
    <div className={cn(FLOW_GRID, 'border-border border-b px-4 pt-2 pb-1.5')}>
      <ColumnHeader>{columns.source}</ColumnHeader>
      <span className="w-3.5" />
      <ColumnHeader>{columns.model}</ColumnHeader>
      <span className="w-3.5" />
      <ColumnHeader>{columns.payer}</ColumnHeader>
      <span className="text-right">
        <ColumnHeader>{columns.route}</ColumnHeader>
      </span>
    </div>
  );
}

function StoryFlowRow({ row, state, controls }: { row: FlowRow; state: StoryState; controls: FlowControls }) {
  const off = row.status === 'off';
  return (
    <div className={cn(FLOW_GRID, 'px-4 py-2')}>
      <span className="flex min-w-0 items-center gap-2">
        <SourceIcon source={row.source} />
        <Txt as="span" variant="body-sm" tone={off ? 'muted' : 'ink'} className="truncate">
          {row.label}
        </Txt>
      </span>
      <Arrow faint={off} />
      <span className="flex min-w-0">{controls.model ?? <ModelCell row={row} />}</span>
      <Arrow faint={false} hidden={off || row.payer === null} />
      <span className="flex min-w-0">
        {controls.payer ?? <ExplainedPayee state={state} target={off ? null : row.payer} why={controls.payerWhy} />}
      </span>
      <span className="flex justify-end">{controls.route}</span>
    </div>
  );
}

export function StoryFlowRows({
  rows,
  state,
  controlsFor,
  columns,
}: {
  rows: FlowRow[];
  state: StoryState;
  controlsFor?: (row: FlowRow) => FlowControls;
  columns?: FlowColumns;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem] pb-1">
        {columns ? <FlowHeader columns={columns} /> : <div className="h-1" />}
        {rows.map(row => (
          <StoryFlowRow key={row.id} row={row} state={state} controls={controlsFor?.(row) ?? {}} />
        ))}
      </div>
    </div>
  );
}
