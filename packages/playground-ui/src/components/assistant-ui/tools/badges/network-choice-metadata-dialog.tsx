import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Txt } from '@/ds/components/Txt';
import { SyntaxHighlighter } from '@/components/ui/syntax-highlighter';
import { TooltipIconButton } from '../../tooltip-icon-button';
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
      inputSlot =
        typeof input === 'object' ? <SyntaxHighlighter data={input} /> : <SyntaxHighlighter data={JSON.parse(input)} />;
    } catch {
      inputSlot = <pre className="whitespace-pre-wrap">{input as string}</pre>;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border1 border-sm bg-surface3 p-0 gap-0">
        <DialogHeader className="p-4">
          <DialogTitle>Agent Network Metadata</DialogTitle>
          <DialogDescription>View the metadata of the agent's network choice.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4 border-t-sm border-border1">
          <div className="space-y-2">
            <Txt className="text-icon3">Selection Reason</Txt>
            <div className="text-icon6 text-ui-md">{selectionReason}</div>
          </div>

          {inputSlot && (
            <div className="space-y-2">
              <Txt className="text-icon3">Input</Txt>
              <div className="text-icon6 text-ui-md">{inputSlot}</div>
            </div>
          )}
        </div>
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
      <TooltipIconButton tooltip="Show selection reason" side="top" onClick={() => setIsOpen(s => !s)}>
        <Share2 className="text-icon3 size-5" />
      </TooltipIconButton>

      <NetworkChoiceMetadata
        selectionReason={selectionReason || ''}
        open={isOpen}
        onOpenChange={setIsOpen}
        input={input}
      />
    </>
  );
};
