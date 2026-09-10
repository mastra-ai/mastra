import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WorkflowSelectedStepContext } from './workflow-selected-step-context-value';

export function WorkflowSelectedStepProvider({ children }: { children: ReactNode }) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [hoverStepId, setHoverStepId] = useState<string | null>(null);

  const value = useMemo(
    () => ({ selectedStepId, hoverStepId, setSelectedStepId, setHoverStepId }),
    [selectedStepId, hoverStepId],
  );

  return <WorkflowSelectedStepContext.Provider value={value}>{children}</WorkflowSelectedStepContext.Provider>;
}
