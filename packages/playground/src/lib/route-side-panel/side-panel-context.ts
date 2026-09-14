import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { createContext } from 'react';

export interface SidePanelState {
  el: HTMLElement | null;
  setEl: Dispatch<SetStateAction<HTMLElement | null>>;
  activeOwner: string | null;
  register: (owner: string, priority: number) => () => void;
  /** Ref the layout attaches to its `CollapsiblePanel`; pages drive it through `toggle()`. */
  panelHandle: RefObject<CollapsiblePanelHandle | null>;
  /** Physical state reported by the panel's `onResize`, so header controls reflect it. */
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  toggle: () => void;
}

export const SidePanelContext = createContext<SidePanelState | null>(null);
