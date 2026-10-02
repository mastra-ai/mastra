import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { WorkflowStepDetailContext } from './workflow-step-detail-context';
import type { StepDetailData, WorkflowDataSelection } from './workflow-step-detail-context';

export function WorkflowStepDetailProvider({ children }: { children: ReactNode }) {
  const [stepDetail, setStepDetail] = useState<StepDetailData | null>(null);
  const dataTriggerRef = useRef<HTMLButtonElement | undefined>(undefined);

  const showMapConfig = useCallback(
    ({ stepName, stepId, mapConfig }: { stepName: string; stepId?: string; mapConfig: string }) => {
      dataTriggerRef.current = undefined;
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
      dataTriggerRef.current = undefined;
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

  const resetStepDetail = useCallback(() => {
    dataTriggerRef.current = undefined;
    setStepDetail(null);
  }, []);

  const closeStepDetail = useCallback(() => {
    const trigger = dataTriggerRef.current;
    resetStepDetail();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, [resetStepDetail]);

  const showData = useCallback((selection: WorkflowDataSelection, trigger: HTMLButtonElement) => {
    dataTriggerRef.current = trigger;
    setStepDetail({ type: 'data', selection });
  }, []);

  const value = useMemo(
    () => ({ stepDetail, showMapConfig, showNestedGraph, showData, closeStepDetail, resetStepDetail }),
    [stepDetail, showMapConfig, showNestedGraph, showData, closeStepDetail, resetStepDetail],
  );

  return <WorkflowStepDetailContext.Provider value={value}>{children}</WorkflowStepDetailContext.Provider>;
}
