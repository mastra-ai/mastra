import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type WorkflowSelectedStepContextType = {
  selectedStepId: string | null;
  hoverStepId: string | null;
  setSelectedStepId: Dispatch<SetStateAction<string | null>>;
  setHoverStepId: Dispatch<SetStateAction<string | null>>;
};

export const WorkflowSelectedStepContext = createContext<WorkflowSelectedStepContextType | null>(null);
