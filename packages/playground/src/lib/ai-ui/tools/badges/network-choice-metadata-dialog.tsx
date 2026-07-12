import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Share2 } from 'lucide-react';
import { useState } from 'react';

interface NetworkChoiceMetadataProps {
  selectionReason: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input?: string | Record<string, unknown>;
}

const NetworkChoiceMetadata = ({ selectionReason, open, onOpenChange, input }: NetworkChoiceMetadataProps) => {
  let inputSlot = null;

  if (input) {
    try {
      inputSlot = typeof input === 'object' ? <CodeEditor data={input} /> : <CodeEditor data={JSON.parse(input)} />;
    } catch {
      inputSlot = <pre className="whitespace-pre-wrap">{input as string}</pre>;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent Network Metadata</DialogTitle>
          <DialogDescription>View the metadata of the agent's network choice.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Txt className="text-neutral3">Selection Reason</Txt>
            <div className="text-ui-md text-neutral6">{selectionReason}</div>
          </div>

          {inputSlot && (
            <div className="space-y-2">
              <Txt className="text-neutral3">Input</Txt>
              <div className="text-ui-md text-neutral6">{inputSlot}</div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export interface NetworkChoiceMetadataDialogTriggerProps {
  selectionReason: string;
  input?: string | Record<string, unknown>;
}

export const NetworkChoiceMetadataDialogTrigger = ({
  selectionReason,
  input,
}: NetworkChoiceMetadataDialogTriggerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="default" size="icon-md" tooltip="Show selection reason" onClick={() => setIsOpen(s => !s)}>
        <Share2 className="size-5 text-neutral3" />
      </Button>

      <NetworkChoiceMetadata
        selectionReason={selectionReason || ''}
        open={isOpen}
        onOpenChange={setIsOpen}
        input={input}
      />
    </>
  );
};
