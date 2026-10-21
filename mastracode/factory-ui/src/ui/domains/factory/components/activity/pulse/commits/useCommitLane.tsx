import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useRepositoryCommits } from '../../../../../../../hooks/useRepositoryCommits';
import type { LinkedRepositoryPayload } from '../../../../../workspaces/services/github';
import type { CommitLane } from '../lanes/LaneChart';
import type { TimeWindow } from '../time/timeViewport';
import { TRACK_CHIP_HEIGHT_PX } from '../track/trackChipStyles';
import { CommitMarks } from './CommitMarks';
import { RepositorySwitcher } from './RepositorySwitcher';

function LaneNote({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <span className="absolute inset-y-0 left-2 flex items-center gap-2">
      <Txt as="span" variant="caption" tone="muted">
        {children}
      </Txt>
      {action}
    </span>
  );
}

export function useCommitLane({
  factoryId,
  repositories,
  window,
}: {
  factoryId: string;
  repositories: LinkedRepositoryPayload[];
  window: TimeWindow;
}): CommitLane {
  const githubRepositories = repositories.filter(candidate => candidate.provider !== 'gitlab');
  const [selectedId, setSelectedId] = useState(githubRepositories[0]?.projectRepositoryId);
  const repository =
    githubRepositories.find(candidate => candidate.projectRepositoryId === selectedId) ?? githubRepositories[0];
  const { commits, loadingFailed, olderFailed, retryOlder } = useRepositoryCommits(
    repository?.projectRepositoryId,
    window.startMs,
  );

  if (repository === undefined) {
    return {
      name: 'Codebase',
      label: (
        <Txt as="span" variant="label" tone="muted">
          Codebase
        </Txt>
      ),
      track: () => (
        <LaneNote
          action={
            <Button variant="link" size="sm" render={<Link to={`/factories/${factoryId}/settings/repositories`} />}>
              Link repository
            </Button>
          }
        >
          No repository linked
        </LaneNote>
      ),
    };
  }

  return {
    name: repository.slug,
    label: <RepositorySwitcher repositories={githubRepositories} selected={repository} onSelect={setSelectedId} />,
    track: widthPx => {
      if (loadingFailed) return <LaneNote>Could not reach GitHub for commits.</LaneNote>;
      if (commits === undefined) {
        return (
          <Skeleton
            aria-label="Loading commits"
            className="absolute top-1/2 left-2 w-40 -translate-y-1/2 rounded-lg"
            style={{ height: TRACK_CHIP_HEIGHT_PX }}
          />
        );
      }
      return (
        <>
          <CommitMarks commits={commits} timeWindow={window} widthPx={widthPx} />
          {olderFailed ? (
            <LaneNote
              action={
                <Button variant="link" size="sm" onClick={retryOlder}>
                  Retry
                </Button>
              }
            >
              Earlier commits could not be loaded.
            </LaneNote>
          ) : null}
        </>
      );
    },
  };
}
