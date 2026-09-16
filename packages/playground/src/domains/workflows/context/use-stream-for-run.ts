import { toast } from '@mastra/playground-ui/utils/toast';
import { useStreamWorkflow } from '@mastra/react';
import { useCallback, useState } from 'react';

export type StreamMode = 'execute' | 'observe';
type StreamRun = { runId: string; mode: StreamMode };
type StreamForRunParams = { runId: string } & Pick<
  Parameters<typeof useStreamWorkflow>[0],
  'debugMode' | 'tracingOptions'
>;

export function useStreamForRun({ runId, debugMode, tracingOptions }: StreamForRunParams) {
  const [streamRun, setStreamRun] = useState<StreamRun>();
  const {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
    timeTravelWorkflowStream,
  } = useStreamWorkflow({ debugMode, tracingOptions, onError: error => toast.error(error.message) });

  const belongsToRun = streamRun?.runId === runId;
  const result = belongsToRun && streamResult.status ? streamResult : null;
  const isOpen = belongsToRun && isStreaming;
  const isObserving = belongsToRun && streamRun?.mode === 'observe';

  const select = useCallback((runId: string, mode: StreamMode = 'execute') => setStreamRun({ runId, mode }), []);
  const close = useCallback(() => {
    closeStreamsAndReset();
    setStreamRun(undefined);
  }, [closeStreamsAndReset]);

  return {
    result,
    isOpen,
    isObserving,
    select,
    close,
    streamWorkflow: streamWorkflow.mutateAsync,
    resumeWorkflowStream: resumeWorkflowStream.mutateAsync,
    observeWorkflowStream: observeWorkflowStream.mutate,
    timeTravelWorkflowStream: timeTravelWorkflowStream.mutateAsync,
  };
}
