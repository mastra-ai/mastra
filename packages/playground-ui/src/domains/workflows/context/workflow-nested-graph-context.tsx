import { Dialog, DialogContent, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { createContext, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Workflow } from 'lucide-react';
import { Text } from '@/components/ui/text';
import { WorkflowNestedGraph } from '../workflow/workflow-nested-graph';
import Spinner from '@/components/ui/spinner';

type WorkflowNestedGraphContextType = {
  showNestedGraph: ({
    label,
    stepGraph,
    fullStep,
  }: {
    label: string;
    stepGraph: SerializedStepFlowEntry[];
    fullStep: string;
  }) => void;
  closeNestedGraph: () => void;
};

export const WorkflowNestedGraphContext = createContext<WorkflowNestedGraphContextType>(
  {} as WorkflowNestedGraphContextType,
);

export function WorkflowNestedGraphProvider({ children }: { children: React.ReactNode }) {
  const [stepGraph, setStepGraph] = useState<SerializedStepFlowEntry[] | null>(null);
  const [parentStepGraphList, setParentStepGraphList] = useState<
    { stepGraph: SerializedStepFlowEntry[]; label: string; fullStep: string }[]
  >([]);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [label, setLabel] = useState<string>('');
  const [fullStep, setFullStep] = useState<string>('');
  const [switching, setSwitching] = useState(false);

  const closeNestedGraph = () => {
    if (parentStepGraphList.length) {
      setSwitching(true);
      const lastStepGraph = parentStepGraphList[parentStepGraphList.length - 1];
      setStepGraph(lastStepGraph.stepGraph);
      setLabel(lastStepGraph.label);
      setFullStep(lastStepGraph.fullStep);
      setParentStepGraphList(parentStepGraphList.slice(0, -1));
      setTimeout(() => {
        setSwitching(false);
      }, 500);
    } else {
      setOpenDialog(false);
      setStepGraph(null);
      setLabel('');
      setFullStep('');
    }
  };

  const showNestedGraph = ({
    label: newLabel,
    stepGraph: newStepGraph,
    fullStep: newFullStep,
  }: {
    label: string;
    stepGraph: SerializedStepFlowEntry[];
    fullStep: string;
  }) => {
    if (stepGraph) {
      setSwitching(true);
      setParentStepGraphList([...parentStepGraphList, { stepGraph, label, fullStep }]);
    }
    setLabel(newLabel);
    setFullStep(newFullStep);
    setStepGraph(newStepGraph);
    setOpenDialog(true);
    setTimeout(() => {
      setSwitching(false);
    }, 500);
  };

  return (
    <WorkflowNestedGraphContext.Provider
      value={{
        showNestedGraph,
        closeNestedGraph,
      }}
    >
      {children}

      <Dialog open={openDialog} onOpenChange={closeNestedGraph}>
        <DialogPortal>
          <DialogContent className="w-[45rem] h-[45rem] max-w-[unset] bg-[#121212] p-[0.5rem]">
            <DialogTitle className="flex items-center gap-1.5 absolute top-2.5 left-2.5">
              <Workflow className="text-current w-4 h-4" />
              <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
                {label} workflow
              </Text>
            </DialogTitle>
            {switching ? (
              <div className="w-full h-full flex items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <ReactFlowProvider>
                <WorkflowNestedGraph stepGraph={stepGraph!} open={openDialog} workflowName={fullStep} />
              </ReactFlowProvider>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </WorkflowNestedGraphContext.Provider>
  );
}
