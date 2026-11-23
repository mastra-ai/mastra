import type { BoardPhaseKind } from '@mastra/factory/boards';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowInbox } from '@mastra/playground-ui/icons/central/IconArrowInbox';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import type { ReactNode } from 'react';

import type { InstalledPhaseInfo, StoredPhaseInfo } from '../../../../api/types';
import { nextPhasesOf } from '../boardDraft';
import { approvalText, toolLabel, unattended } from '../phaseSummary';
import { Muted, NextPhases, Step } from './PhaseTimeline';

/** What the walkthrough reads from a phase, whether it comes from the saved board or from the one being edited. */
export interface PhaseOutline {
  key: string;
  name: string;
  kind: BoardPhaseKind;
  runs: boolean;
  tools?: readonly string[] | null;
  exitTool?: StoredPhaseInfo['exitTool'] | null;
  nextPhases?: readonly string[] | null;
}

/** A phase being edited, whose unset moves mean every other phase, as the server reads them. */
export function outlineOfStored(phase: StoredPhaseInfo, phases: readonly StoredPhaseInfo[]): PhaseOutline {
  return { ...phase, runs: Boolean(phase.runner), nextPhases: nextPhasesOf(phase, phases) };
}

export function outlineOfInstalled(phase: InstalledPhaseInfo): PhaseOutline {
  return { ...phase, key: phase.id, name: phase.name ?? phase.title, runs: Boolean(phase.skill) };
}

/**
 * A card's way through a phase, top to bottom: how it gets in, how the work starts, who does it, how it ends and where
 * the card can go next. The Overview and the board's column headers both read a phase this way; each brings what it
 * can show of the rules, the start and the agent.
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
            {phase.tools?.map(id => (
              <Muted key={id}>{toolLabel(id)}</Muted>
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
          <Muted>{approvalText(phase.exitTool)}</Muted>
        </Step>
      )}
      <Step label="Next" icon={IconArrowRight}>
        <NextPhases boardId={boardId} next={phase.nextPhases ?? []} phases={phases} />
      </Step>
    </ol>
  );
}
