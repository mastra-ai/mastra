import {
  SideDialog,
  SideDialogHeader,
  SideDialogTop,
  SideDialogContent,
  SideDialogSection,
  SideDialogKeyValueList,
  TextareaField,
  InputField,
  FormActions,
} from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import {
  ChevronRightIcon,
  DatabaseIcon,
  EditIcon,
  FileInputIcon,
  FileOutputIcon,
  FileTextIcon,
  Trash2Icon,
} from 'lucide-react';

import { format } from 'date-fns';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { type Dataset } from './shared';

type DialogMode = 'view' | 'create' | 'edit' | 'save';

type DatasetItemDialogProps = {
  initialMode?: DialogMode;
  dataset?: Dataset;
  item?: {
    id?: string;
    input?: string;
    output?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  traceId?: string;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  removeItem?: (id: string) => void;
};

export function DatasetItemDialog({
  initialMode = 'view' as DialogMode,
  dataset,
  isOpen,
  item,
  onClose,
  onNext,
  onPrevious,
  traceId,
  removeItem,
}: DatasetItemDialogProps) {
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const isFormMode = ['create', 'edit', 'save'].includes(mode);
  const [targetDataset, setTargetDataset] = useState<string>('');
  const [confirmationIsOpen, setConfirmationIsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && !item) {
      setMode('create');
    } else if (isOpen && item) {
      setMode('view');
    }
  }, [item, isOpen]);

  const handleDeleteRequest = () => {
    setConfirmationIsOpen(true);
  };

  const handleDelete = () => {
    if (item?.id) {
      removeItem?.(item?.id);
      setConfirmationIsOpen(false);
      onClose?.();
    }
  };

  const handleEdit = () => {
    // Handle edit logic here
    setMode('edit');
    // onClose?.();
  };

  const handleCancel = () => {
    onClose?.();
    setMode('view');
  };

  return (
    <>
      <SideDialog
        dialogTitle="Dataset Item Details"
        isOpen={isOpen}
        onClose={onClose}
        hasCloseButton={!confirmationIsOpen}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={mode === 'view'}>
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">
            {['edit', 'view', 'delete', 'create'].includes(mode) && (
              <>
                <DatabaseIcon /> <span className="truncate max-w-[8rem]">{dataset?.name}</span>
                <ChevronRightIcon />
                {['edit', 'view', 'delete'].includes(mode) && (
                  <>
                    <FileTextIcon />
                    <span className="truncate">{item?.id?.split('-')[0]}</span>
                  </>
                )}
                {['create'].includes(mode) && (
                  <>
                    <span className="truncate">New data</span>
                  </>
                )}
              </>
            )}
          </div>
        </SideDialogTop>

        <SideDialogContent isFullHeight={isFormMode}>
          {mode === 'view' && (
            <>
              <SideDialogHeader>
                <h2>Dataset Item Details</h2>
                <div className="flex items-center gap-[.5rem]">
                  <Button onClick={handleEdit} variant="outline">
                    Edit
                    <EditIcon />
                  </Button>
                  <Button onClick={handleDeleteRequest} variant="outline">
                    Delete
                    <Trash2Icon />
                  </Button>
                </div>
              </SideDialogHeader>

              <SideDialogKeyValueList
                items={[
                  { key: 'Id', value: item?.id || 'N/A' },
                  { key: 'Dataset', value: dataset?.name || 'N/A' },
                  {
                    key: 'Created at',
                    value: item?.createdAt ? format(new Date(item.createdAt), 'LLL do yyyy, hh:mm bb') : 'N/A',
                  },
                  {
                    key: 'Updated at',
                    value: item?.updatedAt ? format(new Date(item.updatedAt), 'LLL do yyyy, hh:mm bb') : 'N/A',
                  },
                  { key: 'Source', value: traceId || 'N/A' },
                ]}
              />

              <SideDialogSection>
                <h3>
                  <FileInputIcon /> Input
                </h3>
                <div className="font-mono text-[0.8125rem] text-[#ccc]">
                  {item?.input && <MarkdownRenderer className="[&_p]:leading-[1.6]">{item.input}</MarkdownRenderer>}
                </div>
              </SideDialogSection>
              <SideDialogSection>
                <h3>
                  <FileOutputIcon />
                  Output
                </h3>
                <div className="font-mono text-[0.8125rem] text-[#ccc] ">
                  {item?.output && <MarkdownRenderer className="[&_p]:leading-[1.6]">{item.output}</MarkdownRenderer>}
                </div>
              </SideDialogSection>
            </>
          )}

          {isFormMode && (
            <div
              className={cn('grid grid-rows-[auto_auto_1fr_2fr_auto] gap-[2rem]', {
                'grid-rows-[auto_1fr_2fr_auto]': mode === 'create',
              })}
            >
              <SideDialogHeader>
                {mode === 'create' && <h2>Add a new data Item to the Dataset</h2>}
                {mode === 'edit' && <h2>Edit Dataset Item</h2>}
              </SideDialogHeader>

              {mode === 'save' && (
                <div className="flex items-baseline gap-[1rem]">
                  <label
                    htmlFor="select-dataset"
                    className="text-icon3 text-[0.875rem] font-semibold whitespace-nowrap"
                  >
                    Dataset
                  </label>
                  <Select
                    name="select-dataset"
                    value={targetDataset}
                    defaultValue="1"
                    onValueChange={value => {
                      setTargetDataset(value);
                    }}
                  >
                    <SelectTrigger id="select-dataset" className="w-full">
                      <SelectValue placeholder="Select a dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="1" value="1">
                        My first Dataset
                      </SelectItem>
                      <SelectItem key="2" value="2">
                        My second Dataset
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mode === 'edit' && <InputField label="Name" value={item?.id} disabled />}
              <TextareaField label="Input" value={item?.input} />
              <TextareaField label="Output" value={item?.output} />
              <FormActions
                onSubmit={handleCancel}
                onCancel={handleCancel}
                isSubmitting={false}
                submitLabel="Save"
                cancelLabel="Cancel"
              />
            </div>
          )}
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
                <Button onClick={() => setConfirmationIsOpen(false)}>Cancel</Button>
                <Button onClick={handleDelete} variant="primary">
                  Delete <Trash2Icon />
                </Button>
              </div>
            </div>
          </div>
        </SideDialogContent>
      </SideDialog>
    </>
  );
}
