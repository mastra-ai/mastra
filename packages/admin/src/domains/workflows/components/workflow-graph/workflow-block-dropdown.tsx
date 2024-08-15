import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Icon } from '@/app/components/icon';

import { AutomationAction } from '../../types';
import { DeleteWorkflowActionDropdownButton } from '../utils/delete-workflow-action-dropdown-button';

interface WorkflowBlockDropdownProps {
  action: AutomationAction;
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
