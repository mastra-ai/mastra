import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Icon } from '@/app/components/icon';

import { AutomationAction, AutomationLogicConditionGroup } from '../../types';
import { DeleteWorkflowConditionPathDropdownButton } from '../utils/delete-workflow-condition-path-dropdown-button';

interface WorkflowPathDropdownProps {
  parentAction: AutomationAction;
  conditionGroup: AutomationLogicConditionGroup;
}

export const WorkflowPathDropdown = ({ parentAction, conditionGroup }: WorkflowPathDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="text-muted-foreground ml-auto hover:text-white" variant={'ghost'} size={'icon'}>
          <Icon name="dot-menu-sleep" className="text-current" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DeleteWorkflowConditionPathDropdownButton parentAction={parentAction} conditionGroup={conditionGroup} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
