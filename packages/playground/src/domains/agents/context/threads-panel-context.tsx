import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { ThreadsPanelContext } from './use-threads-panel';
import type { ThreadsPanelContextValue } from './use-threads-panel';

/** Key by agent id so the one-shot auto-collapse is tracked per agent. */
export const ThreadsPanelProvider = ({ children }: { children: ReactNode }) => {
  const panel = useRef<CollapsiblePanelHandle | null>(null);
  const autoCollapse = useRef<'idle' | 'pending' | 'collapsed' | 'done'>('idle');
  const hasRegistered = useRef(false);
  const value = useRef<ThreadsPanelContextValue | undefined>(undefined);

  // Children commit before their parents, so the empty landing can ask to collapse
  // before the panel registers. The intent is recorded and applied on registration,
  // after the commit settles so the resizable group is ready.
  value.current ??= {
    registerPanel: (handle, hasSavedLayout) => {
      const isFirstRegistration = handle && !hasRegistered.current;
      if (handle) hasRegistered.current = true;
      panel.current = handle;
      // A layout saved before this page load means the user already chose a width (or a
      // previous auto-collapse was persisted): restore it instead of folding the panel again.
      if (isFirstRegistration && hasSavedLayout) {
        autoCollapse.current = 'done';
        return;
      }
      if (handle && autoCollapse.current === 'pending') {
        autoCollapse.current = 'collapsed';
        queueMicrotask(() => panel.current?.collapse());
      }
    },
    collapse: () => panel.current?.collapse(),
    toggle: () => panel.current?.toggle(),
    collapseOnce: () => {
      if (autoCollapse.current !== 'idle') return;
      if (!panel.current) {
        autoCollapse.current = 'pending';
        return;
      }
      autoCollapse.current = 'collapsed';
      panel.current.collapse();
    },
    expandIfAutoCollapsed: () => {
      if (autoCollapse.current !== 'collapsed') return;
      autoCollapse.current = 'done';
      panel.current?.expand();
    },
  };

  return <ThreadsPanelContext.Provider value={value.current}>{children}</ThreadsPanelContext.Provider>;
};
