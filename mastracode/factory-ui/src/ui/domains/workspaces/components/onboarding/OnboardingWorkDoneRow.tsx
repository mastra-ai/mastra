import { useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import { useWorkSourceConnectionsStatus, WORK_SOURCE_NAME, WORK_SOURCES } from '../../hooks/useWorkSourceConnections';
import type { WorkSourceConnectionsStatus } from '../../hooks/useWorkSourceConnections';
import type { SourceControlRepository } from '../../services/github';
import { HOST_NAMES, repositoryHost } from '../../services/sourceControlHosts';
import { OnboardingDoneRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';

/**
 * Nothing until every source answers, so "Set up later" never stands in for a connection still loading.
 * The codebase repository comes first because it is the source the Work step offers by default.
 */
function workSummary(
  { connected, isPending, isError }: WorkSourceConnectionsStatus,
  { repository, codeHostSync }: Pick<OnboardingWorkDoneRowProps, 'repository' | 'codeHostSync'>,
): string | undefined {
  if (isPending) return undefined;
  if (isError) return "Couldn't check connections";
  const codeHost = repository && codeHostSync !== false ? [HOST_NAMES[repositoryHost(repository)]] : [];
  const names = WORK_SOURCES.filter(source => connected[source]).map(source => WORK_SOURCE_NAME[source]);
  return [...codeHost, ...names].join(', ') || 'Set up later';
}

export interface OnboardingWorkDoneRowProps extends ChangeSectionProps {
  repository?: SourceControlRepository;
  codeHostSync?: boolean;
}

/** Work once the user moved past it: the chosen sources, and the Linear workspace when there is one. */
export function OnboardingWorkDoneRow({ repository, codeHostSync, ...change }: OnboardingWorkDoneRowProps) {
  const status = useWorkSourceConnectionsStatus();
  const linear = useLinearStatusQuery();
  // The server sends `null` for a workspace without a name.
  const linearWorkspace = status.connected.linear ? (linear.data?.workspace?.name ?? undefined) : undefined;
  return (
    <OnboardingDoneRow
      section="project-management"
      value={workSummary(status, { repository, codeHostSync })}
      subValue={linearWorkspace}
      {...change}
    />
  );
}
