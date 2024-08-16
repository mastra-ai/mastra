import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { TextareaWithAutoResize } from '@/components/ui/textarea-with-autoresize';

import { Icon } from '@/app/components/icon';

import { useWorkflowContext } from '../../context/workflow-context';
import { useManageWorkflow } from '../../hooks/use-manage-workflow';
import { DeleteWorkflowDialog } from '../dialogs/delete-workflow-dialog';

export function WorkflowSidebarDetails() {
  const { updateBlueprintInfo, blueprintInfo } = useWorkflowContext();
  const { blueprintId } = useParams() as { blueprintId: string };
  const router = useRouter();
  const { deleteWorkflowId, handleCloseDeleteWorkflow, handleDeleteWorkflow } = useManageWorkflow();

  const handleOnDelete = () => {
    router.push(`/workflows`);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="border-kp-border-1 flex flex-col gap-3 border-b-[0.3px] p-6">
          <div className="flex items-center gap-2">
            <span className="border-kp-border-1 bg-kp-bg-3 rounded-[0.3125rem] border p-2">
              <Icon name="workflow" className="text-icon" />
            </span>
            <Input
              value={blueprintInfo.title}
              onChange={e => {
                updateBlueprintInfo({ ...blueprintInfo, title: e.target.value });
                //write to temp file
              }}
              data-testid="workflow-title-input"
              className="pl-0 text-base font-semibold"
              variant="unstyled"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="text-muted-foreground ml-auto hover:text-white" variant={'ghost'} size={'icon'}>
                  <Icon name="dot-menu-sleep" className="text-current" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="">
                <DropdownMenuItem onClick={() => handleDeleteWorkflow(blueprintId)} className="!text-red-400">
                  Delete workflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <TextareaWithAutoResize
            placeholder="Add a short description..."
            value={blueprintInfo.description ?? undefined}
            onChange={e => {
              updateBlueprintInfo({ ...blueprintInfo, description: e.target.value });
              //write to temp file
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
