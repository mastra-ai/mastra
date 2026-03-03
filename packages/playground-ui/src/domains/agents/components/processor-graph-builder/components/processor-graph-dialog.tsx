import { useEffect, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { SideDialog } from '@/ds/components/SideDialog';
import { Button } from '@/ds/components/Button';
import type { StoredProcessorGraph } from '@mastra/core/storage';
import type { JsonSchema } from '@/lib/json-schema';
import { useProcessorProviders } from '@/domains/processors/hooks';
import { useProcessorGraphBuilder } from '../hooks/use-processor-graph-builder';
import { useProcessorGraphDnd } from '../hooks/use-processor-graph-dnd';
import { ProcessorGraphBuilderProvider } from './processor-graph-builder-context';
import { ProcessorGraphCanvas } from './processor-graph-canvas';
import { ProcessorProviderList } from './processor-provider-list';

interface ProcessorGraphDialogProps {
  mode: 'input' | 'output';
  graph?: StoredProcessorGraph;
  onGraphChange: (graph: StoredProcessorGraph) => void;
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  variablesSchema?: JsonSchema;
}

export function ProcessorGraphDialog({
  mode,
  graph,
  onGraphChange,
  isOpen,
  onClose,
  readOnly = false,
  variablesSchema,
}: ProcessorGraphDialogProps) {
  const { data: providersData, isLoading: isLoadingProviders } = useProcessorProviders();
  const providers = providersData?.providers ?? [];
  const builder = useProcessorGraphBuilder(graph);
  const { onDragEnd } = useProcessorGraphDnd(builder, providers);

  // Sync builder state when dialog opens (handles edit mode where graph prop updates after initial mount)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      if (graph) {
        builder.loadGraph(graph);
      } else {
        builder.reset();
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen, graph, builder.loadGraph, builder.reset]);

  const handleSave = () => {
    onGraphChange(builder.toGraph());
    onClose();
  };

  const title = mode === 'input' ? 'Input Processors' : 'Output Processors';

  return (
    <SideDialog
      dialogTitle={title}
      dialogDescription={`Configure the ${mode} processor pipeline`}
      isOpen={isOpen}
      onClose={onClose}
      level={2}
    >
      <SideDialog.Top>
        <span className="flex-1">{title}</span>
        {!readOnly && (
          <div className="flex items-center gap-2 mr-6">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!builder.validation.isValid}>
              Save
            </Button>
          </div>
        )}
      </SideDialog.Top>

      <ProcessorGraphBuilderProvider
        builder={builder}
        providers={providers}
        isLoadingProviders={isLoadingProviders}
        readOnly={readOnly}
        variablesSchema={variablesSchema}
      >
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-[1fr_280px] grid-rows-[minmax(0,1fr)] overflow-hidden h-full">
            <ProcessorGraphCanvas />
            <ProcessorProviderList />
          </div>
        </DragDropContext>
      </ProcessorGraphBuilderProvider>
    </SideDialog>
  );
}
