import { useKeyDown } from '../../../lib/hooks';

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
  useKeyDown({
    'mod+k': e => {
      e.preventDefault();
      setPaletteOpen(o => !o);
    },
    '?': e => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      setShortcutsOpen(o => !o);
    },
    escape: () => {
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
    },
  });
}
