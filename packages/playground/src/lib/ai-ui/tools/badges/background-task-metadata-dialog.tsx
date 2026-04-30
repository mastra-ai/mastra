import {
  CodeEditor,
  IconButton,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BackgroundTaskMetadata = ({
  backgroundTaskTaskId,
  backgroundTaskStartedAt,
  backgroundTaskCompletedAt,
  open,
  onOpenChange,
}: BackgroundTaskMetadataProps) => {
  const { data: task } = useGetBackgroundTaskById(backgroundTaskTaskId, !!backgroundTaskCompletedAt);
  const { tasks } = useBackgroundTaskStream({
    taskId: backgroundTaskTaskId,
    enabled: !backgroundTaskCompletedAt,
  });
  const timeDiff = useTimeDiff({
    startedAt: new Date(backgroundTaskStartedAt).getTime(),
    endedAt: backgroundTaskCompletedAt ? new Date(backgroundTaskCompletedAt).getTime() : undefined,
  });

  const backgroundTask = task || tasks[backgroundTaskTaskId];

  const args = backgroundTask?.args;
  const result = backgroundTask?.result as any;

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
  backgroundTaskTaskId: string;
  backgroundTaskStartedAt: Date;
  backgroundTaskCompletedAt?: Date;
}

export const BackgroundTaskMetadataDialogTrigger = ({
  backgroundTaskTaskId,
  backgroundTaskStartedAt,
  backgroundTaskCompletedAt,
}: BackgroundTaskMetadataDialogTriggerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <IconButton
        variant="light"
        size="md"
        tooltip="Show background task information"
        onClick={() => setIsOpen(s => !s)}
      >
        {backgroundTaskCompletedAt ? (
          <Share2 className="text-neutral3 size-5" />
        ) : (
          <Loader2Icon className="text-neutral3 size-5 animate-spin" />
        )}
      </IconButton>

      <BackgroundTaskMetadata
        backgroundTaskTaskId={backgroundTaskTaskId}
        backgroundTaskStartedAt={backgroundTaskStartedAt}
        backgroundTaskCompletedAt={backgroundTaskCompletedAt}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
