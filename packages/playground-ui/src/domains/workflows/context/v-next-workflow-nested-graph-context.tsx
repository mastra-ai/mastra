import { Dialog, DialogContent, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { createContext, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Workflow } from 'lucide-react';
import { Text } from '@/components/ui/text';
import { StepFlowEntry } from '@mastra/core/workflows/vNext';
import { VNextWorkflowNestedGraph } from '../workflow/v-next-workflow-nested-graph';

type VNextWorkflowNestedGraphContextType = {
  showNestedGraph: ({ label, stepGraph }: { label: string; stepGraph: StepFlowEntry[] }) => void;
  closeNestedGraph: () => void;
};

export const VNextWorkflowNestedGraphContext = createContext<VNextWorkflowNestedGraphContextType>(
  {} as VNextWorkflowNestedGraphContextType,
);

export function VNextWorkflowNestedGraphProvider({ children }: { children: React.ReactNode }) {
  const [stepGraph, setStepGraph] = useState<StepFlowEntry[] | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [label, setLabel] = useState<string>('');

  const closeNestedGraph = () => {
    setOpenDialog(false);
    setStepGraph(null);
    setLabel('');
  };

  const showNestedGraph = ({ label, stepGraph }: { label: string; stepGraph: StepFlowEntry[] }) => {
    setLabel(label);
    setStepGraph(stepGraph);
    setOpenDialog(true);
  };

  return (
    <VNextWorkflowNestedGraphContext.Provider
      value={{
        showNestedGraph,
        closeNestedGraph,
      }}
    >
      {children}

      <Dialog open={openDialog} onOpenChange={closeNestedGraph}>
        <DialogPortal>
          <DialogContent className="w-[40rem] h-[40rem] bg-[#121212] p-[0.5rem]">
            <DialogTitle className="flex items-center gap-1.5 absolute top-2.5 left-2.5">
              <Workflow className="text-current w-4 h-4" />
              <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
                {label} workflow
              </Text>
            </DialogTitle>
            <ReactFlowProvider>
              <VNextWorkflowNestedGraph stepGraph={stepGraph!} open={openDialog} />
            </ReactFlowProvider>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </VNextWorkflowNestedGraphContext.Provider>
  );
}
