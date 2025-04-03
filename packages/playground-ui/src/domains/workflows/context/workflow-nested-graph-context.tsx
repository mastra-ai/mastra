import { Dialog, DialogContent, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createContext, useState } from 'react';
import { WorkflowNestedGraph } from '../workflow/workflow-nested-graph';
import { ReactFlowProvider } from '@xyflow/react';
import { Workflow } from 'lucide-react';
import { Text } from '@/components/ui/text';

type WorkflowNestedGraphContextType = {
  showNestedGraph: ({
    label,
    stepGraph,
    stepSubscriberGraph,
  }: {
    label: string;
    stepGraph: any;
    stepSubscriberGraph: any;
  }) => void;
  closeNestedGraph: () => void;
};

export const WorkflowNestedGraphContext = createContext<WorkflowNestedGraphContextType>(
  {} as WorkflowNestedGraphContextType,
);

export function WorkflowNestedGraphProvider({ children }: { children: React.ReactNode }) {
  const [stepGraph, setStepGraph] = useState<any>(null);
  const [stepSubscriberGraph, setStepSubscriberGraph] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [label, setLabel] = useState<string>('');

  const closeNestedGraph = () => {
    setOpenDialog(false);
    setStepGraph(null);
    setStepSubscriberGraph(null);
    setLabel('');
  };

  const showNestedGraph = ({
    label,
    stepGraph,
    stepSubscriberGraph,
  }: {
    label: string;
    stepGraph: any;
    stepSubscriberGraph: any;
  }) => {
    setLabel(label);
    setStepGraph(stepGraph);
    setStepSubscriberGraph(stepSubscriberGraph);
    setOpenDialog(true);
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
          <DialogContent className="w-[40rem] h-[40rem] bg-[#121212] p-[0.5rem]">
            <DialogTitle className="flex items-center gap-1.5 absolute top-2.5 left-2.5">
              <Workflow className="text-current w-4 h-4" />
              <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
                {label} workflow
              </Text>
            </DialogTitle>
            <ReactFlowProvider>
              <WorkflowNestedGraph stepGraph={stepGraph} open={openDialog} stepSubscriberGraph={stepSubscriberGraph} />
            </ReactFlowProvider>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </WorkflowNestedGraphContext.Provider>
  );
}
