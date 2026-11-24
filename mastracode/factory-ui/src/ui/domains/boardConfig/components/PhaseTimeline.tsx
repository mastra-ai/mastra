import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ComponentType, ReactNode } from 'react';

import type { BoardPhaseKind } from '@mastra/factory/boards';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';

/** One step of a card's way through a phase, on a rail joining it to the next. */
export function Step({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <li className="group relative flex gap-2.5 pb-3 last:pb-0">
      <span aria-hidden className="relative flex w-4 shrink-0 justify-center">
        <Icon className="text-muted-foreground size-icon-sm relative top-0.5" />
        <span className="bg-border absolute top-5 bottom-[-0.125rem] w-px group-last:hidden" />
      </span>
      <div className="text-body-sm flex min-w-0 flex-1 flex-col gap-0.5">
        <Txt as="span" variant="caption" tone="faint">
          {label}
        </Txt>
        {children}
      </div>
    </li>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="caption" tone="muted">
      {children}
    </Txt>
  );
}

/** The phases a card can move to from here, each with its icon, or that it stays put. */
export function NextPhases({
  boardId,
  next,
  phases,
}: {
  boardId: string;
  next: readonly string[];
  phases: readonly { key: string; name: string; kind: BoardPhaseKind }[];
}) {
  if (next.length === 0) return <Muted>Stays here</Muted>;
  return next.map(key => {
    const target = phases.find(candidate => candidate.key === key);
    return (
      <span key={key} className="flex min-w-0 items-center gap-1.5">
        {target && <BoardStageIcon stage={key} kind={phaseIconKind(boardId, target.kind)} decorative />}
        <span className="truncate">{target?.name ?? key}</span>
      </span>
    );
  });
}
