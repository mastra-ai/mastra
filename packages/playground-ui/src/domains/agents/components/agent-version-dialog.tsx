import {
  SideDialog,
  SideDialogHeader,
  SideDialogContent,
  SideDialogTop,
  SideDialogKeyValueList,
  SideDialogSection,
} from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { ChevronRightIcon, DatabaseIcon, FileTextIcon, Trash2Icon } from 'lucide-react';
import { Label } from '@/components/ui/label';

import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import MarkdownRenderer from '@/components/ui/markdown-renderer';

type DialogMode = 'view' | 'save' | 'delete';

type AgentVersionDialogProps = {
  initialMode?: DialogMode;
  traceId?: string;
  isOpen: boolean;
  onClose?: () => void;
  onCreate?: (dataset: any) => void;
  version?: any;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
};

export function AgentVersionDialog({
  initialMode = 'view' as DialogMode,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  version,
}: AgentVersionDialogProps) {
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const isFormMode = ['create', 'edit'].includes(mode);
  const [targetDataset, setTargetDataset] = useState<string>('');
  const [confirmationIsOpen, setConfirmationIsOpen] = useState<boolean>(false);

  const handleDeleteRequest = () => {
    setConfirmationIsOpen(true);
  };

  const handleDelete = () => {
    // if (item?.id) {
    //  // removeItem?.(item?.id);
    setConfirmationIsOpen(false);
    onClose?.();
    // }
  };

  return (
    <>
      <SideDialog dialogTitle="Dataset Details" isOpen={isOpen} onClose={onClose}>
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={mode === 'view'}>
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">
            {['edit', 'view', 'delete', 'create'].includes(mode) && (
              <>
                <DatabaseIcon /> <span className="truncate max-w-[8rem]">sdfad</span>
                <ChevronRightIcon />
                {['edit', 'view', 'delete'].includes(mode) && (
                  <>
                    <FileTextIcon />
                    <span className="truncate">{version?.id?.split('-')[0]}</span>
                  </>
                )}
                {['create'].includes(mode) && (
                  <>
                    <span className="truncate">New item</span>
                  </>
                )}
              </>
            )}
          </div>
        </SideDialogTop>
        <SideDialogContent isCentered={mode === 'delete'}>
          <SideDialogHeader>
            <h2>Version details</h2>
            <div className="flex items-center gap-[.5rem]">
              <Button onClick={handleDeleteRequest} variant="outline">
                Delete
                <Trash2Icon />
              </Button>
            </div>
          </SideDialogHeader>
          <div className="flex ">
            <SideDialogKeyValueList
              className="border-r border-border1 pr-[2rem] mr-[2rem]"
              items={[
                {
                  key: 'Temperature',
                  value: `n/a`,
                },
                {
                  key: 'Top P',
                  value: `n/a`,
                },
                {
                  key: 'Top K',
                  value: `n/a`,
                },
                {
                  key: 'Frequency penalty',
                  value: `n/a`,
                },
              ]}
            />
            <SideDialogKeyValueList
              items={[
                {
                  key: 'Max tokens',
                  value: `n/a`,
                },
                {
                  key: 'Max steps',
                  value: `n/a`,
                },
                {
                  key: 'Max retries',
                  value: `n/a`,
                },
              ]}
            />
          </div>
          <SideDialogSection>
            <h3>Instructions</h3>
            <div className="font-mono text-[0.8125rem] text-[#ccc]">
              {version?.instructions && (
                <MarkdownRenderer className="[&_p]:leading-[1.6]">{version.instructions}</MarkdownRenderer>
              )}
            </div>
          </SideDialogSection>
        </SideDialogContent>
      </SideDialog>
      <SideDialog
        dialogTitle="Deleting Dataset Item Confirmation"
        variant="confirmation"
        isOpen={confirmationIsOpen}
        onClose={() => setConfirmationIsOpen(false)}
      >
        <SideDialogContent isCentered>
          <div className="min-h-auto h-[60vh] ">
            <div className="border border-icon2 p-[2.5rem] py-[1.75rem] rounded-lg grid gap-[1rem] bg-surface4 max-w-[30rem] ">
              <h3 className="text-[1rem]">Delete Dataset Item</h3>
              <p className="text-[0.875rem] text-icon4">
                Are you sure you want to delete this item? This action cannot be undone.
              </p>
              <div className="flex justify-between w-full gap-[1rem] mt-[1rem]">
                <Button onClick={handleDelete} variant="outline">
                  Delete <Trash2Icon />
                </Button>
                <Button onClick={() => setConfirmationIsOpen(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </SideDialogContent>
      </SideDialog>
    </>
  );
}
