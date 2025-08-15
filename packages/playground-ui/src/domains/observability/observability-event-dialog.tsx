import {
  SideDialog,
  SideDialogHeader,
  SideDialogTop,
  SideDialogContent,
  SideDialogSection,
} from '@/components/ui/elements';
import { FileInputIcon, FileOutputIcon } from 'lucide-react';

import { useState } from 'react';

type ObservabilityEventDialogProps = {
  event?: {
    id?: string;
    input?: string;
    output?: string;
    createdAt?: string;
  };

  isOpen: boolean;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
};

export function ObservabilityEventDialog({
  event,
  isOpen,
  onClose,
  onNext,
  onPrevious,
}: ObservabilityEventDialogProps) {
  const [confirmationIsOpen, setConfirmationIsOpen] = useState<boolean>(false);

  return (
    <>
      <SideDialog
        dialogTitle="Observability Event"
        isOpen={isOpen}
        onClose={onClose}
        hasCloseButton={!confirmationIsOpen}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{event?.id}</div>
        </SideDialogTop>

        <SideDialogContent>
          <>
            <SideDialogHeader>
              <h2>Observability Event</h2>
            </SideDialogHeader>

            <SideDialogSection>
              <h3>
                <FileInputIcon /> Input
              </h3>
              <div className="font-mono text-[0.8125rem] text-[#ccc]">{event?.input}</div>
            </SideDialogSection>
            <SideDialogSection>
              <h3>
                <FileOutputIcon />
                Output
              </h3>
              <div className="font-mono text-[0.8125rem] text-[#ccc] ">{event?.output}</div>
            </SideDialogSection>
          </>
        </SideDialogContent>
      </SideDialog>
    </>
  );
}
