import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mastra.agentStudio.previewMode';

const readPreviewMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Admins can flip this to see the end-user Agent Studio sidebar and routes.
 * Persists in localStorage. Returns the current value plus a setter.
 */
export const useAgentStudioPreviewMode = () => {
  const [isPreviewMode, setPreviewMode] = useState<boolean>(() => readPreviewMode());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setPreviewMode(readPreviewMode());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPersisted = useCallback((value: boolean) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
      } catch {
        // Ignore storage failures.
      }
    }
    setPreviewMode(value);
  }, []);

  return {
    isPreviewMode,
    setPreviewMode: setPersisted,
  };
};
