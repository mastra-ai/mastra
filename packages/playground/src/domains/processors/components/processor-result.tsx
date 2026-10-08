import { Badge } from '@mastra/playground-ui/components/Badge';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ProcessorExecutionState } from '../types/processor-execution-state';

export function ProcessorResult({ result }: { result: ProcessorExecutionState }) {
  if (result.status === 'idle')
    return (
      <EmptyState
        variant="fill"
        titleSlot="Processor result"
        descriptionSlot="Run the processor to inspect its output."
      />
    );
  if (result.status === 'running')
    return (
      <div role="status" className="h-full">
        <EmptyState variant="fill" titleSlot="Running processor…" />
      </div>
    );
  if (result.status === 'error') return <Notice variant="destructive">{result.message}</Notice>;
  const { response } = result;
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2" role="status">
        <Badge variant={response.success ? 'success' : 'destructive'}>{response.success ? 'Success' : 'Failed'}</Badge>
        {response.tripwire?.triggered && <Badge variant="info">Tripwire triggered</Badge>}
      </div>
      {response.error && <Notice variant="destructive">{response.error}</Notice>}
      {response.tripwire?.triggered && response.tripwire.reason && (
        <Notice variant="warning">{response.tripwire.reason}</Notice>
      )}
      <CodeEditor value={JSON.stringify(response, null, 2)} language="json" editable={false} />
    </div>
  );
}
