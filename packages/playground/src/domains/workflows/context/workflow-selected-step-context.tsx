import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WorkflowSelectedStepContext } from './workflow-selected-step-context-value';

export function WorkflowSelectedStepProvider({ children }: { children: ReactNode }) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const value = useMemo(() => ({ selectedStepId, setSelectedStepId }), [selectedStepId]);

  return <WorkflowSelectedStepContext.Provider value={value}>{children}</WorkflowSelectedStepContext.Provider>;
}
