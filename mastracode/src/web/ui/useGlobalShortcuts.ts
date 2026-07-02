import { useEffect } from 'react';

interface UseGlobalShortcutsArgs {
  busy: boolean;
  projectsOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  paletteOpen: boolean;
  sidebarOpen: boolean;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  setShortcutsOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  setSettingsOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  abort: () => Promise<void>;
}

export function useGlobalShortcuts({
  busy,
  projectsOpen,
  settingsOpen,
  shortcutsOpen,
  paletteOpen,
  sidebarOpen,
  setPaletteOpen,
  setShortcutsOpen,
  setSettingsOpen,
  setSidebarOpen,
  abort,
}: UseGlobalShortcutsArgs) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen(o => !o);
        return;
      }
      if (e.key === 'Escape') {
        if (projectsOpen) return;
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
          return;
        }
        if (busy) void abort();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    abort,
    busy,
    paletteOpen,
    projectsOpen,
    settingsOpen,
    shortcutsOpen,
    sidebarOpen,
    setPaletteOpen,
    setSettingsOpen,
    setShortcutsOpen,
    setSidebarOpen,
  ]);
}
