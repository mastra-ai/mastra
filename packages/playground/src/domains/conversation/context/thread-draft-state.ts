import type { SetStateAction } from 'react';
import {
  clearUserThreadDrafts,
  DraftLimitError,
  getDraftUserScope,
  readThreadDraft,
  moveThreadDraft,
  writeThreadDraft,
} from './thread-draft-storage';
import type { ThreadDraft } from './thread-draft-storage';

export interface DraftStatus {
  restoring: boolean;
  saving: boolean;
  error?: string;
}
interface Snapshot {
  draft: ThreadDraft;
  status: DraftStatus;
}
const EMPTY_DRAFT: ThreadDraft = { text: '', attachments: [] };
const logoutListeners = new Set<(scope: string) => void>();

export function clearDraftsOnLogout(scope: string) {
  logoutListeners.forEach(listener => listener(scope));
  return clearUserThreadDrafts(scope);
}

export function createThreadDraftState(initialKey?: string) {
  let storageKey = initialKey;
  let snapshot: Snapshot = { draft: EMPTY_DRAFT, status: { restoring: initialKey !== undefined, saving: false } };
  let loading: Promise<void> | undefined;
  let stopped = false;
  let dirty = false;
  let revision = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
  const waiting: SetStateAction<ThreadDraft>[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const cancelTimers = () => {
    clearTimeout(debounceTimer);
    clearTimeout(maxWaitTimer);
    debounceTimer = maxWaitTimer = undefined;
  };
  const save = (operation: Promise<void>) => {
    const savingRevision = ++revision;
    snapshot = { ...snapshot, status: { ...snapshot.status, saving: true } };
    notify();
    const finish = (error?: string) => {
      if (stopped || revision !== savingRevision) return;
      snapshot = { ...snapshot, status: { restoring: false, saving: dirty, error } };
      notify();
    };
    return operation.then(
      () => finish(),
      error => finish(error instanceof DraftLimitError ? error.message : 'Draft could not be saved locally.'),
    );
  };
  const flush = () => {
    cancelTimers();
    if (!dirty || stopped || storageKey === undefined) return;
    dirty = false;
    void save(writeThreadDraft(storageKey, snapshot.draft));
  };
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  const forget = (scope: string) => {
    if (storageKey === undefined || getDraftUserScope(storageKey) !== scope) return;
    stopped = true;
    dirty = false;
    waiting.length = 0;
    cancelTimers();
    snapshot = { draft: EMPTY_DRAFT, status: { restoring: false, saving: false } };
    notify();
  };
  const updateDraft = (value: SetStateAction<ThreadDraft>) => {
    if (stopped) return;
    if (snapshot.status.restoring) {
      waiting.push(value);
      return;
    }
    const previous = snapshot.draft;
    const next = typeof value === 'function' ? value(previous) : value;
    if (next.text === previous.text && next.attachments === previous.attachments) return;
    dirty = storageKey !== undefined;
    snapshot = { draft: next, status: { ...snapshot.status, saving: dirty } };
    notify();
    if (!dirty) return;
    // File changes and submission clears should not wait for the typing debounce.
    if (!next.text || next.attachments !== previous.attachments || listeners.size === 0) {
      flush();
    } else {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, 300);
      maxWaitTimer ??= setTimeout(flush, 1000);
    }
  };
  const load = async () => {
    if (storageKey === undefined) return;
    try {
      const draft = await readThreadDraft(storageKey);
      if (stopped) return;
      snapshot = { draft, status: { restoring: false, saving: false } };
    } catch {
      if (stopped) return;
      snapshot = {
        ...snapshot,
        status: { restoring: false, saving: false, error: 'Draft could not be restored locally.' },
      };
    }
    notify();
    waiting.splice(0).forEach(updateDraft);
  };
  return {
    updateDraft,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        logoutListeners.add(forget);
        if (storageKey !== undefined && typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', flushWhenHidden);
          window.addEventListener('pagehide', flush);
        }
      }
      loading ??= load();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          flush();
          logoutListeners.delete(forget);
          if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', flushWhenHidden);
            window.removeEventListener('pagehide', flush);
          }
        }
      };
    },
    async move(to: string) {
      if (snapshot.status.restoring) await loading;
      if (stopped || storageKey === undefined || storageKey === to) return;
      cancelTimers();
      dirty = false;
      const from = storageKey;
      storageKey = to;
      // Enqueue the move before returning so a new controller restores after it.
      await save(moveThreadDraft(from, to, snapshot.draft));
    },
  };
}
