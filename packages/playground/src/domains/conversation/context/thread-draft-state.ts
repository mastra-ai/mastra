import type { SetStateAction } from 'react';
import {
  clearUserThreadDrafts,
  CorruptedDraftError,
  discardCorruptedThreadDraft,
  DraftConflictError,
  DraftLimitError,
  DraftSignedOutError,
  getDraftUserScope,
  loadThreadDraft,
  moveThreadDraft,
  writeThreadDraft,
} from './thread-draft-storage';
import type { ThreadDraft } from './thread-draft-storage';
import { resolveThreadInputKey } from './thread-input-context';

export interface DraftStatus {
  restoring: boolean;
  saving: boolean;
  error?: string;
  canDiscard?: boolean;
}
interface Snapshot {
  drafts: Map<PropertyKey, ThreadDraft>;
  status: DraftStatus;
}
interface DraftState {
  getDraft: (key: PropertyKey) => ThreadDraft;
  updateDraft: (key: PropertyKey, value: SetStateAction<ThreadDraft>) => void;
  getSnapshot: () => Snapshot;
  subscribe: (listener: () => void) => () => void;
  move: (to: string) => Promise<void>;
  discardUnreadable: () => Promise<void>;
  signedOut: (version: string) => void;
}
const EMPTY_DRAFT: ThreadDraft = { text: '', attachments: [] };
const PERSISTED = Symbol('persisted-draft');
// Keep mounted, pending, and unsaved drafts so navigation cannot discard edits after a storage failure.
const activeDrafts = new Map<string, DraftState>();
let signoutChannel: BroadcastChannel | undefined;
const forgetUserDrafts = (scope: string, version: string) => {
  for (const [key, state] of activeDrafts) {
    if (getDraftUserScope(key) === scope) state.signedOut(version);
  }
};
function listenForSignouts() {
  if (signoutChannel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    signoutChannel = new BroadcastChannel('mastra-composer-signouts');
  } catch {
    // The IndexedDB sign-out version still fences stale writes if notifications are blocked.
    return;
  }
  signoutChannel.onmessage = ({ data }) => {
    if (data && typeof data.scope === 'string' && typeof data.version === 'string') {
      forgetUserDrafts(data.scope, data.version);
    }
  };
}
export async function clearDraftsOnLogout(scope: string) {
  const version = await clearUserThreadDrafts(scope);
  forgetUserDrafts(scope, version);
  listenForSignouts();
  signoutChannel?.postMessage({ scope, version });
}

function createState(initialKey?: string): DraftState {
  let storageKey = initialKey;
  let snapshot: Snapshot = { drafts: new Map(), status: { restoring: initialKey !== undefined, saving: false } };
  let started = false;
  let restorationFailed = false;
  let unreadableKey: string | undefined;
  let loading = Promise.resolve();
  let revision = 0;
  let storedRevision: string | undefined;
  let logoutVersion: string | undefined;
  let forgotten = false;
  let handoffFrom: string | undefined;
  let writes: Promise<unknown> = Promise.resolve();
  let queuedSave: { target: string; draft: ThreadDraft } | undefined;
  const waiting: (() => void)[] = [];
  const listeners = new Set<() => void>();
  const release = () =>
    queueMicrotask(() => {
      if (
        storageKey !== undefined &&
        listeners.size === 0 &&
        !snapshot.status.saving &&
        !snapshot.status.restoring &&
        !snapshot.status.error &&
        activeDrafts.get(storageKey) === state
      ) {
        activeDrafts.delete(storageKey);
      }
    });
  const notify = () => listeners.forEach(listener => listener());
  const setStatus = (status: DraftStatus) => {
    snapshot = { ...snapshot, status };
    notify();
    release();
  };
  const getDraft = (key: PropertyKey) => snapshot.drafts.get(key) ?? EMPTY_DRAFT;
  const persist = async (key: string, draft: ThreadDraft) => {
    if (handoffFrom !== undefined) {
      storedRevision = await moveThreadDraft(handoffFrom, key, { draft, revision: storedRevision, logoutVersion });
      handoffFrom = undefined;
    } else {
      storedRevision = await writeThreadDraft(key, draft, { revision: storedRevision, logoutVersion });
    }
  };
  const forget = () => {
    forgotten = true;
    queuedSave = undefined;
    waiting.length = 0;
    if (storageKey !== undefined && activeDrafts.get(storageKey) === state) activeDrafts.delete(storageKey);
    snapshot = {
      drafts: new Map(),
      status: { restoring: false, saving: false, error: new DraftSignedOutError().message },
    };
    notify();
  };
  const save = (operation: () => Promise<void>) => {
    const savingRevision = ++revision;
    setStatus({ ...snapshot.status, restoring: false, saving: true });
    const result = writes.then(() => {
      if (!forgotten) return operation();
    });
    writes = result.catch(() => {});
    return result.then(
      () => {
        if (!forgotten && revision === savingRevision) setStatus({ restoring: false, saving: false });
      },
      error => {
        if (error instanceof DraftSignedOutError) {
          forget();
          return;
        }
        if (!forgotten && revision === savingRevision)
          setStatus({
            restoring: false,
            saving: false,
            canDiscard: unreadableKey !== undefined,
            error:
              error instanceof DraftConflictError
                ? error.message
                : error instanceof DraftLimitError
                  ? `${error.message} Keep this tab open or send the draft.`
                  : 'Changes could not be saved locally. Keep this tab open to avoid losing this draft.',
          });
      },
    );
  };
  const updateDraft = (key: PropertyKey, value: SetStateAction<ThreadDraft>) => {
    if (forgotten) return;
    if (snapshot.status.restoring) {
      waiting.push(() => updateDraft(key, value));
      return;
    }
    const previous = getDraft(key);
    const next = typeof value === 'function' ? value(previous) : value;
    if (next === previous) return;
    const drafts = new Map(snapshot.drafts);
    if (!next.text && next.attachments.length === 0) drafts.delete(key);
    else drafts.set(key, next);
    snapshot = { ...snapshot, drafts };
    notify();
    if (storageKey !== undefined && key === PERSISTED && !restorationFailed) {
      if (queuedSave?.target === storageKey) {
        queuedSave.draft = next;
      } else {
        const queued = { target: storageKey, draft: next };
        queuedSave = queued;
        void save(async () => {
          if (queuedSave === queued) queuedSave = undefined;
          await persist(queued.target, queued.draft);
        });
      }
    }
  };
  const load = async () => {
    if (storageKey === undefined) return;
    try {
      const saved = await loadThreadDraft(storageKey);
      if (forgotten) return;
      storedRevision = saved.revision;
      logoutVersion = saved.logoutVersion;
      snapshot = { drafts: new Map([[PERSISTED, saved.draft]]), status: { restoring: false, saving: false } };
      notify();
    } catch (error) {
      if (forgotten) return;
      restorationFailed = true;
      if (error instanceof CorruptedDraftError) {
        unreadableKey = storageKey;
        logoutVersion = error.logoutVersion;
      }
      setStatus({
        restoring: false,
        saving: false,
        canDiscard: unreadableKey !== undefined,
        error: 'The saved draft could not be restored. Keep this conversation open; new edits are not saved.',
      });
    }
    for (const update of waiting.splice(0)) update();
    release();
  };
  const state: DraftState = {
    getDraft,
    updateDraft,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (!started) {
        started = true;
        loading = load();
      }
      return () => {
        listeners.delete(listener);
        release();
      };
    },
    signedOut(version) {
      if (logoutVersion !== version) forget();
    },
    async discardUnreadable() {
      const key = unreadableKey;
      if (forgotten || key === undefined) return;
      await save(async () => {
        await discardCorruptedThreadDraft(key, { revision: storedRevision, logoutVersion });
        unreadableKey = undefined;
        restorationFailed = false;
        storedRevision = undefined;
        if (storageKey !== undefined) await persist(storageKey, getDraft(PERSISTED));
      });
    },
    async move(to) {
      if (snapshot.status.restoring) await loading;
      if (forgotten || storageKey === undefined || storageKey === to) return;
      const from = storageKey;
      storageKey = to;
      activeDrafts.delete(from);
      activeDrafts.set(to, state);
      // Later edits target the destination immediately and queue behind this move.
      if (!restorationFailed)
        await save(async () => {
          handoffFrom ??= from;
          await persist(to, getDraft(PERSISTED));
        });
    },
  };
  return state;
}

export function createThreadDraftState(persistence?: { key: string; threadId: string }) {
  if (persistence) listenForSignouts();
  const state = persistence ? (activeDrafts.get(persistence.key) ?? createState(persistence.key)) : createState();
  if (persistence) activeDrafts.set(persistence.key, state);
  const keyFor = (threadId?: string) =>
    persistence && threadId === persistence.threadId ? PERSISTED : resolveThreadInputKey(threadId);
  return {
    getDraft: (threadId?: string) => state.getDraft(keyFor(threadId)),
    updateDraft: (threadId: string | undefined, value: SetStateAction<ThreadDraft>) =>
      state.updateDraft(keyFor(threadId), value),
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    move: state.move,
    discardUnreadable: state.discardUnreadable,
  };
}
