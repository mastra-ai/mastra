import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import type { LinkedRepositoryPayload } from '../../../../workspaces/services/github';
import { CommitRail } from './CommitRail';

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
          {githubRepositories.length > 1 ? (
            <DropdownMenu>
              <DropdownMenu.Trigger variant="ghost" size="sm" aria-label={`Repository: ${repository.slug}`}>
                {repository.slug}
                <ChevronDown aria-hidden />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" className="min-w-56">
                {githubRepositories.map(candidate => (
                  <DropdownMenu.Item
                    key={candidate.projectRepositoryId}
                    onClick={() => setSelectedId(candidate.projectRepositoryId)}
                  >
                    <span className="flex-1">{candidate.slug}</span>
                    {candidate.projectRepositoryId === repository.projectRepositoryId ? (
                      <Check aria-label="Selected" />
                    ) : null}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          ) : (
            <Txt as="span" variant="caption" tone="muted">
              {repository.slug}
            </Txt>
          )}
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
