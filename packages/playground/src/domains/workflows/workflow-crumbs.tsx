import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { useParams } from 'react-router';

export function WorkflowCrumb() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflows, isLoading } = useWorkflows();
  if (!workflowId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return workflows?.[workflowId]?.name || workflowId;
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
