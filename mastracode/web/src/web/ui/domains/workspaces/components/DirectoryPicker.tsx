import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import { memo, useReducer, useState } from 'react';

import type { DirectoryListing } from '../../../../../shared/api/types';
import { useDirectoryListing } from '../../../../../shared/hooks/use-fs';
import { SkeletonRows } from '../../../ui/SkeletonRows';

/**
 * Server-driven directory browser. The browser can't read absolute filesystem
 * paths, so this navigates the server's filesystem via `GET /web/fs/list`
 * (confined to the server's configured root). The user drills into folders and
 * picks one — yielding a real absolute path with no typing.
 *
 * This is a body component with no backdrop of its own. It is embedded in the
 * in-layout Factory creation surface rather than opening another overlay.
 */

interface DirectoryBrowserProps {
  /** Called with the chosen absolute path and its basename. */
  onPick: (path: string, name: string) => void;
  /** True while the chosen folder is being resolved (server round-trip). */
  busy?: boolean;
  /** Error from resolving the chosen folder, if any. */
  error?: string | null;
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Split an absolute path into clickable breadcrumb segments. */
function crumbs(path: string): { label: string; path: string }[] {
  const parts = path.split('/').filter(Boolean);
  const out: { label: string; path: string }[] = [{ label: 'root', path: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    out.push({ label: part, path: acc });
  }
  return out;
}

interface NavigationState {
  paths: (string | undefined)[];
  index: number;
}

type NavigationAction = { type: 'browse'; path: string | undefined } | { type: 'back' } | { type: 'forward' };

const initialNavigationState: NavigationState = {
  paths: [undefined],
  index: 0,
};

function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'browse': {
      if (state.paths[state.index] === action.path) return state;
      const paths = [...state.paths.slice(0, state.index + 1), action.path];
      return { paths, index: paths.length - 1 };
    }
    case 'back':
      return state.index === 0 ? state : { ...state, index: state.index - 1 };
    case 'forward':
      return state.index === state.paths.length - 1 ? state : { ...state, index: state.index + 1 };
  }
}

const DirectoryBreadcrumb = memo(function DirectoryBreadcrumb({
  path,
  navigate,
}: {
  path: string;
  navigate: (action: NavigationAction) => void;
}) {
  return (
    <Breadcrumb label="Path">
      {crumbs(path).map((crumb, index, allCrumbs) => {
        const isCurrent = index === allCrumbs.length - 1;
        return (
          <Crumb
            as={isCurrent ? 'span' : 'button'}
            isCurrent={isCurrent}
            {...(isCurrent
              ? { title: crumb.path }
              : {
                  type: 'button',
                  title: crumb.path,
                  onClick: () => navigate({ type: 'browse', path: crumb.path }),
                })}
            key={crumb.path}
          >
            {crumb.label}
          </Crumb>
        );
      })}
    </Breadcrumb>
  );
});

const ENTRY_CLASS =
  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-md text-icon5 transition-colors hover:bg-surface4 focus-visible:outline-hidden focus-visible:bg-surface4 disabled:cursor-default disabled:opacity-50';

interface DirectoryEntriesProps {
  entries: DirectoryListing['entries'];
  busy: boolean;
  navigating: boolean;
  navigate: (action: NavigationAction) => void;
}

function DirectoryEntries({ entries, busy, navigating, navigate }: DirectoryEntriesProps) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleEntries =
    normalizedSearch === ''
      ? entries
      : entries.filter(entry => entry.name.toLocaleLowerCase().includes(normalizedSearch));

  return (
    <>
      {entries.length > 0 && (
        <ListSearch
          label="Search folders"
          placeholder="Search folders…"
          size="sm"
          debounceMs={0}
          onSearch={setSearch}
        />
      )}
      <ScrollArea className="min-h-0 flex-1">
        {entries.length === 0 && (
          <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-icon3">
            No subfolders here
          </Txt>
        )}
        {entries.length > 0 && visibleEntries.length === 0 && (
          <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-icon3">
            No matching folders
          </Txt>
        )}
        {visibleEntries.map(entry => (
          <button
            key={entry.path}
            type="button"
            className={ENTRY_CLASS}
            disabled={busy || navigating}
            onClick={() => navigate({ type: 'browse', path: entry.path })}
            title={`Open ${entry.name}`}
          >
            <Folder size={15} className="text-accent1" />
            <span className="truncate">{entry.name}</span>
          </button>
        ))}
      </ScrollArea>
    </>
  );
}

export function DirectoryBrowser({ onPick, busy = false, error: pickError = null }: DirectoryBrowserProps) {
  const [navigation, navigate] = useReducer(navigationReducer, initialNavigationState);
  const path = navigation.paths[navigation.index];
  const listingQuery = useDirectoryListing(path);

  const listing = listingQuery.data ?? null;
  const loading = listingQuery.isPending;
  const navigating = listingQuery.isPlaceholderData;
  const error = listingQuery.error instanceof Error ? listingQuery.error.message : null;
  const canGoBack = navigation.index > 0;
  const canGoForward = navigation.index < navigation.paths.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <div role="group" aria-label="Folder history" className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="xs"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={() => navigate({ type: 'back' })}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Forward"
            disabled={!canGoForward}
            onClick={() => navigate({ type: 'forward' })}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          {listing && <DirectoryBreadcrumb path={listing.path} navigate={navigate} />}
        </div>
        <Button
          variant="primary"
          size="sm"
          className="shrink-0"
          disabled={!listing || busy || navigating}
          onClick={() => listing && onPick(listing.path, basename(listing.path))}
        >
          {busy ? 'Adding…' : 'Use this folder'}
        </Button>
      </div>

      {loading && (
        <ScrollArea className="min-h-0 flex-1">
          <SkeletonRows label="Loading folders" rows={4} rowClassName="h-7 w-full" />
        </ScrollArea>
      )}
      {error && (
        <ScrollArea className="min-h-0 flex-1">
          <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-notice-destructive-fg">
            {error}
          </Txt>
        </ScrollArea>
      )}
      {!loading && !error && listing && (
        <DirectoryEntries
          key={listing.path}
          entries={listing.entries}
          busy={busy}
          navigating={navigating}
          navigate={navigate}
        />
      )}

      {pickError && (
        <Txt as="div" variant="ui-sm" className="text-notice-destructive-fg">
          {pickError}
        </Txt>
      )}
    </div>
  );
}
