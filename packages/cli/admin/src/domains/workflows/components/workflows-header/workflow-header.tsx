'use client';

import type { Blueprint, WorkflowAction } from '@mastra/core/dist/workflows/types';

import { useRouter } from 'next/navigation';

import { Icon } from '@/components/icon';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';

import { isObjectEmpty } from '@/lib/object';
import { toast } from '@/lib/toast';

import { useWorkflowContext } from '../../context/workflow-context';
import { useManageWorkflow } from '../../hooks/use-manage-workflow';
import { useUpdateWorkflow } from '../../hooks/use-workflow';
import { WorkflowStatusEnum } from '../../types';
import { workflowStatusColorMap, workflowStatusTextMap } from '../../utils';
import { DeleteWorkflowDialog } from '../dialogs/delete-workflow-dialog';
import WorkflowHeaderLoader from '../workflow-loader/workflow-header-loader';

interface WorkflowHeader {
  blueprintId: string;
}

const WorkflowHeader = ({ blueprintId }: WorkflowHeader) => {
  const router = useRouter();
  const {
    blueprintInfo,
    constructedBlueprint,
    currentLocalBlueprint,
    updateBlueprintInfo,
    actionsValidityObject,
    isTriggerValid,
    actions,
    trigger,
    setSelectedBlock,
    setAttempedPublish,
  } = useWorkflowContext();
  const { deleteWorkflowId, handleCloseDeleteWorkflow, handleDeleteWorkflow } = useManageWorkflow();

  const { updateBlueprint } = useUpdateWorkflow({ blueprintId });

  const handleOnDelete = () => {
    router.push(`/workflows`);
  };

  if (blueprintId !== blueprintInfo?.id) {
    return <WorkflowHeaderLoader />;
  }

  const isPublished = constructedBlueprint.status === 'PUBLISHED';

  const existingInvalidActions = Object.entries(actionsValidityObject).filter(
    ([key, value]) => actions[key] && !value.isValid,
  );
  const existingActionsWithoutType = Object.entries(actions).filter(([key, value]) => !value.type);

  const allActionsValid = Object.entries(actionsValidityObject).every(([key, value]) =>
    actions[key] ? value.isValid : true,
  );

  const allActionsHaveType = existingActionsWithoutType?.length === 0;

  async function toggleWorkflowStatus() {
    const configurationDone = isTriggerValid && allActionsValid && allActionsHaveType && !isObjectEmpty(actions);
    setAttempedPublish(true);
    if (!configurationDone && !isPublished) {
      toast('Please finish your workflow configuration before publishing it');
      if (!isTriggerValid) {
        setSelectedBlock({ type: 'trigger', block: trigger });
      } else if (!allActionsValid) {
        const first = existingInvalidActions[0][0];
        setSelectedBlock({ type: 'action', block: actions[first] as WorkflowAction });
      } else if (!allActionsHaveType) {
        const first = existingActionsWithoutType[0][0];
        setSelectedBlock({ type: 'action', block: actions[first] as WorkflowAction });
      }
      return;
    }

    const updatedBlueprint: Blueprint = {
      ...constructedBlueprint,
      updatedAt: new Date(),
      status: isPublished ? WorkflowStatusEnum.UNPUBLISHED : WorkflowStatusEnum.PUBLISHED,
    };

    updateBlueprintInfo({ ...blueprintInfo, status: updatedBlueprint.status, updatedAt: updatedBlueprint.updatedAt });
    await updateBlueprint(updatedBlueprint);
  }

  const status = currentLocalBlueprint?.status || constructedBlueprint?.status;

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
      <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
        <Breadcrumb
          items={[
            {
              label: 'Workflows',
              href: `/workflows`,
              isCurrent: false,
            },
            {
              label: constructedBlueprint?.title || 'New Workflow',
              href: `/workflows/${constructedBlueprint?.id}`,
              isCurrent: true,
            },
          ]}
          pageClassName="whitespace-nowrap"
        />

        <Dropdown>
          <Dropdown.Trigger asChild>
            <Button
              data-testid="workflow-header-dropdown-trigger"
              className="text-muted-foreground hover:text-white"
              variant={'ghost'}
              size={'icon'}
            >
              <Icon name="dot-menu-sleep" className="text-current" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Content>
            <Dropdown.Item
              data-testid="trigger-delete-workflow"
              onClick={() => handleDeleteWorkflow(constructedBlueprint?.id)}
              className="!text-red-400"
            >
              Delete workflow
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="xs"
          variant="ghost"
          className="bg-mastra-bg-7 border-mastra-border-4 rounded-[0.1875rem] border-[0.5px] border-solid text-xs opacity-80 transition-opacity hover:opacity-100"
          onClick={() => toggleWorkflowStatus()}
        >
          {isPublished ? 'Unpublish' : 'Publish'}
        </Button>
        <Button size="xs" variant="outline" className="flex gap-2">
          <span
            style={{
              backgroundColor: workflowStatusColorMap[status],
            }}
            className={`h-[0.56rem] w-[0.56rem] rounded-full`}
          ></span>
          <span className="text-xs">{workflowStatusTextMap[status]}</span>
        </Button>
      </div>

      <DeleteWorkflowDialog
        isOpen={!!deleteWorkflowId}
        blueprintId={deleteWorkflowId!}
        setOpen={handleCloseDeleteWorkflow}
        onDelete={handleOnDelete}
      />
    </div>
  );
};

export default WorkflowHeader;
