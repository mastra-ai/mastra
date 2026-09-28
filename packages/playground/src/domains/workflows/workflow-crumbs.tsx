import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { WorkflowCombobox } from '@mastra/playground-ui/domains/workflows/components/workflow-combobox';
import { useWorkflows } from '@mastra/playground-ui/domains/workflows/hooks/use-workflows';
import { useParams } from 'react-router';
import { usePlaygroundStore } from '@/store/playground-store';

export function WorkflowCrumb() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflows, isLoading } = useWorkflows({ requestContext: usePlaygroundStore().requestContext });
  if (!workflowId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return workflows?.[workflowId]?.name || workflowId;
}

export function WorkflowSwitcherAction() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { requestContext } = usePlaygroundStore();
  if (!workflowId) return null;

  return (
    <WorkflowCombobox
      value={workflowId}
      variant="ghost"
      size="icon-sm"
      align="end"
      aria-label="Switch workflow"
      requestContext={requestContext}
    />
  );
}

export function WorkflowRunCrumb() {
  const { runId } = useParams<{ runId: string }>();
  if (!runId) return null;

  return runId.split('-')[0];
}

export function WorkflowRunCopyAction() {
  const { runId } = useParams<{ runId: string }>();
  if (!runId) return null;

  return <CopyButton content={runId} tooltip="Copy run id" variant="ghost" size="icon-sm" />;
}
