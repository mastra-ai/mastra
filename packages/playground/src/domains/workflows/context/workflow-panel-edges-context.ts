import { createContext } from 'react';
import type { Ref } from 'react';

export const WorkflowPanelEdgesContext = createContext<
  | {
      information: Ref<HTMLElement>;
      recentRuns: Ref<HTMLElement>;
    }
  | undefined
>(undefined);
