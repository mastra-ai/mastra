import { useWorkflowContext } from '../../context/workflow-context';

import { RenderBlock } from './workflow-sidebar-block';
import { WorkflowSidebarDetails } from './workflow-sidebar-details';

export function WorkflowSidebar() {
  const { selectedBlock, constructedBlueprint } = useWorkflowContext();

  if (selectedBlock) {
    {
      /*this action/trigger block that was selected on the graph*/
    }
    return (
      <div className="flex h-full flex-col">
        <RenderBlock selectedBlock={selectedBlock} constructedBlueprint={constructedBlueprint} />
      </div>
    );
  }

  {
    /*this renders the workflow details which contains the title and description*/
  }
  return <WorkflowSidebarDetails />;
}
