import { Link } from 'react-router';
import { ArrowLeft, Network } from 'lucide-react';
import { useAllWorkflowRuns } from '@/hooks/use-all-workflow-runs';
import { WorkflowRunsTable } from '@/components/workflow-runs-table';

export default function WorkflowRuns() {
  const { data: runs = [], isLoading } = useAllWorkflowRuns();

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border1 px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/explorer" className="text-text3 hover:text-text1 transition-colors" title="Back to Explorer">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-icon3" />
            <h1 className="text-2xl font-semibold text-text1">Workflow Runs</h1>
          </div>
        </div>
        <p className="text-sm text-text3 ml-8">View and analyze all workflow execution runs across all workflows</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <WorkflowRunsTable runs={runs} isLoading={isLoading} />
      </div>
    </div>
  );
}
