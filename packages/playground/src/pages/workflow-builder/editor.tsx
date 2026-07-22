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
import type { WorkflowDraftStepSchema, WorkflowDraftValidationContext } from '@/domains/workflows/builder';
import {
  getWorkflowConversationThreadId,
  rememberWorkflowConversationThread,
} from '@/domains/workflows/builder/workflow-conversation-thread';
import { useDeleteStoredWorkflow, useStoredWorkflow } from '@/domains/workflows/hooks/use-stored-workflows';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useAgentMessages } from '@/hooks/use-agent-messages';

const EMPTY_MESSAGES: MastraDBMessage[] = [];
const WORKFLOW_BUILDER_ROUTE = '/workflow-builder';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSchema(schema: string | undefined): WorkflowDraftStepSchema['inputSchema'] | undefined {
  if (!schema) return undefined;
  try {
    const parsed: unknown = JSON.parse(schema);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

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
          { inputSchema: parseSchema(tool.inputSchema), outputSchema: parseSchema(tool.outputSchema) },
        ]),
      ),
      workflows: Object.fromEntries(
        Object.entries(workflowsQuery.data ?? {}).map(([id, workflow]) => [
          id,
          { inputSchema: parseSchema(workflow.inputSchema), outputSchema: parseSchema(workflow.outputSchema) },
        ]),
      ),
      workflowCatalog: workflowCatalogUnavailable ? 'unavailable' : 'available',
    }),
    [agentsQuery.data, toolsQuery.data, workflowCatalogUnavailable, workflowsQuery.data],
  );
  const workflowDraft = useWorkflowDraft(workflowQuery.data, initialWorkflowId, validationContext);
  const [threadId] = useState(() => getWorkflowConversationThreadId(initialWorkflowId));
  const conversationQuery = useAgentMessages({ agentId: 'workflow-builder', threadId, memory: true });
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
  if ((!create && workflowQuery.isLoading) || conversationQuery.isLoading) {
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
      const saved = await workflowDraft.save();
      rememberWorkflowConversationThread(saved.id, threadId);
      toast.success('Workflow saved');
      if (create) await navigate(`/workflow-builder/${encodeURIComponent(saved.id)}`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save workflow');
    }
  };

  const handleRun = async () => {
    try {
      if (access.canWrite) {
        const saved = await workflowDraft.save();
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
      threadId={threadId}
      authoringState={workflowDraft.authoringState}
      validationContext={validationContext}
      initialMessages={initialMessages}
      createTools={workflowDraft.createTools}
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
