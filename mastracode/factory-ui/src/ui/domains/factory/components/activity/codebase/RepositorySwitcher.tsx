import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronDown } from 'lucide-react';

import type { LinkedRepositoryPayload } from '../../../../workspaces/services/github';

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
      <Txt as="span" variant="caption" tone="muted">
        {selected.slug}
      </Txt>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="sm" aria-label={`Repository: ${selected.slug}`}>
        {selected.slug}
        <ChevronDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-56">
        {repositories.map(candidate => (
          <DropdownMenu.Item
            key={candidate.projectRepositoryId}
            onClick={() => onSelect(candidate.projectRepositoryId)}
          >
            <span className="flex-1">{candidate.slug}</span>
            {candidate.projectRepositoryId === selected.projectRepositoryId ? <Check aria-label="Selected" /> : null}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
