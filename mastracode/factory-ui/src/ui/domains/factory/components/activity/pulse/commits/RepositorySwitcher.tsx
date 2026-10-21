import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronDown } from 'lucide-react';

import type { LinkedRepositoryPayload } from '../../../../../workspaces/services/github';

function repositoryName(slug: string): string {
  return slug.slice(slug.lastIndexOf('/') + 1);
}

export function RepositorySwitcher({
  repositories,
  selected,
  onSelect,
}: {
  repositories: LinkedRepositoryPayload[];
  selected: LinkedRepositoryPayload;
  onSelect: (projectRepositoryId: string) => void;
}) {
  if (repositories.length < 2) {
    return (
      <Txt as="span" variant="label" title={selected.slug} className="truncate">
        {repositoryName(selected.slug)}
      </Txt>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="sm" aria-label={`Repository: ${selected.slug}`}>
        {repositoryName(selected.slug)}
        <ChevronDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-56">
        <DropdownMenu.RadioGroup value={selected.projectRepositoryId}>
          {repositories.map(candidate => (
            <DropdownMenu.RadioItem
              key={candidate.projectRepositoryId}
              value={candidate.projectRepositoryId}
              closeOnClick
              onClick={() => onSelect(candidate.projectRepositoryId)}
            >
              <span className="flex-1">{candidate.slug}</span>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
