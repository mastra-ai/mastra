import { useCallback, useSyncExternalStore } from 'react';

/**
 * Simple in-memory buffer store for the editor. Holds open tabs and their
 * dirty state; the actual file content lives in React Query. The store is
 * intentionally minimal — v1 keeps everything ephemeral so a page reload
 * starts clean.
 */

export interface EditorBuffer {
  /** Workspace-relative posix path. */
  path: string;
  /** Content the user has been editing (undefined until first edit). */
  draft: string | undefined;
  /** True when the draft differs from the server-side snapshot. */
  dirty: boolean;
  /**
   * The disk content the draft is based on. Fixed when the buffer is seeded
   * and rebased on save/resolve — if the file on disk stops matching this
   * while the buffer is dirty, someone else (usually the agent) edited it.
   */
  baseline: string | undefined;
}

interface EditorBuffersState {
  openPaths: string[];
  activePath: string | null;
  buffers: Record<string, EditorBuffer>;
  /** Optional pending "attach to next send" selection payload. */
  pendingSelection: PendingSelection | null;
}

export interface PendingSelection {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

const initialState: EditorBuffersState = {
  openPaths: [],
  activePath: null,
  buffers: {},
  pendingSelection: null,
};

let state = initialState;
const listeners = new Set<() => void>();

function set(next: EditorBuffersState) {
  state = next;
  listeners.forEach(l => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot() {
  return state;
}

export function useEditorBuffers() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function openBuffer(path: string) {
  const openPaths = state.openPaths.includes(path) ? state.openPaths : [...state.openPaths, path];
  set({
    ...state,
    openPaths,
    activePath: path,
    buffers: state.buffers[path]
      ? state.buffers
      : { ...state.buffers, [path]: { path, draft: undefined, dirty: false, baseline: undefined } },
  });
}

export function closeBuffer(path: string) {
  const openPaths = state.openPaths.filter(p => p !== path);
  let activePath = state.activePath;
  if (activePath === path) {
    activePath = openPaths[openPaths.length - 1] ?? null;
  }
  const { [path]: _closed, ...rest } = state.buffers;
  void _closed;
  set({ ...state, openPaths, activePath, buffers: rest });
}

export function setActiveBuffer(path: string) {
  if (!state.openPaths.includes(path)) return;
  set({ ...state, activePath: path });
}

export function updateBufferDraft(path: string, draft: string, baseline: string) {
  const existing = state.buffers[path];
  if (!existing) return;
  // Once seeded, the stored baseline wins — live server refetches must not
  // silently rebase a dirty draft (that would defeat drift detection).
  const base = existing.baseline ?? baseline;
  const dirty = draft !== base;
  set({
    ...state,
    buffers: { ...state.buffers, [path]: { ...existing, draft, dirty, baseline: base } },
  });
}

export function markBufferClean(path: string) {
  const existing = state.buffers[path];
  if (!existing) return;
  set({
    ...state,
    buffers: { ...state.buffers, [path]: { ...existing, dirty: false, baseline: existing.draft } },
  });
}

/** Replace the draft wholesale (e.g. "take theirs" after disk drift). */
export function replaceBufferDraft(path: string, content: string) {
  const existing = state.buffers[path];
  if (!existing) return;
  set({
    ...state,
    buffers: { ...state.buffers, [path]: { ...existing, draft: content, dirty: false, baseline: content } },
  });
}

/** Rebase the baseline without touching the draft (e.g. "keep mine"). */
export function rebaseBuffer(path: string, baseline: string) {
  const existing = state.buffers[path];
  if (!existing) return;
  const dirty = existing.draft !== undefined && existing.draft !== baseline;
  set({
    ...state,
    buffers: { ...state.buffers, [path]: { ...existing, dirty, baseline } },
  });
}

export function setPendingSelection(payload: PendingSelection | null) {
  set({ ...state, pendingSelection: payload });
}

export function useEditorBufferActions() {
  return {
    open: useCallback((path: string) => openBuffer(path), []),
    close: useCallback((path: string) => closeBuffer(path), []),
    setActive: useCallback((path: string) => setActiveBuffer(path), []),
    updateDraft: useCallback((path: string, draft: string, baseline: string) => updateBufferDraft(path, draft, baseline), []),
    markClean: useCallback((path: string) => markBufferClean(path), []),
    replaceDraft: useCallback((path: string, content: string) => replaceBufferDraft(path, content), []),
    rebase: useCallback((path: string, baseline: string) => rebaseBuffer(path, baseline), []),
    setSelection: useCallback((payload: PendingSelection | null) => setPendingSelection(payload), []),
  };
}
