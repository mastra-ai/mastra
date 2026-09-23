import type { MastraClient } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { AudioLinesIcon } from 'lucide-react';
import { useState } from 'react';
import { LiveKitRecordingContent } from './livekit-recording-content';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';

type TraceSpans = Awaited<ReturnType<MastraClient['getTraceLight']>>['spans'];

/** Owns the review dialog for one trace. Callers key this component by traceId. */
export function LiveKitRecordingReview({ traceId, spans }: { traceId: string; spans?: TraceSpans }) {
  const { data: packages } = useMastraPackages();
  const [open, setOpen] = useState(false);
  const calls = spans?.filter(
    span =>
      span.name === 'voice call' && typeof span.metadata?.roomName === 'string' && span.metadata.roomName.length > 0,
  );
  if (!packages?.liveKitRecordingRouteEnabled || calls?.length !== 1) return undefined;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <AudioLinesIcon />
        Review Audio
      </Button>
      <Dialog variant="new" open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review Audio</DialogTitle>
            <DialogDescription>Listen to the call associated with this trace.</DialogDescription>
          </DialogHeader>
          <DialogBody>{open && <LiveKitRecordingContent traceId={traceId} />}</DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
