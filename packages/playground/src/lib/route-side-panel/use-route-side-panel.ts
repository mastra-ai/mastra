import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import type { RefObject } from 'react';
import { use } from 'react';
import { SidePanelContext } from './side-panel-context';

const noop = () => {};

const detachedHandle: RefObject<CollapsiblePanelHandle | null> = { current: null };

export function useRouteSidePanel() {
  const ctx = use(SidePanelContext);
  // Outside the provider (e.g. isolated page tests) the panel is a no-op.
  if (!ctx) {
    return {
      hasPanel: false,
      isCollapsed: true,
      isOpen: false,
      onPanelResize: noop,
      isDrawerOpen: false,
      onDrawerOpenChange: noop,
      panelHandle: detachedHandle,
      toggle: noop,
    };
  }
  const { activeOwner, isCollapsed, isOpen, onPanelResize, isDrawerOpen, onDrawerOpenChange, panelHandle, toggle } =
    ctx;
  return {
    hasPanel: activeOwner !== null,
    isCollapsed,
    isOpen,
    onPanelResize,
    isDrawerOpen,
    onDrawerOpenChange,
    panelHandle,
    toggle,
  };
}
