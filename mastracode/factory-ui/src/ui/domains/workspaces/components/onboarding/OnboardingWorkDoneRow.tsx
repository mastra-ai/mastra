import { useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import { useWorkSourceConnectionsStatus, WORK_SOURCE_NAME, WORK_SOURCES } from '../../hooks/useWorkSourceConnections';
import type { WorkSourceConnectionsStatus } from '../../hooks/useWorkSourceConnections';
import { OnboardingDoneRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';

/** Nothing until every source answers, so "Set up later" never stands in for a connection still loading. */
function workSummary({ connected, isPending, isError }: WorkSourceConnectionsStatus): string | undefined {
  if (isPending) return undefined;
  if (isError) return "Couldn't check connections";
  const names = WORK_SOURCES.filter(source => connected[source]).map(source => WORK_SOURCE_NAME[source]);
  return names.join(', ') || 'Set up later';
}

/** Work once the user moved past it: the connected sources, and the Linear workspace when there is one. */
export function OnboardingWorkDoneRow(change: ChangeSectionProps) {
  const status = useWorkSourceConnectionsStatus();
  const linear = useLinearStatusQuery();
  // The server sends `null` for a workspace without a name.
  const linearWorkspace = status.connected.linear ? (linear.data?.workspace?.name ?? undefined) : undefined;
  return (
    <OnboardingDoneRow
      section="project-management"
      value={workSummary(status)}
      subValue={linearWorkspace}
      {...change}
    />
  );
}
