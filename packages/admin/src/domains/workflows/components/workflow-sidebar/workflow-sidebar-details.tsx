'use client';

import { Blueprint } from '@mastra/core';
import { useDebouncedCallback } from 'use-debounce';

import { useParams, useRouter } from 'next/navigation';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { TextareaWithAutoResize } from '@/components/ui/textarea-with-autoresize';

import { useWorkflowContext } from '../../context/workflow-context';
import { useManageWorkflow } from '../../hooks/use-manage-workflow';
import { useUpdateWorkflow } from '../../hooks/use-workflow';
import { DeleteWorkflowDialog } from '../dialogs/delete-workflow-dialog';

export function WorkflowSidebarDetails() {
  const { updateBlueprintInfo, blueprintInfo, constructedBlueprint } = useWorkflowContext();
  const { blueprintId } = useParams() as { blueprintId: string };
  const router = useRouter();
  const { deleteWorkflowId, handleCloseDeleteWorkflow, handleDeleteWorkflow } = useManageWorkflow();

  const { updateBlueprint } = useUpdateWorkflow({ blueprintId });

  const handleOnDelete = () => {
    router.push(`/workflows`);
  };

  const handleUpdateTitle = useDebouncedCallback(title => {
    const updatedBlueprint: Blueprint = {
      ...constructedBlueprint,
      title,
      updatedAt: new Date(),
    };
    updateBlueprintInfo({ ...blueprintInfo, title, updatedAt: updatedBlueprint.updatedAt });
    updateBlueprint(updatedBlueprint);
  }, 1000);

  const handleUpdateDescription = useDebouncedCallback(description => {
    const updatedBlueprint: Blueprint = {
      ...constructedBlueprint,
      description,
      updatedAt: new Date(),
    };
    updateBlueprintInfo({ ...blueprintInfo, description, updatedAt: updatedBlueprint.updatedAt });
    updateBlueprint(updatedBlueprint);
  }, 2000);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="border-mastra-border-1 flex flex-col gap-3 border-b-[0.3px] p-6">
          <div className="flex items-center gap-2">
            <span className="border-mastra-border-1 bg-mastra-bg-3 rounded-[0.3125rem] border p-2">
              <Icon name="workflow" className="text-icon" />
            </span>
            <Input
              value={blueprintInfo.title ?? ''}
              onChange={e => {
                updateBlueprintInfo({ ...blueprintInfo, title: e.target.value });
                handleUpdateTitle(e.target.value);
              }}
              data-testid="workflow-title-input"
              className="pl-0 text-base font-semibold"
              variant="unstyled"
            />

            <Dropdown>
              <Dropdown.Trigger asChild>
                <Button className="text-muted-foreground ml-auto hover:text-white" variant={'ghost'} size={'icon'}>
                  <Icon name="dot-menu-sleep" className="text-current" />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Content className="">
                <Dropdown.Item onClick={() => handleDeleteWorkflow(blueprintId)} className="!text-red-400">
                  Delete workflow
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown>
          </div>
          <TextareaWithAutoResize
            placeholder="Add a short description..."
            value={blueprintInfo.description ?? ''}
            onChange={e => {
              updateBlueprintInfo({ ...blueprintInfo, description: e.target.value });
              handleUpdateDescription(e.target.value);
            }}
            className="border-0 bg-transparent pl-1 text-base"
            variant="minimal"
            size="sm"
            maxHeight={200}
            data-testid="workflow-description-input"
          />
        </div>
      </div>
      <DeleteWorkflowDialog
        isOpen={!!deleteWorkflowId}
        blueprintId={deleteWorkflowId!}
        setOpen={handleCloseDeleteWorkflow}
        onDelete={handleOnDelete}
      />
    </>
  );
}
