import type { QueryKey } from '@tanstack/react-query';

/** A saved view as the backend stores it. The page's schema checks `state` when it is read. */
export type SavedViewRecord = {
  id: string;
  name: string;
  state: unknown;
};

export type SavedViewRecordInput = Omit<SavedViewRecord, 'id'>;

/**
 * Where saved views live. Every call is async and runs through React Query, so a backend can be
 * browser storage, the Mastra server or any other API. A rejected call's `Error.message` is shown to
 * the user, so throw errors written for people.
 */
export type SavedViewsBackend = {
  /** React Query key of the list. Unique per backend and per page. */
  queryKey: QueryKey;
  list: () => Promise<SavedViewRecord[]>;
  create: (input: SavedViewRecordInput) => Promise<SavedViewRecord>;
  update: (viewId: string, patch: Partial<SavedViewRecordInput>) => Promise<SavedViewRecord>;
  remove: (viewId: string) => Promise<void>;
  /** Calls `onChange` when views change outside this page (another tab), so the list refetches. */
  subscribe?: (onChange: () => void) => () => void;
};

const STORAGE_VERSION = 2;
const STORAGE_ERROR = 'Could not save changes. Check your browser storage settings and try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Version 1 stored a flat `filters` list beside `settings`; both read back as one `state`.
function readStoredView(candidate: unknown, version: number): SavedViewRecord | undefined {
  if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return undefined;
  const state =
    version === 1
      ? { filters: candidate.filters, ...(isRecord(candidate.settings) ? candidate.settings : {}) }
      : candidate.state;
  return { id: candidate.id, name: candidate.name, state };
}

function readStoredViews(storageKey: string): SavedViewRecord[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return [];
  }
  if (!raw) return [];
  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(document) || !Array.isArray(document.views)) return [];
  const { version, views } = document;
  if (version !== 1 && version !== STORAGE_VERSION) return [];
  return views.flatMap(candidate => readStoredView(candidate, version) ?? []);
}

function writeStoredViews(storageKey: string, views: SavedViewRecord[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ version: STORAGE_VERSION, views }));
  } catch {
    throw new Error(STORAGE_ERROR);
  }
}

function createViewId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const localBackends = new Map<string, SavedViewsBackend>();

/**
 * Keeps saved views in this browser's localStorage under `storageKey`. Views written by an earlier
 * version of this kit (a flat `filters` list beside `settings`) still load, as one `state`.
 */
export function localStorageSavedViewsBackend(storageKey: string): SavedViewsBackend {
  const cached = localBackends.get(storageKey);
  if (cached) return cached;

  const backend: SavedViewsBackend = {
    queryKey: ['saved-views', 'local-storage', storageKey],
    list: async () => readStoredViews(storageKey),
    create: async input => {
      const view: SavedViewRecord = { id: createViewId(), ...input };
      writeStoredViews(storageKey, [...readStoredViews(storageKey), view]);
      return view;
    },
    update: async (viewId, patch) => {
      const views = readStoredViews(storageKey);
      const existing = views.find(view => view.id === viewId);
      if (!existing) throw new Error('This view no longer exists.');
      const updated = { ...existing, ...patch };
      writeStoredViews(
        storageKey,
        views.map(view => (view.id === viewId ? updated : view)),
      );
      return updated;
    },
    remove: async viewId => {
      writeStoredViews(
        storageKey,
        readStoredViews(storageKey).filter(view => view.id !== viewId),
      );
    },
    subscribe: onChange => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey || event.key === null) onChange();
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
  localBackends.set(storageKey, backend);
  return backend;
}
