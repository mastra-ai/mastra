import type { InstalledPhaseInfo } from '@mastra/client-js';
import { approvalText, startsText } from '../rules/phase-summary';
import { ruleCount } from '../rules/rule-lanes';
import { useBoardNavigation } from './board-navigation';
import { PhaseSetup } from './phase-setup';
import type { PhaseSetupHandle } from './phase-setup';
import { usePhaseArrivals } from './use-phase-arrivals';

export function BoardPhaseSetup({
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
    <PhaseSetup
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
