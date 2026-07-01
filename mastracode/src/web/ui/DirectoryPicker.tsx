import { Button, Txt } from '@mastra/playground-ui';
import { ArrowUp, Folder } from 'lucide-react';
import { useState } from 'react';

import { useDirectoryListing } from '../../shared/hooks/use-fs';

/**
 * Server-driven directory browser. The browser can't read absolute filesystem
 * paths, so this navigates the server's filesystem via `GET /api/web/fs/list`
 * (confined to the server's configured root). The user drills into folders and
 * picks one — yielding a real absolute path with no typing.
 *
 * This is a *body* component with no backdrop of its own: it's embedded inside
 * a host modal (see ProjectsModal) so project selection is a first-class,
 * centered flow rather than a sidebar popover.
 */

interface DirectoryBrowserProps {
  /** Called with the chosen absolute path and its basename. */
  onPick: (path: string, name: string) => void;
  onCancel: () => void;
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
  const out: { label: string; path: string }[] = [{ label: '/', path: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    out.push({ label: part, path: acc });
  }
  return out;
}

const ENTRY_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui-md text-icon5 transition-colors hover:bg-surface4 focus-visible:outline-hidden focus-visible:bg-surface4 disabled:opacity-50';

export function DirectoryBrowser({ onPick, onCancel, busy = false, error: pickError = null }: DirectoryBrowserProps) {
  // `undefined` lists the server root; explicit paths drill into subfolders.
  // React Query owns the fetch + per-path cache, so navigation is just state.
  const [path, setPath] = useState<string | undefined>(undefined);
  const listingQuery = useDirectoryListing(path);

  const listing = listingQuery.data ?? null;
  const loading = listingQuery.isPending;
  const error = listingQuery.error instanceof Error ? listingQuery.error.message : null;

  const browse = (next?: string) => setPath(next);

  return (
    <div className="flex flex-col gap-3">
      {listing && (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Path">
          {crumbs(listing.path).map((c, i, arr) => (
            <span key={c.path} className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-sm px-1 text-ui-sm text-icon3 transition-colors hover:text-icon5 disabled:cursor-default disabled:text-icon5"
                disabled={i === arr.length - 1}
                onClick={() => void browse(c.path)}
                title={c.path}
              >
                {c.label}
              </button>
              {i < arr.length - 1 && (
                <Txt as="span" variant="ui-sm" className="text-icon2">
                  /
                </Txt>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex max-h-72 min-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border1 bg-surface-overlay-soft p-1.5">
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
            {listing.parent && (
              <button type="button" className={ENTRY_CLASS} onClick={() => void browse(listing.parent!)}>
                <ArrowUp size={14} className="text-icon3" />
                <span>Up a level</span>
              </button>
            )}
            {listing.entries.length === 0 && (
              <Txt as="div" variant="ui-sm" className="px-2 py-1.5 text-icon3">
                No subfolders here
              </Txt>
            )}
            {listing.entries.map(entry => (
              <button
                key={entry.path}
                type="button"
                className={ENTRY_CLASS}
                onDoubleClick={() => onPick(entry.path, basename(entry.path))}
                onClick={() => void browse(entry.path)}
                title={`Open ${entry.name} (double-click to use)`}
              >
                <Folder size={15} className="text-accent1" />
                <span className="truncate">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {pickError && (
        <Txt as="div" variant="ui-sm" className="text-notice-destructive-fg">
          {pickError}
        </Txt>
      )}

      <div className="flex items-center justify-between gap-3">
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Double-click a folder to use it, or pick the one you're in.
        </Txt>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!listing || busy}
            onClick={() => listing && onPick(listing.path, basename(listing.path))}
          >
            {busy ? 'Adding…' : 'Use this folder'}
          </Button>
        </div>
      </div>
    </div>
  );
}
