import {
  Button,
  CodeEditor,
  Txt,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  toSigFigs,
} from '@mastra/playground-ui';
import { Loader2Icon, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTimeDiff } from '../../hooks/use-time-diff';
import { useGetBackgroundTaskById, useBackgroundTaskStream } from '@/hooks';

interface BackgroundTaskMetadataProps {
  backgroundTaskTaskId: string;
  backgroundTaskStartedAt: Date;
  backgroundTaskCompletedAt?: Date;
  backgroundTaskSuspendedAt?: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BackgroundTaskMetadata = ({
  backgroundTaskTaskId,
  backgroundTaskStartedAt,
  backgroundTaskCompletedAt,
  backgroundTaskSuspendedAt,
  open,
  onOpenChange,
}: BackgroundTaskMetadataProps) => {
  const { data: task } = useGetBackgroundTaskById(
    backgroundTaskTaskId,
    !!backgroundTaskCompletedAt || !!backgroundTaskSuspendedAt,
  );
  const { tasks } = useBackgroundTaskStream({
    taskId: backgroundTaskTaskId,
    enabled: !backgroundTaskCompletedAt && !backgroundTaskSuspendedAt,
  });

  const timeDiff = useTimeDiff({
    startedAt: new Date(backgroundTaskStartedAt).getTime(),
    endedAt: backgroundTaskCompletedAt
      ? new Date(backgroundTaskCompletedAt).getTime()
      : backgroundTaskSuspendedAt
        ? new Date(backgroundTaskSuspendedAt).getTime()
        : undefined,
  });

  const backgroundTask = task || tasks[backgroundTaskTaskId];

  const args = backgroundTask?.args;
  const result = backgroundTask?.result as any;
  const suspendPayload = backgroundTask?.suspendPayload;

  let argSlot = null;

  try {
    const { __mastraMetadata: _, _background, ...formattedArgs } = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <CodeEditor data={formattedArgs} />;
  } catch {
    argSlot = (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{args as unknown as string}</pre>
    );
  }

  const resultSlot =
    typeof result === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{result}</pre>
    ) : (
      <CodeEditor data={result} />
    );

  const suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload} />
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
            <Txt className="text-neutral6 text-ui-md">{toSigFigs(timeDiff, 3)}ms</Txt>
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
  backgroundTask: {
    taskId: string;
    startedAt: Date;
    completedAt?: Date;
    suspendedAt?: Date;
  };
}

export const BackgroundTaskMetadataDialogTrigger = ({ backgroundTask }: BackgroundTaskMetadataDialogTriggerProps) => {
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
        backgroundTaskStartedAt={backgroundTask.startedAt}
        backgroundTaskCompletedAt={backgroundTask.completedAt}
        backgroundTaskSuspendedAt={backgroundTask.suspendedAt}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
