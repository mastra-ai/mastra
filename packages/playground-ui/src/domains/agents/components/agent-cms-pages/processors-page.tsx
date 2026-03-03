import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Cpu } from 'lucide-react';

import { SectionHeader } from '@/domains/cms';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { ProcessorGraphDialog } from '../processor-graph-builder';
import type { StoredProcessorGraph } from '@mastra/core/storage';

function GraphSummary({ graph, label }: { graph?: StoredProcessorGraph; label: string }) {
  const stepCount = graph?.steps?.length ?? 0;

  return (
    <div className="flex items-center justify-between rounded border border-border1 bg-surface2 p-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-neutral3" />
        <span className="text-ui-sm text-neutral5">{label}</span>
        <Badge>{stepCount === 0 ? 'None' : `${stepCount} layer${stepCount === 1 ? '' : 's'}`}</Badge>
      </div>
    </div>
  );
}

export function ProcessorsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;

  const inputProcessors = useWatch({ control, name: 'inputProcessors' });
  const outputProcessors = useWatch({ control, name: 'outputProcessors' });
  const variables = useWatch({ control, name: 'variables' });

  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);

  const handleInputGraphChange = (graph: StoredProcessorGraph) => {
    form.setValue('inputProcessors', graph, { shouldDirty: true });
  };

  const handleOutputGraphChange = (graph: StoredProcessorGraph) => {
    form.setValue('outputProcessors', graph, { shouldDirty: true });
  };

  const inputStepCount = inputProcessors?.steps?.length ?? 0;
  const outputStepCount = outputProcessors?.steps?.length ?? 0;
  const totalProcessors = inputStepCount + outputStepCount;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <SectionHeader
          title="Processors"
          subtitle={`Configure processor pipelines for input and output processing.${totalProcessors > 0 ? ` (${totalProcessors} total)` : ''}`}
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-ui-sm font-medium text-neutral5">Input Processors</h3>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => setInputDialogOpen(true)}>
                  Configure
                </Button>
              )}
            </div>
            <GraphSummary graph={inputProcessors} label="Input pipeline" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-ui-sm font-medium text-neutral5">Output Processors</h3>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => setOutputDialogOpen(true)}>
                  Configure
                </Button>
              )}
            </div>
            <GraphSummary graph={outputProcessors} label="Output pipeline" />
          </div>
        </div>
      </div>

      <ProcessorGraphDialog
        mode="input"
        graph={inputProcessors}
        onGraphChange={handleInputGraphChange}
        isOpen={inputDialogOpen}
        onClose={() => setInputDialogOpen(false)}
        readOnly={readOnly}
        variablesSchema={variables}
      />

      <ProcessorGraphDialog
        mode="output"
        graph={outputProcessors}
        onGraphChange={handleOutputGraphChange}
        isOpen={outputDialogOpen}
        onClose={() => setOutputDialogOpen(false)}
        readOnly={readOnly}
        variablesSchema={variables}
      />
    </ScrollArea>
  );
}
