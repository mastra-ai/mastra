import { useCallback, useEffect, useState } from 'react';

/**
 * Server-driven directory picker. The browser can't read absolute filesystem
 * paths, so this browses the server's filesystem via `GET /api/web/fs/list`
 * (confined to the server's configured root). The user navigates into folders
 * and picks one — yielding a real absolute path with no typing.
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

interface DirectoryPickerProps {
  /** Called with the chosen absolute path and its basename. */
  onPick: (path: string, name: string) => void;
  onCancel: () => void;
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function DirectoryPicker({ onPick, onCancel }: DirectoryPickerProps) {
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

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dirpicker-backdrop" onClick={onCancel}>
      <div className="dirpicker" onClick={e => e.stopPropagation()}>
        <div className="dirpicker-header">
          <span className="dirpicker-title">Open project folder</span>
          <button className="dirpicker-close" onClick={onCancel} title="Cancel">
            ×
          </button>
        </div>

        <div className="dirpicker-path" title={listing?.path}>
          {listing?.path ?? '…'}
        </div>

        <div className="dirpicker-list">
          {loading && <div className="dirpicker-empty">Loading…</div>}
          {error && <div className="dirpicker-error">{error}</div>}
          {!loading && !error && listing && (
            <>
              {listing.parent && (
                <button className="dirpicker-entry dirpicker-up" onClick={() => void browse(listing.parent!)}>
                  ⬆ ..
                </button>
              )}
              {listing.entries.length === 0 && <div className="dirpicker-empty">No subfolders</div>}
              {listing.entries.map(entry => (
                <button key={entry.path} className="dirpicker-entry" onClick={() => void browse(entry.path)}>
                  📁 {entry.name}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="dirpicker-actions">
          <button
            className="btn btn-sm btn-primary"
            disabled={!listing}
            onClick={() => listing && onPick(listing.path, basename(listing.path))}
          >
            Use this folder
          </button>
          <button className="btn btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
