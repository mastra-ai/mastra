import type { BoardPhaseKind } from '@mastra/factory/boards';
import { IconCircleCheck } from '@mastra/playground-ui/icons/central/IconCircleCheck';
import { IconHand5Finger } from '@mastra/playground-ui/icons/central/IconHand5Finger';

import type { InstalledPhaseInfo } from '../../../api/types';
import { describeRule } from '../settings/components/conditionFields';
import { PHASE_TOOLS } from './boardDraft';

type CardRule = InstalledPhaseInfo['autoStartWhen'] | null;
type ExitTool = { autoApprove?: boolean; autoApproveWhen?: CardRule };

/** "Starts on its own only if labels contains bug": what happens on its own, and for which cards. */
export function onItsOwn(happens: string, rule: CardRule): string {
  if (!rule || rule.conditions.length === 0) return happens;
  const conditions = describeRule(rule);
  return `${happens} only if ${conditions.charAt(0).toLowerCase()}${conditions.slice(1)}`;
}

export function startsText(phase: { autoStart?: boolean; autoStartWhen?: CardRule }): string {
  return phase.autoStart ? onItsOwn('Starts on its own', phase.autoStartWhen) : 'Started by hand';
}

export function approvalText(exitTool: ExitTool): string {
  return exitTool.autoApprove ? onItsOwn('Approved on its own', exitTool.autoApproveWhen) : 'A person approves it';
}

export function toolLabel(id: string): string {
  return PHASE_TOOLS.find(tool => tool.id === id)?.label ?? id;
}

/** Who works a card in a phase no agent runs: nobody on a terminal phase, a person elsewhere. */
export function unattended(kind: BoardPhaseKind) {
  return kind === 'terminal'
    ? { text: 'Finished', icon: IconCircleCheck }
    : { text: 'Waits for someone', icon: IconHand5Finger };
}
