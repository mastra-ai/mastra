import { useCallback, useEffect, useState } from 'react';

import { ArrowDownIcon, FolderIcon } from './icons';

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

interface DirectoryEntry {
  name: string;
  path: string;
}

interface DirectoryListing {
  root: string;
  path: string;
  parent: string | null;
  entries: DirectoryEntry[];
}

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

export function DirectoryBrowser({ onPick, onCancel, busy = false, error: pickError = null }: DirectoryBrowserProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = path ? `/api/web/fs/list?path=${encodeURIComponent(path)}` : '/api/web/fs/list';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to list directory (${res.status})`);
      const data = (await res.json()) as DirectoryListing;
      setListing(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void browse();
  }, [browse]);

  return (
    <div className="dirbrowser">
      {listing && (
        <nav className="dirbrowser-crumbs" aria-label="Path">
          {crumbs(listing.path).map((c, i, arr) => (
            <span key={c.path} className="dirbrowser-crumb-wrap">
              <button
                type="button"
                className="dirbrowser-crumb"
                disabled={i === arr.length - 1}
                onClick={() => void browse(c.path)}
                title={c.path}
              >
                {c.label}
              </button>
              {i < arr.length - 1 && <span className="dirbrowser-crumb-sep">/</span>}
            </span>
          ))}
        </nav>
      )}

      <div className="dirbrowser-list">
        {loading && <div className="dirbrowser-msg">Loading…</div>}
        {error && <div className="dirbrowser-msg dirbrowser-err">{error}</div>}
        {!loading && !error && listing && (
          <>
            {listing.parent && (
              <button
                type="button"
                className="dirbrowser-entry dirbrowser-up"
                onClick={() => void browse(listing.parent!)}
              >
                <ArrowDownIcon size={14} className="dirbrowser-up-icon" />
                <span>Up a level</span>
              </button>
            )}
            {listing.entries.length === 0 && <div className="dirbrowser-msg">No subfolders here</div>}
            {listing.entries.map(entry => (
              <button
                key={entry.path}
                type="button"
                className="dirbrowser-entry"
                onDoubleClick={() => onPick(entry.path, basename(entry.path))}
                onClick={() => void browse(entry.path)}
                title={`Open ${entry.name} (double-click to use)`}
              >
                <FolderIcon size={15} className="dirbrowser-folder" />
                <span className="dirbrowser-name">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {pickError && <div className="dirbrowser-msg dirbrowser-err">{pickError}</div>}

      <div className="dirbrowser-actions">
        <span className="dirbrowser-hint">Double-click a folder to use it, or pick the one you're in.</span>
        <div className="dirbrowser-buttons">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={!listing || busy}
            onClick={() => listing && onPick(listing.path, basename(listing.path))}
          >
            {busy ? 'Adding…' : 'Use this folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
