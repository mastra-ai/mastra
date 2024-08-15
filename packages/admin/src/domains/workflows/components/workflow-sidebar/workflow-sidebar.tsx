import { useWorkflowContext } from '../../context/workflow-context';

import { WorkflowSidebarDetails } from './workflow-sidebar-details';

export function WorkflowSidebar() {
  const { selectedBlock } = useWorkflowContext();

  if (selectedBlock) {
    {
      /*this action/trigger block that was selected on the graph*/
    }
    return <div className="flex h-full flex-col"></div>;
  }

  {
    /*this renders the workflow details which contains the title and description*/
  }
  return <WorkflowSidebarDetails />;
}
