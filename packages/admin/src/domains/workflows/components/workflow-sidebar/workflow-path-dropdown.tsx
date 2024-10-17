import { WorkflowAction, WorkflowLogicConditionGroup } from '@mastra/core';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';

import { DeleteWorkflowConditionPathDropdownButton } from '../utils/delete-workflow-condition-path-dropdown-button';

interface WorkflowPathDropdownProps {
  parentAction: WorkflowAction;
  conditionGroup: WorkflowLogicConditionGroup;
}

export const WorkflowPathDropdown = ({ parentAction, conditionGroup }: WorkflowPathDropdownProps) => {
  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button className="text-muted-foreground ml-auto hover:text-white" variant={'ghost'} size={'icon'}>
          <Icon name="dot-menu-sleep" className="text-current" />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Content align="start">
        <DeleteWorkflowConditionPathDropdownButton parentAction={parentAction} conditionGroup={conditionGroup} />
      </Dropdown.Content>
    </Dropdown>
  );
};
