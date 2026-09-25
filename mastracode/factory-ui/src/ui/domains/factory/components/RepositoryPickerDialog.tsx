import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useState } from 'react';

import { GitLabIcon } from '../../../ui/icons';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';

export function RepositoryPickerDialog({
  repositories,
  onClose,
  onSelect,
}: {
  repositories: LinkedRepositoryPayload[];
  onClose: () => void;
  onSelect: (repository: LinkedRepositoryPayload) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRepositories = normalizedQuery
    ? repositories.filter(repository => repository.slug.toLowerCase().includes(normalizedQuery))
    : repositories;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent aria-label="Choose repository">
        <DialogHeader>
          <DialogTitle>Choose a repository</DialogTitle>
          <DialogDescription>Choose a linked repository for this task.</DialogDescription>
        </DialogHeader>
        <DialogBody className="min-w-0">
          <div className="px-4 py-2">
            <ListSearch
              label="Search repositories"
              placeholder="Search…"
              size="sm"
              onSearch={setQuery}
              debounceMs={0}
              shortcutDisabled
            />
          </div>
          <ScrollArea orientation="vertical" maxHeight="20rem">
            <div className="flex min-w-0 flex-col gap-px p-2">
              {visibleRepositories.map(repository => (
                <button
                  type="button"
                  key={repository.projectRepositoryId}
                  className="hover:bg-surface-overlay-soft focus-visible:outline-accent1 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  title={repository.slug}
                  onClick={() => onSelect(repository)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-body text-foreground flex items-center gap-1.5">
                      {repository.provider === 'gitlab' ? (
                        <GitLabIcon className="text-muted-foreground size-3.5 shrink-0" />
                      ) : (
                        <GithubIcon className="text-muted-foreground size-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 truncate">{repository.slug}</span>
                    </span>
                    {repository.gitBranch && (
                      <span className="text-caption text-muted-foreground block truncate">
                        Default branch: {repository.gitBranch}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {visibleRepositories.length === 0 && (
                <Txt as="p" variant="caption" className="text-muted-foreground px-2 py-2">
                  {repositories.length === 0 ? 'No linked repositories' : 'No matching repositories'}
                </Txt>
              )}
            </div>
          </ScrollArea>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
