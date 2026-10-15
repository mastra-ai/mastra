import { Txt } from '@mastra/playground-ui/components/Txt';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import type { LinkedRepositoryPayload } from '../../../../workspaces/services/github';
import { CommitRail } from './CommitRail';
import { RepositorySwitcher } from './RepositorySwitcher';

export function CodebaseActivity({
  factoryId,
  repositories,
}: {
  factoryId: string;
  repositories: LinkedRepositoryPayload[];
}) {
  const githubRepositories = repositories.filter(candidate => candidate.provider !== 'gitlab');
  const [selectedId, setSelectedId] = useState(githubRepositories[0]?.projectRepositoryId);
  const repository =
    githubRepositories.find(candidate => candidate.projectRepositoryId === selectedId) ?? githubRepositories[0];

  return (
    <div className="flex flex-col gap-4">
      {repository ? (
        <div className="flex items-center justify-between gap-3">
          <RepositorySwitcher repositories={githubRepositories} selected={repository} onSelect={setSelectedId} />
          <a
            href={`https://github.com/${repository.slug}/commits`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Txt as="span" variant="caption">
              View on GitHub
            </Txt>
            <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      ) : null}
      <CommitRail projectRepositoryId={repository?.projectRepositoryId} factoryProjectId={factoryId} />
    </div>
  );
}
