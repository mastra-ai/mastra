import type { BoardPhaseKind } from '@mastra/factory/boards';
import { PhaseWalkthrough as SharedPhaseWalkthrough } from '@mastra/playground-ui/domains/factory';
import type { PhaseOutline as SharedPhaseOutline } from '@mastra/playground-ui/domains/factory';
import type { ComponentProps } from 'react';

import type { InstalledPhaseInfo, StoredPhaseInfo } from '../../../../api/types';
import { nextPhasesOf } from '../boardDraft';
import { approvalText, toolLabel } from '../phaseSummary';
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

/** The shared walkthrough, with this host's tool labels and approval wording. */
export function PhaseWalkthrough({
  phase,
  phases,
  ...rest
}: Omit<ComponentProps<typeof SharedPhaseWalkthrough>, 'phase' | 'phases'> & {
  phase: PhaseOutline;
  phases: readonly PhaseOutline[];
}) {
  return <SharedPhaseWalkthrough {...rest} phase={sharedOutline(phase)} phases={phases.map(sharedOutline)} />;
}

export function sharedOutline(phase: PhaseOutline): SharedPhaseOutline {
  return {
    ...phase,
    tools: phase.tools?.map(toolLabel),
    exitTool: phase.exitTool ? { id: phase.exitTool.id, approval: approvalText(phase.exitTool) } : null,
  };
}
