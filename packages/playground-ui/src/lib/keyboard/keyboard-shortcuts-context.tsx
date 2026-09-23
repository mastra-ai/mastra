import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { createKeyboardDispatcher, type KeyboardDispatcher } from './keyboard-dispatcher';

type KeyboardShortcutsContextValue = { status: 'missing' } | { status: 'ready'; dispatcher: KeyboardDispatcher };

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue>({ status: 'missing' });
const KeyboardScopeContext = createContext(0);

/**
 * Hosts the single `window` keydown listener and the shared sequence state for
 * every `useKeydown` call in the tree. Mount once, at the root of the app.
 * Without it, each `useKeydown` listens on its own and no shadowing happens.
 */
export const KeyboardShortcutsProvider = ({ children }: { children: ReactNode }) => {
  const dispatcherRef = useRef<KeyboardDispatcher | undefined>(undefined);
  if (!dispatcherRef.current) dispatcherRef.current = createKeyboardDispatcher();
  const dispatcher = dispatcherRef.current;

  useEffect(() => {
    window.addEventListener('keydown', dispatcher.handleKeydown);
    return () => {
      window.removeEventListener('keydown', dispatcher.handleKeydown);
      dispatcher.reset();
    };
  }, [dispatcher]);

  const value = useMemo<KeyboardShortcutsContextValue>(() => ({ status: 'ready', dispatcher }), [dispatcher]);

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      <KeyboardScopeContext.Provider value={0}>{children}</KeyboardScopeContext.Provider>
    </KeyboardShortcutsContext.Provider>
  );
};

/**
 * Marks a more specific keyboard context (a page, a panel). Shortcuts declared
 * inside shadow the same shortcuts declared outside, for as long as the scope
 * is mounted. Scopes nest: the deepest one wins.
 */
export const KeyboardScope = ({ children }: { children: ReactNode }) => {
  const depth = useContext(KeyboardScopeContext);
  return <KeyboardScopeContext.Provider value={depth + 1}>{children}</KeyboardScopeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- provider and its hooks intentionally share this module
export const useKeyboardShortcutsContext = () => useContext(KeyboardShortcutsContext);
// eslint-disable-next-line react-refresh/only-export-components -- provider and its hooks intentionally share this module
export const useKeyboardScopeDepth = () => useContext(KeyboardScopeContext);
