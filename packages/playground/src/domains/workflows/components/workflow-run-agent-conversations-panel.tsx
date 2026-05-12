import type { WorkflowStateStepResult } from '@mastra/core/workflows';
import { Skeleton, Txt } from '@mastra/playground-ui';
import { MessageSquareText } from 'lucide-react';
import { useWorkflowRunAgentConversations } from '../hooks/use-workflow-run-agent-conversations';
import { getWorkflowInvocationThreadMeta } from '../workflow-invocation-thread-meta';
import { useLinkComponent } from '@/lib/framework';

export function WorkflowRunAgentConversationsPanel({
  workflowId,
  runId,
  runStatus,
  runSteps,
}: {
  workflowId: string;
  runId?: string;
  /** Workflow run status — when it transitions (e.g. to success), transcripts are refetched */
  runStatus?: string | null;
  /** Step results from the active workflow run — used to order transcripts by step start time */
  runSteps?: Record<string, WorkflowStateStepResult>;
}) {
  const { Link, paths } = useLinkComponent();
  const {
    data: threads,
    isLoading,
    isError,
  } = useWorkflowRunAgentConversations(workflowId, runId, runStatus, runSteps);

  if (!runId) {
    return null;
  }

  const header = (
    <div className="flex items-start gap-2">
      <MessageSquareText className="size-4 text-neutral5 shrink-0 mt-0.5" aria-hidden />
      <div>
        <Txt variant="ui-md" className="font-medium">
          Agent conversations
        </Txt>
        <Txt variant="ui-sm" className="text-neutral5">
          Transcripts from <code className="text-neutral4">createStep(agent)</code> steps with memory. Links open the
          same thread view as the agent chat page.
        </Txt>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4 mt-4 border-t border-border1">
        {header}
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2 pt-4 mt-4 border-t border-border1">
        {header}
        <Txt variant="ui-sm" className="text-red-400">
          Could not load memory threads for this run.
        </Txt>
      </div>
    );
  }

  if (!threads?.length) {
    return (
      <div className="space-y-2 pt-4 mt-4 border-t border-border1">
        {header}
        <Txt variant="ui-sm" className="text-neutral5">
          No workflow-scoped agent transcripts found for this run yet. They appear after steps that use{' '}
          <code className="text-neutral4">createStep(agent)</code> with an agent that has memory enabled (reload or wait
          until the run finishes saving).
        </Txt>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4 mt-4 border-t border-border1 min-w-0">
      {header}

      <ul className="space-y-2 min-w-0">
        {threads.map(thread => {
          const { agentId, stepId } = getWorkflowInvocationThreadMeta(thread);
          const label = thread.title?.trim() ? thread.title : stepId || thread.id;
          const to = agentId ? paths.agentThreadLink(agentId, thread.id) : undefined;

          const inner = (
            <div className="min-w-0 overflow-hidden">
              <span className="block truncate font-medium text-neutral3">{label}</span>
              {stepId && stepId !== label ? (
                <span className="text-neutral5 truncate text-xs block mt-0.5">Step {stepId}</span>
              ) : null}
            </div>
          );

          return (
            <li key={thread.id} className="min-w-0">
              {to ? (
                <Link
                  to={to}
                  className="block rounded-md border border-border1 bg-surface4/40 px-3 py-2 hover:bg-surface4 transition-colors max-w-full min-w-0 overflow-hidden"
                >
                  {inner}
                </Link>
              ) : (
                <div className="rounded-md border border-border1 bg-surface4/40 px-3 py-2 max-w-full min-w-0 overflow-hidden">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
