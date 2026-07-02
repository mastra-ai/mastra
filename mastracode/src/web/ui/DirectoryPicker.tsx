import { Breadcrumb, Button, Crumb, Txt } from '@mastra/playground-ui';
import { ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import { useState } from 'react';

import { useDirectoryListing } from '../../shared/hooks/use-fs';

/**
 * Server-driven directory browser. The browser can't read absolute filesystem
 * paths, so this navigates the server's filesystem via `GET /api/web/fs/list`
 * (confined to the server's configured root). The user drills into folders and
 * picks one — yielding a real absolute path with no typing.
 *
 * This is a *body* component with no backdrop of its own: it can be embedded
 * inline on the landing page or inside a host dialog.
 */

interface DirectoryBrowserProps {
  /** Called with the chosen absolute path and its basename. */
  onPick: (path: string, name: string) => void;
  onCancel?: () => void;
  /** True while the chosen folder is being resolved (server round-trip). */
  busy?: boolean;
  /** Error from resolving the chosen folder, if any. */
  error?: string | null;
  layout?: 'dialog' | 'page';
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

const ENTRY_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-md text-icon5 transition-colors hover:bg-surface4 focus-visible:outline-hidden focus-visible:bg-surface4 disabled:opacity-50';
const PAGE_ENTRY_CLASS =
  'flex min-h-10 w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left text-ui-md text-icon5 transition-colors hover:bg-surface3 focus-visible:border-border1 focus-visible:bg-surface3 focus-visible:outline-hidden disabled:opacity-50';

export function DirectoryBrowser({
  onPick,
  onCancel,
  busy = false,
  error: pickError = null,
  layout = 'dialog',
}: DirectoryBrowserProps) {
  // `undefined` lists the server root; explicit paths drill into subfolders.
  // React Query owns the fetch + per-path cache, while local history gives
  // the picker lightweight browser-style back/forward movement.
  const [history, setHistory] = useState<Array<string | undefined>>([undefined]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const path = history[historyIndex];
  const listingQuery = useDirectoryListing(path);

  const listing = listingQuery.data ?? null;
  const loading = listingQuery.isPending;
  const transitioning = listingQuery.isPlaceholderData;
  const fetching = listingQuery.isFetching && !loading;
  const error = listingQuery.error instanceof Error ? listingQuery.error.message : null;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const browse = (next?: string) => {
    if (next === path) return;
    setHistory(current => [...current.slice(0, historyIndex + 1), next]);
    setHistoryIndex(historyIndex + 1);
  };
  const goBack = () => setHistoryIndex(current => Math.max(0, current - 1));
  const goForward = () => setHistoryIndex(current => Math.min(history.length - 1, current + 1));
  const pageLayout = layout === 'page';

  const navigationButtons = (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Go back"
        tooltip="Go back"
        disabled={!canGoBack}
        onClick={goBack}
      >
        <ChevronLeft size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Go forward"
        tooltip="Go forward"
        disabled={!canGoForward}
        onClick={goForward}
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );

  const breadcrumb = listing ? (
    <Breadcrumb label="Path" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0 overflow-hidden">
      {crumbs(listing.path).map((c, i, arr) => {
        const isCurrent = i === arr.length - 1;
        return isCurrent ? (
          <Crumb key={c.path} as="span" isCurrent title={c.path}>
            {c.label}
          </Crumb>
        ) : (
          <Crumb
            key={c.path}
            as="button"
            isCurrent={false}
            type="button"
            title={c.path}
            onClick={() => void browse(c.path)}
          >
            {c.label}
          </Crumb>
        );
      })}
    </Breadcrumb>
  ) : (
    <Txt as="div" variant="ui-sm" className="text-icon3">
      Loading path…
    </Txt>
  );
  const pathControls = (
    <div className="flex min-w-0 items-center gap-1.5">
      {navigationButtons}
      {breadcrumb}
      {fetching && (
        <Txt as="span" variant="ui-xs" className="hidden shrink-0 text-icon3 sm:inline">
          Loading…
        </Txt>
      )}
    </div>
  );

  const pickButton = (
    <Button
      variant="primary"
      size="sm"
      disabled={!listing || busy || transitioning}
      onClick={() => listing && onPick(listing.path, basename(listing.path))}
    >
      {busy ? 'Adding…' : 'Use this folder'}
    </Button>
  );

  const listContent = (
    <>
      {loading && (
        <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-icon3">
          Loading…
        </Txt>
      )}
      {error && (
        <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-notice-destructive-fg">
          {error}
        </Txt>
      )}
      {!loading && !error && listing && (
        <>
          {listing.entries.length === 0 && (
            <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-icon3">
              No subfolders here
            </Txt>
          )}
          {listing.entries.map(entry => (
            <button
              key={entry.path}
              type="button"
              className={pageLayout ? PAGE_ENTRY_CLASS : ENTRY_CLASS}
              disabled={transitioning}
              onClick={() => void browse(entry.path)}
              title={`Open ${entry.name}`}
            >
              <Folder size={15} className="shrink-0 text-accent1" />
              <span className="truncate">{entry.name}</span>
            </button>
          ))}
        </>
      )}
    </>
  );

  const pickErrorElement = pickError ? (
    <Txt as="div" variant="ui-sm" className="text-notice-destructive-fg">
      {pickError}
    </Txt>
  ) : null;

  if (pageLayout) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 border-b border-border1 bg-surface1/95 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 overflow-hidden">{pathControls}</div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
                  Cancel
                </Button>
              )}
              {pickButton}
            </div>
          </div>
          {pickErrorElement && <div className="pt-2">{pickErrorElement}</div>}
        </div>

        <div className="flex flex-col gap-0.5 py-2" aria-busy={loading || transitioning}>
          {listContent}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pathControls}

      <div
        className="flex max-h-72 min-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border1 bg-surface-overlay-soft p-1.5"
        aria-busy={loading || transitioning}
      >
        {listContent}
      </div>

      {pickErrorElement}

      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          {pickButton}
        </div>
      </div>
    </div>
  );
}
