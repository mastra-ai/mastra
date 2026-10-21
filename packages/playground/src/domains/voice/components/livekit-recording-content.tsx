import { Button } from '@mastra/playground-ui/components/Button';
import { RefreshCwIcon } from 'lucide-react';
import { useLiveKitRecording } from '../hooks/use-livekit-recording';
import { LiveKitRecordingState } from './livekit-recording-state';

export function LiveKitRecordingContent({ traceId }: { traceId: string }) {
  const { data, isFetching, isError, refetch, dataUpdatedAt } = useLiveKitRecording(traceId);
  return (
    <div className="flex flex-col gap-4">
      <LiveKitRecordingState data={data} isFetching={isFetching} isError={isError} dataUpdatedAt={dataUpdatedAt} />
      <Button size="sm" disabled={isFetching} onClick={() => void refetch()}>
        <RefreshCwIcon />
        Refresh recording
      </Button>
    </div>
  );
}
