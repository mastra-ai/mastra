import { useCallback, useEffect, useSyncExternalStore } from 'react';

type NavigationCommandOpen = boolean | ((open: boolean) => boolean);

type UseNavigationCommandOptions = {
  enableShortcut?: boolean;
};

let navigationCommandOpen = false;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => navigationCommandOpen;

const setNavigationCommandOpen = (nextOpen: NavigationCommandOpen) => {
  const resolved = typeof nextOpen === 'function' ? nextOpen(navigationCommandOpen) : nextOpen;
  if (resolved === navigationCommandOpen) return;

  navigationCommandOpen = resolved;
  emit();
};

export const useNavigationCommand = ({ enableShortcut = true }: UseNavigationCommandOptions = {}) => {
  const open = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setOpen = useCallback((nextOpen: NavigationCommandOpen) => {
    setNavigationCommandOpen(nextOpen);
  }, []);

  const toggle = useCallback(() => {
    setNavigationCommandOpen(prev => !prev);
  }, []);

  useEffect(() => {
    if (!enableShortcut) return;

    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [enableShortcut, toggle]);

  return { open, setOpen, toggle };
};
