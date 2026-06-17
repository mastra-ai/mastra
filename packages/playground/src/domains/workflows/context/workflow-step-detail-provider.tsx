import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { WorkflowStepDetailContext } from './workflow-step-detail-context';
import type { StepDetailData } from './workflow-step-detail-context';

export function WorkflowStepDetailProvider({ children }: { children: ReactNode }) {
  const [stepDetail, setStepDetail] = useState<StepDetailData | null>(null);

  const showMapConfig = useCallback(
    ({ stepName, stepId, mapConfig }: { stepName: string; stepId?: string; mapConfig: string }) => {
      setStepDetail({
        type: 'map-config',
        stepName,
        stepId,
        mapConfig,
      });
    },
    [],
  );

  const showNestedGraph = useCallback(
    ({ label, stepGraph, fullStep }: { label: string; stepGraph: SerializedStepFlowEntry[]; fullStep: string }) => {
      setStepDetail({
        type: 'nested-graph',
        stepName: label,
        nestedGraph: {
          label,
          stepGraph,
          fullStep,
        },
      });
    },
    [],
  );

  const closeStepDetail = useCallback(() => {
    setStepDetail(null);
  }, []);

  return (
    <WorkflowStepDetailContext.Provider
      value={{
        stepDetail,
        showMapConfig,
        showNestedGraph,
        closeStepDetail,
      }}
    >
      {children}
    </WorkflowStepDetailContext.Provider>
  );
}
