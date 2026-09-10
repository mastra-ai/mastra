import { Loader2Icon, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../ds/components/Button';
import { CodeEditor } from '../../../ds/components/CodeEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '../../../ds/components/Dialog';
import { Txt } from '../../../ds/components/Txt';
import { toSigFigs } from '../../../utils/number';
import { useTimeDiff } from './use-time-diff';
export interface BackgroundTaskDetails {
  args?: any;
  result?: any;
  suspendPayload?: any;
}

interface BackgroundTaskMetadataProps {
  details?: BackgroundTaskDetails;
  backgroundTaskTaskId: string;
  backgroundTaskStartedAt: Date;
  backgroundTaskCompletedAt?: Date;
  backgroundTaskSuspendedAt?: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BackgroundTaskMetadata = ({
  details,
  backgroundTaskStartedAt,
  backgroundTaskCompletedAt,
  backgroundTaskSuspendedAt,
  open,
  onOpenChange,
}: BackgroundTaskMetadataProps) => {
  const timeDiff = useTimeDiff({
    startedAt: new Date(backgroundTaskStartedAt).getTime(),
    endedAt: backgroundTaskCompletedAt
      ? new Date(backgroundTaskCompletedAt).getTime()
      : backgroundTaskSuspendedAt
        ? new Date(backgroundTaskSuspendedAt).getTime()
        : undefined,
  });

  const backgroundTask = details;

  const args = backgroundTask?.args;
  const result = backgroundTask?.result as any;
  const suspendPayload = backgroundTask?.suspendPayload;

  let argSlot = null;

  try {
    const { __mastraMetadata: _, _background, ...formattedArgs } = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <CodeEditor data={formattedArgs} />;
  } catch {
    argSlot = (
      <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{args as unknown as string}</pre>
    );
  }

  const resultSlot =
    typeof result === 'string' ? (
      <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{result}</pre>
    ) : (
      <CodeEditor data={result} />
    );

  const suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload as Record<string, unknown> | Record<string, unknown>[] | undefined} />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Background Task Metadata</DialogTitle>
          <DialogDescription>View the metadata of the background task.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Txt className="text-neutral3">Background Task Duration</Txt>
            <Txt className="text-ui-md text-neutral6">{toSigFigs(timeDiff, 3)}ms</Txt>
          </div>

          <div className="space-y-2">
            <Txt className="text-neutral3">Background Task Arguments</Txt>
            {argSlot}
          </div>

          {suspendPayloadSlot !== undefined && suspendPayload && (
            <div className="space-y-2">
              <Txt className="text-neutral3">Background Task Suspend Data</Txt>
              {suspendPayloadSlot}
            </div>
          )}

          {resultSlot !== undefined && result && (
            <div className="space-y-2">
              <Txt className="text-neutral3">Background Task Result</Txt>
              {resultSlot}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export interface BackgroundTaskMetadataDialogTriggerProps {
  details?: BackgroundTaskDetails;
  backgroundTask: {
    taskId: string;
    startedAt: Date;
    completedAt?: Date;
    suspendedAt?: Date;
  };
}

export const BackgroundTaskMetadataDialogTrigger = ({
  backgroundTask,
  details,
}: BackgroundTaskMetadataDialogTriggerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        variant="default"
        size="icon-md"
        tooltip="Show background task information"
        onClick={() => setIsOpen(s => !s)}
      >
        {backgroundTask.completedAt || backgroundTask.suspendedAt ? (
          <Share2 className="text-neutral3 size-5" />
        ) : (
          <Loader2Icon className="text-neutral3 size-5 animate-spin" />
        )}
      </Button>

      <BackgroundTaskMetadata
        backgroundTaskTaskId={backgroundTask.taskId}
        details={details}
        backgroundTaskStartedAt={backgroundTask.startedAt}
        backgroundTaskCompletedAt={backgroundTask.completedAt}
        backgroundTaskSuspendedAt={backgroundTask.suspendedAt}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
