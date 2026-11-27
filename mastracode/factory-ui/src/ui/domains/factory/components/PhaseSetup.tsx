import { PhaseSetup as SharedPhaseSetup, useBoardNavigation } from '@mastra/playground-ui/domains/factory';
import type { PhaseSetupHandle } from '@mastra/playground-ui/domains/factory';

import type { InstalledPhaseInfo } from '../../../../api/types';
import { approvalText, startsText } from '../../boardConfig/phaseSummary';
import { ruleCount } from '../../boardRules/ruleLanes';
import { usePhaseArrivals } from '../hooks/usePhaseArrivals';

export function PhaseSetup({
  handle,
  factoryId,
  boardId,
  phase,
  phases,
}: {
  handle: PhaseSetupHandle;
  factoryId: string;
  boardId: string;
  phase: InstalledPhaseInfo;
  phases: readonly InstalledPhaseInfo[];
}) {
  const { LinkComponent, boardConfigHref } = useBoardNavigation();
  const { into } = usePhaseArrivals(factoryId, boardId, phases[0]?.id);
  const arriving = into?.get(phase.id) ?? [];
  const { skill, autoStart, exitTool } = phase;
  const label = phase.name ?? phase.title;
  const summary = [
    arriving.length && `${ruleCount(arriving.length)} ${arriving.length === 1 ? 'moves' : 'move'} cards into ${label}.`,
    skill && `${label} runs ${skill}. ${startsText(phase)}.`,
    exitTool && `${label} ends when ${exitTool.id} succeeds. ${approvalText(exitTool)}.`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <SharedPhaseSetup
      handle={handle}
      phaseId={phase.id}
      href={boardConfigHref(boardId, phase.id)}
      summary={summary}
      arriving={arriving.length}
      agent={!!skill}
      autoStart={!!autoStart}
      exitTool={!!exitTool}
      LinkComponent={LinkComponent}
    />
  );
}
