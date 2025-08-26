import { GetVNextNetworkResponse } from '@mastra/client-js';
import { WorkflowIcon } from '@mastra/playground-ui';

export function NetworkWorkflows({ network }: { network: GetVNextNetworkResponse }) {
  if (!network.workflows || network.workflows.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-mastra-el-4">No workflows found in this network.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-mastra-el-5 mb-3">Network Workflows</h3>
      <div className="space-y-3">
        {network.workflows.map(workflow => (
          <div key={workflow.name} className="bg-mastra-bg-2 py-2 px-3 rounded-md">
            <div className="flex justify-between items-center">
              <div className="flex gap-1 items-center">
                <WorkflowIcon className="h-3 w-3 text-mastra-el-4" />
                <h4 className="text-xs font-medium text-mastra-el-5">{workflow.name}</h4>
              </div>
              <p className="text-xs py-0.5 px-1.5 w-3/4 truncate">{workflow.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
