import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { createContext } from 'react';
import type { RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';

/** Owned by the router, independently of any primitive or view. */
export const FeatureWorkspaceContext = createContext<
  | {
      target: HTMLDivElement;
      panel: RefObject<PanelImperativeHandle | null>;
      handle: RefObject<CollapsiblePanelHandle | null>;
    }
  | undefined
>(undefined);
