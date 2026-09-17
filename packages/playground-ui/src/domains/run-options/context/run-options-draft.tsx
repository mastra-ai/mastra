import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface RunOptionsDraft {
  /** Whether the editor holds unsaved changes. */
  isDirty: boolean;
  /** Persist the draft. Return `false` when the draft is invalid and could not be saved. */
  save: () => boolean;
}

interface RunOptionsDraftRegistry {
  setDirty: (id: string, isDirty: boolean) => void;
  registerSave: (id: string, save: () => boolean) => () => void;
}

const RunOptionsDraftContext = createContext<RunOptionsDraftRegistry | null>(null);

/**
 * Collects the drafts of every editor rendered inside run options so a single
 * "Save" button can persist all of them at once.
 */
// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useRunOptionsDraftRegistry() {
  const [dirtyIds, setDirtyIds] = useState<Record<string, boolean>>({});
  const saversRef = useRef(new Map<string, () => boolean>());

  const setDirty = useCallback((id: string, isDirty: boolean) => {
    setDirtyIds(previous => (previous[id] === isDirty ? previous : { ...previous, [id]: isDirty }));
  }, []);

  const registerSave = useCallback((id: string, save: () => boolean) => {
    saversRef.current.set(id, save);
    return () => {
      saversRef.current.delete(id);
      setDirtyIds(previous => {
        if (!(id in previous)) return previous;
        const { [id]: _removed, ...rest } = previous;
        return rest;
      });
    };
  }, []);

  const isDirty = Object.values(dirtyIds).some(Boolean);

  /** Saves every dirty draft; returns `false` if any of them failed. */
  const saveAll = useCallback(() => {
    let ok = true;
    for (const [id, save] of saversRef.current) {
      if (dirtyIds[id] && !save()) ok = false;
    }
    return ok;
  }, [dirtyIds]);

  const registry = useMemo(() => ({ setDirty, registerSave }), [setDirty, registerSave]);

  return { registry, isDirty, saveAll };
}

export function RunOptionsDraftProvider({
  registry,
  children,
}: {
  registry: RunOptionsDraftRegistry;
  children: ReactNode;
}) {
  return <RunOptionsDraftContext.Provider value={registry}>{children}</RunOptionsDraftContext.Provider>;
}

/**
 * Registers an editor draft with the surrounding run options so it is persisted
 * by the shared "Save" button. Must be used inside `RunOptionsContent`.
 */
// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useRunOptionsDraft({ isDirty, save }: RunOptionsDraft) {
  const registry = useContext(RunOptionsDraftContext);
  if (!registry) {
    throw new Error('useRunOptionsDraft must be used within RunOptionsContent');
  }

  const id = useId();
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => registry.registerSave(id, () => saveRef.current()), [registry, id]);
  useEffect(() => registry.setDirty(id, isDirty), [registry, id, isDirty]);
}
