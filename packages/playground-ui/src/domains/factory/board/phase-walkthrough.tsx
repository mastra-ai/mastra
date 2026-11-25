import type { ComponentType, ReactNode } from 'react';

import { BoardStageIcon, phaseIconKind } from './board-icons';
import type { BoardPhaseKind } from './board-icons';
import { Txt } from '@/ds/components/Txt';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { IconFlag2 } from '@/ds/icons/central/IconFlag2';
import { IconHand5Finger } from '@/ds/icons/central/IconHand5Finger';

import { IconPlay } from '@/ds/icons/central/IconPlay';
import { IconRobot } from '@/ds/icons/central/IconRobot';

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
        <Icon className="relative top-0.5 size-icon-sm text-muted-foreground" />
        <span className="absolute top-5 bottom-[-0.125rem] w-px bg-border group-last:hidden" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-sm">
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

/** Who works a card in a phase no agent runs: nobody on a terminal phase, a person elsewhere. */
// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function unattended(kind: BoardPhaseKind) {
  return kind === 'terminal'
    ? { text: 'Finished', icon: IconCircleCheck }
    : { text: 'Waits for someone', icon: IconHand5Finger };
}

/** What the walkthrough reads from a phase; the host words tool labels and approval. */
export interface PhaseOutline {
  key: string;
  name: string;
  kind: BoardPhaseKind;
  runs: boolean;
  /** Tool labels, as the host names them. */
  tools?: readonly string[] | null;
  exitTool?: { id: string; approval: string } | null;
  nextPhases?: readonly string[] | null;
}

/**
 * A card's way through a phase, top to bottom: how it gets in, how the work starts, who does it, how it ends and
 * where the card can go next.
 */
export function PhaseWalkthrough({
  boardId,
  phase,
  phases,
  arrivals,
  starts,
  agent,
}: {
  boardId: string;
  phase: PhaseOutline;
  phases: readonly PhaseOutline[];
  arrivals: ReactNode;
  starts: ReactNode;
  agent: ReactNode;
}) {
  const idle = unattended(phase.kind);
  return (
    <ol aria-label={`${phase.name}, step by step`} className="flex flex-col">
      <Step label="In" icon={IconArrowInbox}>
        {arrivals}
      </Step>
      {phase.runs && (
        <Step label="Starts" icon={IconPlay}>
          {starts}
        </Step>
      )}
      <Step label="Work" icon={phase.runs ? IconRobot : idle.icon}>
        {phase.runs ? (
          <>
            {agent}
            {phase.tools?.map(label => (
              <Muted key={label}>{label}</Muted>
            ))}
          </>
        ) : (
          <Muted>{idle.text}</Muted>
        )}
      </Step>
      {phase.exitTool && (
        <Step label="Ends with" icon={IconFlag2}>
          <Txt as="span" variant="caption" tone="ink" className="truncate">
            {phase.exitTool.id}
          </Txt>
          <Muted>{phase.exitTool.approval}</Muted>
        </Step>
      )}
      <Step label="Next" icon={IconArrowRight}>
        <NextPhases boardId={boardId} next={phase.nextPhases ?? []} phases={phases} />
      </Step>
    </ol>
  );
}

/** A phase's setup read top to bottom, with the host's header actions beside its name. */
export function PhaseSetupCard({
  boardId,
  phase,
  phases,
  label,
  actions,
  arrivals,
  starts,
  agent,
}: {
  boardId: string;
  phase: PhaseOutline;
  phases: readonly PhaseOutline[];
  label: string;
  actions?: ReactNode;
  arrivals: ReactNode;
  starts: ReactNode;
  agent: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
        <Txt as="span" variant="label" tone="ink" className="min-w-0 flex-1 truncate">
          {label}
        </Txt>
        {actions && <div className="-mr-1.5 flex items-center">{actions}</div>}
      </div>
      <PhaseWalkthrough
        boardId={boardId}
        phase={phase}
        phases={phases}
        arrivals={arrivals}
        starts={starts}
        agent={agent}
      />
    </>
  );
}
