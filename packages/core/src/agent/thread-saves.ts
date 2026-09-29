type ThreadSaveListener = (savedAt: number) => void;

const listeners = new Map<string, Set<ThreadSaveListener>>();

function saveKey(resourceId: string | undefined, threadId: string) {
  return `${resourceId ?? ''}\u0000${threadId}`;
}

/**
 * Reports that messages of a thread were written to storage. `savedAt` is taken
 * before the write, so anything produced at or before it is part of the save.
 */
export function noteThreadMessagesSaved(args: { threadId: string; resourceId?: string; savedAt: number }) {
  for (const listener of [...(listeners.get(saveKey(args.resourceId, args.threadId)) ?? [])]) {
    listener(args.savedAt);
  }
}

/** Listen for saves of a thread; returns the unsubscribe function. */
export function onThreadMessagesSaved(
  args: { threadId: string; resourceId?: string },
  listener: ThreadSaveListener,
): () => void {
  const key = saveKey(args.resourceId, args.threadId);
  const set = listeners.get(key) ?? new Set<ThreadSaveListener>();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0 && listeners.get(key) === set) listeners.delete(key);
  };
}
