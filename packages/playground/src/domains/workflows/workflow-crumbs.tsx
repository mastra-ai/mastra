import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { useParams } from 'react-router';
import { WorkflowCombobox } from './components/workflow-combobox';
import { useWorkflows } from './hooks/use-workflows';

export function WorkflowCrumb() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflows, isLoading } = useWorkflows();
  if (!workflowId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return workflows?.[workflowId]?.name || workflowId;
}

export function WorkflowSwitcherAction() {
  const { workflowId } = useParams<{ workflowId: string }>();
  if (!workflowId) return null;

  return <WorkflowCombobox value={workflowId} variant="ghost" size="icon-sm" aria-label="Switch workflow" />;
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
