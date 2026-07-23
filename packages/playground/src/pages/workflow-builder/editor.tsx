import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { Input } from '@mastra/playground-ui/components/Input';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { ArrowLeftIcon, PlayIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import {
  useWorkflowBuilderAccess,
  useWorkflowDraft,
  WorkflowChatProvider,
  WorkflowConversationPanel,
  WorkflowDefinitionGraphView,
} from '@/domains/workflows/builder';
import type {
  WorkflowDraftCandidate,
  WorkflowDraftValidationContext,
  WorkflowGenerationFailure,
} from '@/domains/workflows/builder';
import { parseWorkflowCatalogSchema } from '@/domains/workflows/builder/workflow-catalog-schema';
import {
  createWorkflowConversationMetadata,
  getWorkflowConversationThreadId,
  rememberWorkflowConversationThread,
  WORKFLOW_BUILDER_AGENT_ID,
} from '@/domains/workflows/builder/workflow-conversation-thread';
import { useDeleteStoredWorkflow, useStoredWorkflow } from '@/domains/workflows/hooks/use-stored-workflows';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useAgentMessages } from '@/hooks/use-agent-messages';

const EMPTY_MESSAGES: MastraDBMessage[] = [];
const WORKFLOW_BUILDER_ROUTE = '/workflow-builder';

export default function WorkflowBuilderEditorPage({ create = false }: { create?: boolean }) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const routeWorkflowId = params.workflowId ? decodeURIComponent(params.workflowId) : undefined;
  const initialWorkflowId = useMemo(
    () => routeWorkflowId ?? searchParams.get('id')?.trim() ?? `workflow-${Date.now().toString(36)}`,
    [routeWorkflowId, searchParams],
  );
  const navigate = useNavigate();
  const access = useWorkflowBuilderAccess();
  const [generationFailure, setGenerationFailure] = useState<WorkflowGenerationFailure | null>(null);
  const [generationCandidate, setGenerationCandidate] = useState<WorkflowDraftCandidate>();
  const workflowQuery = useStoredWorkflow(create ? undefined : routeWorkflowId);
  const agentsQuery = useAgents();
  const toolsQuery = useTools();
  const workflowsQuery = useWorkflows();
  const workflowCatalogUnavailable =
    workflowsQuery.error instanceof Error && /403|forbidden|permission/i.test(workflowsQuery.error.message);
  const validationContext = useMemo<WorkflowDraftValidationContext>(
    () => ({
      agents: Object.fromEntries(Object.keys(agentsQuery.data ?? {}).map(id => [id, {}])),
      tools: Object.fromEntries(
        Object.entries(toolsQuery.data ?? {}).map(([id, tool]) => [
          id,
          {
            inputSchema: parseWorkflowCatalogSchema(tool.inputSchema),
            outputSchema: parseWorkflowCatalogSchema(tool.outputSchema),
          },
        ]),
      ),
      workflows: Object.fromEntries(
        Object.entries(workflowsQuery.data ?? {}).map(([id, workflow]) => [
          id,
          {
            inputSchema: parseWorkflowCatalogSchema(workflow.inputSchema),
            outputSchema: parseWorkflowCatalogSchema(workflow.outputSchema),
          },
        ]),
      ),
      workflowCatalog: workflowCatalogUnavailable ? 'unavailable' : 'available',
    }),
    [agentsQuery.data, toolsQuery.data, workflowCatalogUnavailable, workflowsQuery.data],
  );
  const workflowDraft = useWorkflowDraft(workflowQuery.data, initialWorkflowId, validationContext);
  const threadId = getWorkflowConversationThreadId(initialWorkflowId, workflowQuery.data?.metadata);
  const conversationQuery = useAgentMessages({ agentId: WORKFLOW_BUILDER_AGENT_ID, threadId, memory: true });
  const initialMessages = conversationQuery.data?.messages ?? EMPTY_MESSAGES;
  const deleteWorkflow = useDeleteStoredWorkflow();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (create && !access.canWrite) return <Navigate to={WORKFLOW_BUILDER_ROUTE} replace />;
  if (agentsQuery.isPending || toolsQuery.isPending || workflowsQuery.isPending) {
    return <div className="grid h-full place-items-center text-ui-sm text-neutral3">Loading workflow catalogs…</div>;
  }
  const catalogError =
    agentsQuery.error ?? toolsQuery.error ?? (!workflowCatalogUnavailable ? workflowsQuery.error : null);
  if (catalogError) {
    return (
      <div className="p-10">
        <ErrorState title="Workflow catalogs unavailable" message={catalogError.message} />
      </div>
    );
  }
  if ((!create && workflowQuery.isLoading) || conversationQuery.isPending) {
    return <div className="grid h-full place-items-center text-ui-sm text-neutral3">Loading workflow…</div>;
  }
  if (!create && workflowQuery.error) {
    return (
      <div className="p-10">
        <ErrorState title="Workflow not found" message={workflowQuery.error.message} />
      </div>
    );
  }

  const handleSave = async () => {
    try {
      const saved = await workflowDraft.save(
        createWorkflowConversationMetadata(workflowQuery.data?.metadata, threadId),
      );
      rememberWorkflowConversationThread(saved.id, threadId);
      toast.success('Workflow saved');
      if (create) await navigate(`/workflow-builder/${encodeURIComponent(saved.id)}`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  };

  const handleRun = async () => {
    try {
      if (access.canWrite && workflowDraft.isReady) {
        const saved = await workflowDraft.save(
          createWorkflowConversationMetadata(workflowQuery.data?.metadata, threadId),
        );
        rememberWorkflowConversationThread(saved.id, threadId);
      }
      await navigate(`/workflows/${encodeURIComponent(workflowDraft.draft.id)}/graph`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save workflow before running');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWorkflow.mutateAsync(workflowDraft.draft.id);
      toast.success('Workflow deleted');
      await navigate(WORKFLOW_BUILDER_ROUTE, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete workflow');
    }
  };

  return (
    <WorkflowChatProvider
      key={threadId}
      threadId={threadId}
      authoringState={workflowDraft.authoringState}
      validationContext={validationContext}
      initialMessages={initialMessages}
      createTools={workflowDraft.createTools}
      onGenerationFailure={setGenerationFailure}
      onCandidateChange={setGenerationCandidate}
    >
      <PageLayout className="h-full px-4 md:px-8">
        <PageLayout.TopArea>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => navigate(WORKFLOW_BUILDER_ROUTE)}
                tooltip="Workflow builder list"
              >
                <ArrowLeftIcon />
              </Button>
              <PageHeader>
                <PageHeader.Title>
                  <WorkflowIcon /> {create ? 'Create workflow' : workflowDraft.draft.id}
                </PageHeader.Title>
                <PageHeader.Description>
                  Build with conversation, inspect the persisted definition, then hand it off to the runtime.
                </PageHeader.Description>
              </PageHeader>
            </div>
            <div className="flex flex-wrap gap-2">
              {!create && access.canWrite ? (
                <Button variant="outline" onClick={() => setDeleteOpen(true)} className="text-red-400">
                  <Trash2Icon /> Delete
                </Button>
              ) : null}
              <Button
                variant="default"
                disabled={!access.canRun || create || workflowDraft.isSaving}
                onClick={handleRun}
              >
                <PlayIcon /> Run
              </Button>
              {access.canWrite ? (
                <Button
                  variant="primary"
                  disabled={workflowDraft.isSaving || !workflowDraft.isReady}
                  onClick={handleSave}
                >
                  <SaveIcon /> {workflowDraft.isSaving ? 'Saving…' : 'Save'}
                </Button>
              ) : null}
            </div>
          </div>
        </PageLayout.TopArea>

        <div className="grid min-h-0 flex-1 gap-4 pb-6 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
          <section className="min-h-96 overflow-hidden rounded-lg border border-border1 bg-surface1">
            {access.canUseBuilder ? (
              <WorkflowConversationPanel />
            ) : (
              <div className="grid h-full place-items-center px-8 text-center text-ui-sm text-neutral3">
                {access.canWrite
                  ? 'The workflow builder is not configured. You can still inspect saved definitions.'
                  : 'You have read-only access to this workflow.'}
              </div>
            )}
          </section>

          <section className="min-w-0 space-y-4 overflow-y-auto rounded-lg border border-border1 bg-surface1 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-ui-xs text-neutral3">
                Workflow ID
                <Input
                  value={workflowDraft.draft.id}
                  disabled={!create || !access.canWrite}
                  onChange={event => workflowDraft.setDraft({ ...workflowDraft.draft, id: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-ui-xs text-neutral3">
                Description
                <Input
                  value={workflowDraft.draft.description ?? ''}
                  disabled={!access.canWrite}
                  onChange={event =>
                    workflowDraft.setDraft({ ...workflowDraft.draft, description: event.target.value || undefined })
                  }
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  workflowDraft.lifecycle === 'ready'
                    ? 'success'
                    : workflowDraft.lifecycle === 'constructing'
                      ? 'warning'
                      : 'default'
                }
              >
                {workflowDraft.lifecycle === 'untouched'
                  ? 'Not started'
                  : workflowDraft.lifecycle === 'ready'
                    ? 'Ready to save'
                    : workflowDraft.validation.ok
                      ? 'Draft not finalized'
                      : `${workflowDraft.validation.issues.length} issues`}
              </Badge>
              <span className="text-ui-xs text-neutral3">{workflowDraft.draft.graph.length} top-level entries</span>
            </div>
            {generationCandidate?.hasUncheckpointedChanges ? (
              <div className="space-y-2 rounded-lg border border-border1 bg-surface2 p-3 text-ui-xs text-neutral3">
                <div className="flex items-center justify-between gap-3">
                  <span>Generation candidate has uncheckpointed changes</span>
                  <span>Candidate revision {generationCandidate.revision}</span>
                </div>
                {generationCandidate.issues.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-red-400">
                    {generationCandidate.issues.map(issue => (
                      <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {generationFailure ? (
              <ErrorState title="Workflow generation stopped" message={generationFailure.message} />
            ) : null}
            {workflowDraft.saveError ? (
              <ErrorState title="Workflow save failed" message={workflowDraft.saveError.message} />
            ) : null}
            {workflowDraft.lifecycle !== 'untouched' && !workflowDraft.validation.ok ? (
              <ul className="list-disc space-y-1 pl-5 text-ui-xs text-red-400">
                {workflowDraft.validation.issues.map(issue => (
                  <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
            <div className="overflow-x-auto">
              <WorkflowDefinitionGraphView draft={workflowDraft.draft} />
            </div>
          </section>
        </div>
      </PageLayout>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete workflow?</AlertDialog.Title>
            <AlertDialog.Description>
              This permanently deletes &quot;{workflowDraft.draft.id}&quot; and removes it from the runtime.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={deleteWorkflow.isPending}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action disabled={deleteWorkflow.isPending} onClick={handleDelete}>
              {deleteWorkflow.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </WorkflowChatProvider>
  );
}
