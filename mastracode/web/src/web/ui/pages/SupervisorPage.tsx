import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mastra/playground-ui/components/Card';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, Check, X } from 'lucide-react';

import { useParams } from 'react-router';

import { useApiConfig } from '../../../shared/api/config';
import { useFactoryQuery } from '../../../shared/hooks/useFactories';
import {
  useFactorySupervisorApprovals,
  useFactorySupervisorSession,
  useFactorySupervisorState,
  useResolveFactorySupervisorApproval,
} from '../../../shared/hooks/useFactorySupervisor';
import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { ChatMessageList } from '../domains/chat/components/ChatMessageList';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TaskPanel } from '../domains/chat/components/TaskPanel';
import { ChatPermissionsProvider } from '../domains/chat/context/ChatPermissionsProvider';
import { ChatSessionContext } from '../domains/chat/context/ChatSessionContext';
import { ChatMessageBoundary, ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import type { FactorySupervisorApproval, FactorySupervisorState } from '../domains/factory/services/supervisor';

export function SupervisorPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      main={
        factoryQuery.isPending ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : factoryQuery.data ? (
          <SupervisorSession factoryProjectId={factoryQuery.data.id} />
        ) : (
          <div className="p-5">
            <Notice variant="destructive">Factory not found.</Notice>
          </div>
        )
      }
    />
  );
}

function SupervisorSession({ factoryProjectId }: { factoryProjectId: string }) {
  const { baseUrl } = useApiConfig();
  const session = useFactorySupervisorSession(factoryProjectId);

  if (session.isPending) {
    return <SupervisorLoading />;
  }
  if (session.error || !session.data) {
    const message =
      session.error instanceof Error ? session.error.message : 'Factory supervisor session is unavailable.';
    return (
      <div className="p-5">
        <Notice variant="destructive">Failed to open the Factory supervisor: {message}</Notice>
      </div>
    );
  }

  const chatSession = {
    resourceId: session.data.resourceId,
    sessionEnabled: true,
    resourceEnabled: true,
    projectPath: undefined,
    factorySessionState: { factoryProjectId },
    baseUrl,
    kind: 'factory' as const,
  };
  return (
    <ChatSessionContext.Provider value={chatSession}>
      <ChatPermissionsProvider>
        <ChatSessionBoundary threadId={session.data.threadId} deferUntilMessagesReady>
          <SupervisorWorkspace factoryProjectId={factoryProjectId} />
        </ChatSessionBoundary>
      </ChatPermissionsProvider>
    </ChatSessionContext.Provider>
  );
}

function SupervisorLoading() {
  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-5"
      aria-label="Loading Factory supervisor"
    >
      <Skeleton className="h-16 w-full" />
      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-full min-h-80 w-full" />
        <Skeleton className="hidden h-full min-h-80 w-full xl:block" />
      </div>
    </div>
  );
}

function SupervisorWorkspace({ factoryProjectId }: { factoryProjectId: string }) {
  useGlobalShortcuts();
  const state = useFactorySupervisorState(factoryProjectId);
  const approvals = useFactorySupervisorApprovals(factoryProjectId);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-1">
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden">
        <SupervisorStateSummary state={state.data} pending={state.isPending} error={state.error} />
        <ChatMessageBoundary>
          <div className="min-h-0 overflow-hidden">
            <ChatMessageList />
          </div>
        </ChatMessageBoundary>
        <TaskPanel />
        <div className="w-full p-3 md:p-5">
          <div className="mx-auto w-full max-w-[80ch]" role="region" aria-label="Supervisor composer">
            <ComposerPanel />
          </div>
        </div>
      </div>
      <PendingApprovals
        factoryProjectId={factoryProjectId}
        approvals={approvals.data}
        pending={approvals.isPending}
        error={approvals.error}
      />
    </div>
  );
}

function SupervisorStateSummary({
  state,
  pending,
  error,
}: {
  state: FactorySupervisorState | undefined;
  pending: boolean;
  error: unknown;
}) {
  if (pending) {
    return (
      <div className="flex gap-3 p-3 md:px-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="p-3 md:px-5">
        <Notice variant="destructive">Factory state is temporarily unavailable.</Notice>
      </div>
    );
  }

  const stages = Object.entries(state.counts.byStage);
  return (
    <section className="flex flex-wrap items-center gap-2 p-3 md:px-5" aria-label="Factory state summary">
      <Txt as="h1" variant="ui-md" className="mr-2 text-neutral6">
        Factory Supervisor
      </Txt>
      <Badge size="sm">{state.totalItems} work items</Badge>
      <Badge size="sm" variant={state.pendingApprovalCount > 0 ? 'warning' : 'default'}>
        {state.pendingApprovalCount} {state.pendingApprovalCount === 1 ? 'pending approval' : 'pending approvals'}
      </Badge>
      {stages.map(([stage, count]) => (
        <Badge key={stage} size="sm">
          {stage}: {count}
        </Badge>
      ))}
    </section>
  );
}

function PendingApprovals({
  factoryProjectId,
  approvals,
  pending,
  error,
}: {
  factoryProjectId: string;
  approvals: FactorySupervisorApproval[] | undefined;
  pending: boolean;
  error: unknown;
}) {
  const resolution = useResolveFactorySupervisorApproval(factoryProjectId);
  const resolvingId = resolution.isPending ? resolution.variables?.approvalId : undefined;

  return (
    <aside className="min-h-0 border-t border-border1 xl:border-l xl:border-t-0" aria-label="Pending approvals">
      <ScrollArea className="h-full max-h-72 xl:max-h-none">
        <div className="flex flex-col gap-3 p-3 md:p-5">
          <div>
            <Txt as="h2" variant="ui-md" className="text-neutral6">
              Pending approvals
            </Txt>
            <Txt as="p" variant="ui-sm" className="text-neutral3">
              Approved moves apply automatically when the captured revision is current.
            </Txt>
          </div>
          {resolution.error ? (
            <Notice variant="destructive">
              {resolution.error instanceof Error ? resolution.error.message : 'Failed to resolve approval.'}
            </Notice>
          ) : null}
          {resolution.data?.status === 'stale' ? (
            <Notice variant="warning">The work item changed before approval. The request was marked stale.</Notice>
          ) : null}
          {pending ? <Skeleton className="h-28 w-full" /> : null}
          {error ? <Notice variant="destructive">Failed to load pending approvals.</Notice> : null}
          {!pending && !error && approvals?.length === 0 ? (
            <EmptyState
              iconSlot={<Bot />}
              titleSlot="No pending approvals"
              descriptionSlot="Agent transition requests that require supervision will appear here."
            />
          ) : null}
          {approvals?.map(approval => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              resolving={resolvingId === approval.id}
              onResolve={decision => resolution.mutate({ approvalId: approval.id, decision })}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ApprovalCard({
  approval,
  resolving,
  onResolve,
}: {
  approval: FactorySupervisorApproval;
  resolving: boolean;
  onResolve: (decision: 'approve' | 'reject') => void;
}) {
  const title = approval.summary ?? `Move work item to ${approval.stage}`;
  return (
    <Card as="article">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge size="xs" variant="warning">
            {approval.stage}
          </Badge>
        </div>
        <CardDescription>{approval.reason}</CardDescription>
      </CardHeader>
      <CardContent density="compact" className="flex flex-col gap-3">
        <Txt as="p" variant="ui-xs" className="text-neutral3">
          {approval.requestingRole ? `${approval.requestingRole} agent · ` : ''}revision {approval.expectedRevision}
        </Txt>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={resolving}
            aria-label={`Approve ${title}`}
            onClick={() => onResolve('approve')}
          >
            <Check /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={resolving}
            aria-label={`Reject ${title}`}
            onClick={() => onResolve('reject')}
          >
            <X /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
