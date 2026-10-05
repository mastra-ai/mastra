import { useWorkspaceSearch } from '@mastra/react/hooks';
import { XIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useWorkspaceContext } from './use-workspace-context';
import { WorkspaceError } from './workspace-error';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Input } from '@/ds/components/Input';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { FileIcon, Icon, SearchIcon, SkillIcon } from '@/ds/icons';
import { cn } from '@/lib/utils';

/** Icon button that swaps the tree for the search panel, like VS Code's search view. */
export function WorkspaceSearchToggle() {
  const { isSearching, setSearching, searchFiles, searchSkills } = useWorkspaceContext();
  if (!searchFiles && !searchSkills) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      tooltip="Search files and skills"
      aria-pressed={isSearching}
      onClick={() => setSearching(!isSearching)}
    >
      <SearchIcon />
    </Button>
  );
}

/** The search input while searching, the aside title otherwise. */
export function WorkspaceSearch() {
  const { isSearching } = useWorkspaceContext();
  return isSearching ? <SearchInput /> : <AsideTitle />;
}

const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function AsideTitle() {
  const { fileCount, skillCount } = useWorkspaceContext();
  return (
    <Txt as="span" variant="label" tone="muted" className="block min-w-0 truncate">
      <span>{fileCount === undefined ? 'Files' : countLabel(fileCount, 'File')}</span>
      {skillCount === undefined ? null : (
        <>
          <Txt as="span" variant="label" tone="faint" aria-hidden className="mx-1.5">
            ·
          </Txt>
          <span>{countLabel(skillCount, 'Skill')}</span>
        </>
      )}
    </Txt>
  );
}

// Mounted only while searching, so reopening the search starts from an empty input.
function SearchInput() {
  const { setSearching, setQuery } = useWorkspaceContext();
  const [value, setValue] = useState('');
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <Input
        type="search"
        size="sm"
        autoFocus
        aria-label="Search query"
        placeholder="Search files and skills"
        value={value}
        onChange={event => {
          const next = event.target.value;
          setValue(next);
          startTransition(() => setQuery(next));
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') setSearching(false);
        }}
      />
      <Button variant="ghost" size="icon-sm" tooltip="Close search" onClick={() => setSearching(false)}>
        <XIcon />
      </Button>
    </div>
  );
}

export function WorkspaceSearchResults() {
  const { workspaceId, query, activeFilePath, setActiveFilePath, searchFiles, searchSkills } = useWorkspaceContext();
  const { data, isLoading, isError, error } = useWorkspaceSearch({
    workspaceId: workspaceId,
    query: query,
    files: searchFiles,
    skills: searchSkills,
    queryOptions: { enabled: query.trim().length > 0 && (searchFiles || searchSkills) },
  });

  if (!query.trim()) {
    return <EmptyState titleSlot="Search files and skills" descriptionSlot="Type to find matching content." />;
  }
  if (isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 p-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (isError) return <WorkspaceError error={error} fallback="Search failed." className="m-2" />;
  if (!data?.length) return <EmptyState titleSlot="No results" />;

  return (
    <ul aria-label="Search results" className="flex flex-col py-1">
      {data.map(hit => (
        <li key={hit.path}>
          <button
            type="button"
            title={hit.path}
            onClick={() => setActiveFilePath(hit.path)}
            className={cn(
              'text-foreground',
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-fill-subtle',
              activeFilePath === hit.path && 'bg-fill',
            )}
          >
            <Icon size="sm">{hit.kind === 'skill' ? <SkillIcon /> : <FileIcon />}</Icon>
            <Txt as="span" variant="body-sm" className="truncate">
              {hit.label}
            </Txt>
          </button>
        </li>
      ))}
    </ul>
  );
}
