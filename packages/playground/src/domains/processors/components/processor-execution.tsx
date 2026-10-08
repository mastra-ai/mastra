import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import type { ProcessorDetail } from '@mastra/react/hooks/processors';
import { useState } from 'react';
import type { ProcessorExecutionState } from '../types/processor-execution-state';
import { ProcessorResult } from './processor-result';
import { ProcessorTestForm } from './processor-test-form';
import { ExecutionWorkspace } from '@/components/execution-workspace';

export function ProcessorExecution({ processor }: { processor: ProcessorDetail }) {
  const [result, setResult] = useState<ProcessorExecutionState>({ status: 'idle' });
  return (
    <ExecutionWorkspace controls={<ProcessorTestForm processor={processor} onResult={setResult} />}>
      <ScrollArea role="region" aria-label="Processor result" className="h-full min-h-0 min-w-0" mask={false}>
        <ScrollAreaViewport className="[&>div]:h-full">
          <ProcessorResult result={result} />
        </ScrollAreaViewport>
      </ScrollArea>
    </ExecutionWorkspace>
  );
}
