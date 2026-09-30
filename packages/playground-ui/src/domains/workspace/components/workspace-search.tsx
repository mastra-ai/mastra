import { useEffect, useState } from 'react';
import { useWorkspaceSearch } from '../hooks/use-workspace-search';
import { useWorkspaceContext } from './use-workspace-context';
import { EmptyState } from '@/ds/components/EmptyState';
import { Input } from '@/ds/components/Input';
import { Skeleton } from '@/ds/components/Skeleton';
import { FileIcon, Icon, SkillIcon } from '@/ds/icons';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;

export function WorkspaceSearch() {
  const { setQuery } = useWorkspaceContext();
  const [value, setValue] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [value, setQuery]);

  return (
    <Input
      type="search"
      size="sm"
      aria-label="Search files and skills"
      placeholder="Search files and skills"
      value={value}
      onChange={event => setValue(event.target.value)}
    />
  );
}

export function WorkspaceSearchResults() {
  const { workspaceId, query, activeFilePath, setActiveFilePath } = useWorkspaceContext();
  const { data, isLoading, isError } = useWorkspaceSearch(workspaceId, query);

  if (isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 p-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (isError) return <EmptyState tone="error" titleSlot="Search failed" />;
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
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-body-sm text-muted-foreground hover:bg-fill-subtle',
              activeFilePath === hit.path && 'bg-fill text-foreground',
            )}
          >
            <Icon size="sm">{hit.kind === 'skill' ? <SkillIcon /> : <FileIcon />}</Icon>
            <span className="truncate">{hit.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
