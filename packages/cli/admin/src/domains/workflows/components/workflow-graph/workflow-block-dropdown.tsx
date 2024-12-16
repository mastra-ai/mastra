import type { WorkflowAction } from '@mastra/core';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';

import { DeleteWorkflowActionDropdownButton } from '../utils/delete-workflow-action-dropdown-button';

interface WorkflowBlockDropdownProps {
  action: WorkflowAction;
  deleteOnlyBlock?: boolean;
}

export const WorkflowBlockDropdown = ({ action, deleteOnlyBlock }: WorkflowBlockDropdownProps) => {
  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button className="text-muted-foreground ml-auto hover:text-white" variant={'ghost'} size={'icon'}>
          <Icon name="dot-menu-sleep" className="text-current" />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Content align="start">
        <DeleteWorkflowActionDropdownButton action={action} deleteOnlyBlock={deleteOnlyBlock} />
      </Dropdown.Content>
    </Dropdown>
  );
};
