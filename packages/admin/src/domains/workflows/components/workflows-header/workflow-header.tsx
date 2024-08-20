import { useRouter } from 'next/navigation';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Icon } from '@/app/components/icon';

import { useWorkflowContext } from '../../context/workflow-context';
import { useManageWorkflow } from '../../hooks/use-manage-workflow';
import { workflowStatusColorMap, workflowStatusTextMap } from '../../utils';
import { DeleteWorkflowDialog } from '../dialogs/delete-workflow-dialog';
import WorkflowHeaderLoader from '../workflow-loader/workflow-header-loader';

interface WorkflowHeader {
  blueprintId: string;
}

const WorkflowHeader = ({ blueprintId }: WorkflowHeader) => {
  const router = useRouter();
  const { blueprintInfo, constructedBlueprint } = useWorkflowContext();
  const { deleteWorkflowId, handleCloseDeleteWorkflow, handleDeleteWorkflow } = useManageWorkflow();

  const handleOnDelete = () => {
    router.push(`/workflows`);
  };

  if (blueprintId !== blueprintInfo?.id) {
    return <WorkflowHeaderLoader />;
  }

  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="workflow-header-dropdown-trigger"
              className="text-muted-foreground hover:text-white"
              variant={'ghost'}
              size={'icon'}
            >
              <Icon name="dot-menu-sleep" className="text-current" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              data-testid="trigger-delete-workflow"
              onClick={() => handleDeleteWorkflow(constructedBlueprint?.id)}
              className="!text-red-400"
            >
              Delete workflow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button size="xs" variant="outline" className="flex gap-2">
        <span
          style={{
            backgroundColor: workflowStatusColorMap[constructedBlueprint?.status],
          }}
          className={`h-[0.56rem] w-[0.56rem] rounded-full`}
        ></span>
        <span className="text-xs">{workflowStatusTextMap[constructedBlueprint?.status]}</span>
      </Button>

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
