import type { PluginInteractiveBinding } from './settings-commands.js';

type Listener = (binding: PluginInteractiveBinding | undefined) => void;

/** Host-owned capability. Constructing it does not make a headless session interactive. */
export function createInteractiveBindingHost(reportError: (error: unknown) => void) {
  let current: PluginInteractiveBinding | undefined;
  let cancellation: AbortController | undefined;
  let generation = 0;
  let publishing = false;
  const listeners = new Map<Listener, number>();

  const deliver = (listener: Listener) => {
    listeners.set(listener, generation);
    try {
      listener(current);
    } catch (error) {
      reportError(error);
    }
  };
  const flush = () => {
    if (publishing) return;
    publishing = true;
    try {
      let snapshotGeneration: number;
      do {
        snapshotGeneration = generation;
        for (const listener of [...listeners.keys()]) {
          if (generation !== snapshotGeneration) break;
          if (listeners.has(listener) && listeners.get(listener) !== generation) deliver(listener);
        }
      } while (snapshotGeneration !== generation);
    } finally {
      publishing = false;
    }
  };
  return {
    getInteractiveBinding: () => current,
    onInteractiveBindingChange(listener: Listener): () => void {
      listeners.set(listener, -1);
      // Synchronous initial delivery also participates in reentrancy protection.
      const wasPublishing = publishing;
      publishing = true;
      try {
        deliver(listener);
      } finally {
        publishing = wasPublishing;
      }
      flush();
      return () => {
        listeners.delete(listener);
      };
    },
    publish(binding: Omit<PluginInteractiveBinding, 'signal'> | undefined): void {
      const previous = cancellation;
      cancellation = binding ? new AbortController() : undefined;
      current = binding && cancellation ? { ...binding, signal: cancellation.signal } : undefined;
      generation++;
      // Abort handlers may publish again. Never overwrite that newer binding.
      previous?.abort();
      flush();
    },
  };
}
