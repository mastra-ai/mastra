import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { createContext } from 'react';

/** Per-owner shape of the desktop panel. */
export interface SidePanelOptions {
  /** When false, the panel can't be dragged or toggled shut; it only goes away when its owner unmounts. */
  collapsible: boolean;
  /** Minimum width in pixels; the layout's default applies when omitted. */
  minSize?: number;
}

export interface SidePanelState {
  el: HTMLElement | null;
  setEl: Dispatch<SetStateAction<HTMLElement | null>>;
  activeOwner: string | null;
  activeOptions: SidePanelOptions | null;
  register: (owner: string, priority: number, options: SidePanelOptions) => () => void;
  /** Ref the layout attaches to its `CollapsiblePanel`; pages drive it through `toggle()`. */
  panelHandle: RefObject<CollapsiblePanelHandle | null>;
  /** Derived: collapsed on desktop (from the panel's `onResize`); never collapsed on mobile, where the drawer owns its own open state. */
  isCollapsed: boolean;
  onPanelResize: (sizeInPixels: number) => void;
  toggle: () => void;
}

export const SidePanelContext = createContext<SidePanelState | null>(null);
