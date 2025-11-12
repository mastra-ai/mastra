import { SideDialog, TextareaField, FormActions, KeyValueList, TextAndIcon } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { DatabaseIcon, EditIcon, FileInputIcon, FileTextIcon, HashIcon, Trash2Icon } from 'lucide-react';

import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DatasetRecord, DatasetRow } from '@mastra/client-js';
import { Sections } from '@/index';
import { useLinkComponent } from '@/lib/framework';
import {
  useDatasetRowsAdd,
  useDatasetRowsDelete,
  useDatasetRowsUpdate,
} from '@/domains/datasets/hooks/use-dataset-rows';

type DialogMode = 'view' | 'create' | 'edit' | 'save' | 'delete';

type DatasetRowDialogProps = {
  initialMode?: DialogMode;
  dataset?: DatasetRecord | null;
  row?: DatasetRow;
  traceId?: string;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  removeItem?: (id: string) => void;
};

export function DatasetRowDialog({
  initialMode = 'view' as DialogMode,
  dataset,
  isOpen,
  row,
  onClose,
  onNext,
  onPrevious,
  traceId,
}: DatasetRowDialogProps) {
  const { mutateAsync: deleteDatasetRows } = useDatasetRowsDelete(dataset?.id!);
  const { mutateAsync: addDatasetRows } = useDatasetRowsAdd(dataset?.id!);
  const { mutateAsync: useDatasetRows } = useDatasetRowsUpdate(dataset?.id!);
  const { Link } = useLinkComponent();
  const [mode, setMode] = useState<DialogMode>(initialMode);

  const isEditMode = mode === 'edit';
  const isCreateMode = mode === 'create';
  const isViewMode = mode === 'view';
  const isDeleteMode = mode === 'delete';

  const [formRow, setFormRow] = useState<{ input: string; groundTruth: string; requestContext: string }>({
    input: '',
    groundTruth: '',
    requestContext: '',
  });

  useEffect(() => {
    if (isOpen && !row) {
      setFormRow({ input: '', groundTruth: '', requestContext: '' });
      setMode('create');
    } else if (isOpen && row) {
      setMode('view');
    }
  }, [row, isOpen]);

  const handleDelete = () => {
    setMode('delete');
  };

  const handleDeleteConfirmation = async () => {
    try {
      const result = await deleteDatasetRows({ rowIds: [row!.rowId] });
      console.log('Dataset Item Deleted:', result);
      onClose?.();
    } catch (error) {
      console.error('Failed to delete dataset item:', error);
    }
  };

  const handleEdit = async () => {
    setMode('edit');
    setFormRow({
      input: row?.input,
      groundTruth: row?.groundTruth,
      requestContext: row?.requestContext ? JSON.stringify(row?.requestContext, null, 2) : '',
    });
  };

  const handleUpdate = async () => {
    try {
      const result = await useDatasetRows({
        updates: [
          {
            rowId: row?.rowId!,
            input: formRow?.input,
            groundTruth: formRow?.groundTruth,
            requestContext: formRow?.requestContext ? JSON.parse(formRow.requestContext) : undefined,
          },
        ],
      });
      console.log('Dataset item updated:', result);
      onClose?.();
    } catch (error) {
      console.error('Failed to update dataset item:', error);
    }
  };

  const handleAdd = async () => {
    try {
      const result = await addDatasetRows({
        rows: [
          {
            input: formRow?.input,
            groundTruth: formRow?.groundTruth,
            requestContext: formRow?.requestContext ? JSON.parse(formRow.requestContext) : undefined,
          },
        ],
      });
      console.log('Dataset item created:', result);
      onClose?.();
    } catch (error) {
      console.error('Failed to create dataset item:', error);
    }
  };

  const handleCancel = () => {
    if (isDeleteMode) {
      setMode('view');
      return;
    }

    if (isEditMode) {
      setMode('view');
      setFormRow({ input: '', groundTruth: '', requestContext: '' });
      return;
    }

    return onClose?.();
  };

  return (
    <>
      <SideDialog
        dialogTitle="Dataset Item Details"
        dialogDescription="Manage individual data items within your dataset. "
        isOpen={isOpen}
        onClose={onClose}
      >
        <SideDialog.Top>
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">
            {['edit', 'view', 'delete', 'create'].includes(mode) && (
              <>
                <TextAndIcon>
                  <DatabaseIcon /> <span className="truncate max-w-[8rem]">{dataset?.name}</span>
                </TextAndIcon>
                ›
                {['edit', 'view', 'delete'].includes(mode) && (
                  <TextAndIcon>
                    <FileTextIcon />
                    <span className="truncate">{row?.rowId?.split('-')[0]}</span>
                  </TextAndIcon>
                )}
                {['create'].includes(mode) && (
                  <TextAndIcon>
                    <span className="truncate">Add Item</span>
                  </TextAndIcon>
                )}
              </>
            )}
          </div>
          {isViewMode && (
            <>
              | <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
              <div className="flex items-center gap-[1rem] ml-auto mr-[1.5rem]">
                <Button onClick={handleEdit} variant="ghost">
                  Edit
                  <EditIcon />
                </Button>
                <Button onClick={handleDelete} variant="ghost">
                  Delete
                  <Trash2Icon />
                </Button>
              </div>
            </>
          )}
        </SideDialog.Top>

        <SideDialog.Content isFullHeight={isEditMode} className="relative">
          {(isViewMode || isDeleteMode) && (
            <>
              <div inert={isDeleteMode}>
                <SideDialog.Header>
                  <SideDialog.Heading>Dataset Item</SideDialog.Heading>
                  <TextAndIcon>
                    <HashIcon /> {row?.rowId}
                  </TextAndIcon>
                </SideDialog.Header>

                <Sections>
                  <KeyValueList
                    LinkComponent={Link}
                    data={[
                      { key: 'dataset', label: 'Dataset', value: dataset?.name || 'N/A' },
                      {
                        key: 'createdAt',
                        label: 'Created at',
                        value: row?.createdAt ? format(new Date(row.createdAt), 'LLL do yyyy, hh:mm bb') : 'N/A',
                      },
                      {
                        key: 'updatedAt',
                        label: 'Updated at',
                        value: row?.updatedAt ? format(new Date(row.updatedAt), 'LLL do yyyy, hh:mm bb') : 'N/A',
                      },
                    ]}
                  />
                  <SideDialog.CodeSection
                    title="Input"
                    icon={<FileInputIcon />}
                    codeStr={row?.input}
                    simplified={true}
                  />
                  <SideDialog.CodeSection
                    title="Input"
                    icon={<FileInputIcon />}
                    codeStr={row?.groundTruth}
                    simplified={true}
                  />
                  <SideDialog.CodeSection
                    title="Input"
                    icon={<FileInputIcon />}
                    codeStr={JSON.stringify(row?.requestContext || null, null, 2)}
                  />
                </Sections>
              </div>

              {isDeleteMode && (
                <div className="absolute top-0 left-0 w-full h-full bg-black/75 flex items-center justify-center pb-[5rem]">
                  <div className="border border-red-700 p-[2.5rem] py-[1.75rem] rounded-xl grid gap-[1rem] bg-surface4 max-w-[30rem] ">
                    <h3 className="text-[1rem]">Delete Dataset Item</h3>
                    <p className="text-[0.875rem] text-icon4 mb-[2rem]">
                      Are you sure you want to delete this item? This action cannot be undone.
                    </p>
                    <FormActions
                      onSubmit={handleDeleteConfirmation}
                      onCancel={handleCancel}
                      isSubmitting={false}
                      submitLabel="Delete"
                      cancelLabel="Cancel"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {(isEditMode || isCreateMode) && (
            <div className={cn('grid gap-[2rem]')}>
              <SideDialog.Header>
                <h2>{isCreateMode ? 'New Dataset Item' : 'Edit Dataset Item'}</h2>
              </SideDialog.Header>

              <TextareaField
                label="Input"
                value={formRow?.input}
                onChange={e => setFormRow({ ...formRow, input: e.target.value })}
              />

              <TextareaField
                label="Ground Truth"
                value={formRow?.groundTruth}
                onChange={e => setFormRow({ ...formRow, groundTruth: e.target.value })}
              />

              <TextareaField
                label="requestContext"
                value={formRow?.requestContext}
                onChange={e => setFormRow({ ...formRow, requestContext: e.target.value })}
              />

              <FormActions
                onSubmit={isEditMode ? handleUpdate : handleAdd}
                onCancel={handleCancel}
                isSubmitting={false}
                submitLabel="Submit"
                cancelLabel="Cancel"
              />
            </div>
          )}
        </SideDialog.Content>
      </SideDialog>
    </>
  );
}
