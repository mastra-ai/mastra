import type { WorkflowAction } from 'core';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Icon } from '@/app/components/icon';

import { DeleteWorkflowActionDropdownButton } from '../utils/delete-workflow-action-dropdown-button';

interface WorkflowBlockDropdownProps {
  action: WorkflowAction;
  deleteOnlyBlock?: boolean;
}

export const WorkflowBlockDropdown = ({ action, deleteOnlyBlock }: WorkflowBlockDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="text-muted-foreground ml-auto hover:text-white" variant={'ghost'} size={'icon'}>
          <Icon name="dot-menu-sleep" className="text-current" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DeleteWorkflowActionDropdownButton action={action} deleteOnlyBlock={deleteOnlyBlock} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
