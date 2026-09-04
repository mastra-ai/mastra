import { v4 as uuid } from '@lukeed/uuid';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Header, HeaderAction, HeaderTitle } from '@mastra/playground-ui/components/Header';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainSidebar, MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { cn } from '@mastra/playground-ui/utils/cn';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, ChartNoAxesGantt, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { AgentChatLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
import { MemorySidebarBody } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import { MemoryTimelineProvider } from '@/domains/agents/context/memory-timeline-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { buildAgentDefaultSettings } from '@/domains/agents/utils/agent-default-settings';
import { getAgentSuggestedPrompts } from '@/domains/agents/utils/agent-suggested-prompts';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { ThreadAside } from '@/domains/conversation/components/thread-aside';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { useDeleteThread, useMemory, useThreads } from '@/domains/memory/hooks/use-memory';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { ThreadTraces } from '@/domains/traces/components/thread-traces';
import { ThreadViewByTrace } from '@/domains/traces/components/thread-view-by-trace';
import { useLinkComponent } from '@/lib/framework';

function AgentThread() {
  const { agentId, threadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const isNewThread = threadId === 'new';

  // eslint-disable-next-line react-hooks/exhaustive-deps -- threadId is intentional: we need a new UUID per thread
  const newThreadId = useMemo(() => uuid(), [threadId]);

  const hasMemory = Boolean(memory?.result);

  const {
    data: threads,
    isLoading: isThreadsLoading,
    refetch: refreshThreads,
  } = useThreads({
    agentId: agentId!,
    isMemoryEnabled: hasMemory,
    resourceId: agentId!,
  });

  const sidebarThreads = useMemo(
    () =>
      (threads || []).map(thread => ({
        ...thread,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
      })),
    [threads],
  );

  const messageId = searchParams.get('messageId') ?? undefined;
  // A new thread has no traces yet, so the advanced (trace-based) view falls back to the chat.
  const isAdvancedVariant = searchParams.get('variant') === 'advanced' && !isNewThread;
  const setAdvancedVariant = (enabled: boolean) => {
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        if (enabled) next.set('variant', 'advanced');
        else next.delete('variant');
        return next;
      },
      // Toggling the view is not a navigation: don't stack history entries.
      { replace: true },
    );
  };
  // Traces aside (chat view only). The column is keyed by thread, so this resets when switching threads.
  const [tracesAside, setTracesAside] = useState<TracesAsideState>('closed');
  const suggestedPrompts = getAgentSuggestedPrompts(agent?.metadata);

  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);

  // 401 check - session expired, needs re-authentication
  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  // 403 check - permission denied for agents
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (isAgentLoading) {
    return <AgentThreadLoadingSkeleton />;
  }

  if (!agent) {
    return <div className="py-4 text-center">Agent not found</div>;
  }

  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);

  const handleRefreshThreadList = async () => {
    await refreshThreads();

    if (isNewThread) {
      void navigate(`/agents/${agentId}/threads/${newThreadId}`);
    }
  };

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <AgentSettingsProvider agentId={agentId!} defaultSettings={defaultSettings}>
        <SchemaRequestContextProvider>
          <WorkingMemoryProvider agentId={agentId!} threadId={actualThreadId} resourceId={agentId!}>
            <BrowserToolCallsProvider key={`browser-${agentId}-${actualThreadId}`}>
              <BrowserSessionProvider
                key={`session-${agentId}-${actualThreadId}`}
                agentId={agentId!}
                threadId={actualThreadId}
                enabled={Boolean(agent?.hasBrowser ?? agent?.browserTools?.length)}
              >
                <ThreadInputProvider>
                  <ObservationalMemoryProvider>
                    <MemoryTimelineProvider key={`memory-timeline-${agentId}-${actualThreadId}`}>
                      <ActivatedSkillsProvider key={`${agentId}-${actualThreadId}`}>
                        <MainSidebarProvider storageKey="agent-thread">
                          <div className="bg-surface1 h-full lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
                            <ThreadSidebar
                              agentId={agentId!}
                              agentName={agent.name}
                              threads={sidebarThreads}
                              threadId={actualThreadId}
                              isLoading={isThreadsLoading}
                            />
                            <div key={actualThreadId} className="relative min-h-0">
                              <div className="rounded-studio-frame border-border1 bg-surface2 shadow-main-frame m-1.5 flex h-[calc(100%-0.75rem)] min-h-0 flex-col overflow-hidden border [--studio-frame-inset:0.5rem] [--studio-frame-radius:1.5rem] lg:m-2 lg:ml-0 lg:h-[calc(100%-1rem)]">
                                <Header>
                                  <HeaderTitle>Thread</HeaderTitle>
                                  {/* "new" is not a stored thread yet, so there is nothing to trace. */}
                                  {!isNewThread && (
                                    <HeaderAction>
                                      {!isAdvancedVariant && (
                                        <Button
                                          variant="outline"
                                          className="hidden lg:inline-flex"
                                          onClick={() => setTracesAside(tracesAside === 'open' ? 'closing' : 'open')}
                                        >
                                          <ChartNoAxesGantt />
                                          Traces
                                        </Button>
                                      )}
                                      <Switch
                                        id="thread-advanced-view"
                                        checked={isAdvancedVariant}
                                        onCheckedChange={setAdvancedVariant}
                                      />
                                      <label htmlFor="thread-advanced-view" className="text-ui-sm text-neutral4">
                                        Advanced view
                                      </label>
                                    </HeaderAction>
                                  )}
                                </Header>
                                <div
                                  className={cn(
                                    'relative grid min-h-0 flex-1',
                                    // The advanced view manages its own scroll container.
                                    !isAdvancedVariant && 'overflow-y-auto pt-6',
                                  )}
                                >
                                  {isAdvancedVariant ? (
                                    <ThreadViewByTrace threadId={actualThreadId} />
                                  ) : (
                                    <AgentChat
                                      agentId={agentId!}
                                      agentName={agent?.name}
                                      modelVersion={agent?.modelVersion}
                                      supportsMemory={agent?.supportsMemory}
                                      threadId={actualThreadId}
                                      memory={hasMemory}
                                      refreshThreadList={handleRefreshThreadList}
                                      modelList={agent?.modelList}
                                      messageId={messageId}
                                      suggestedPrompts={suggestedPrompts}
                                      isNewThread={isNewThread}
                                    />
                                  )}
                                </div>
                              </div>
                              {!isNewThread && !isAdvancedVariant && tracesAside !== 'closed' && (
                                <ThreadTracesAside
                                  threadId={actualThreadId}
                                  state={tracesAside}
                                  onStateChange={setTracesAside}
                                />
                              )}
                            </div>
                          </div>
                        </MainSidebarProvider>
                      </ActivatedSkillsProvider>
                    </MemoryTimelineProvider>
                  </ObservationalMemoryProvider>
                </ThreadInputProvider>
              </BrowserSessionProvider>
            </BrowserToolCallsProvider>
          </WorkingMemoryProvider>
        </SchemaRequestContextProvider>
      </AgentSettingsProvider>
    </TracingSettingsProvider>
  );
}

export default AgentThread;

type TracesAsideState = 'closed' | 'open' | 'closing';

/** Slide-in aside listing the thread traces. Mounted while `state !== 'closed'` so the exit animation can play. */
const ThreadTracesAside = ({
  threadId,
  state,
  onStateChange,
}: {
  threadId: string;
  state: Exclude<TracesAsideState, 'closed'>;
  onStateChange: (state: TracesAsideState) => void;
}) => {
  // Mirrored from ThreadTraces to drive the aside title/width; reset naturally when the aside unmounts.
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [isTraceSpanOpen, setIsTraceSpanOpen] = useState(false);

  return (
    <div
      onAnimationEnd={e => {
        if (e.target === e.currentTarget && state === 'closing') {
          onStateChange('closed');
        }
      }}
      className={cn(
        'absolute top-3 right-3 bottom-3 z-20 hidden transition-[width] duration-300 ease-out lg:top-4 lg:right-4 lg:bottom-4 lg:block',
        state === 'closing'
          ? 'animate-out fade-out-0 slide-out-to-right-full fill-mode-forwards'
          : 'animate-in fade-in-0 slide-in-from-right-full',
        isTraceSpanOpen ? 'w-[70%]' : 'w-[40%]',
      )}
    >
      <ThreadAside title={isTraceOpen ? undefined : 'Traces'} onClose={() => onStateChange('closing')}>
        <ThreadTraces threadId={threadId} onTraceOpenChange={setIsTraceOpen} onSpanOpenChange={setIsTraceSpanOpen} />
      </ThreadAside>
    </div>
  );
};

interface ThreadSidebarProps {
  agentId: string;
  agentName?: string;
  threads: Array<{ id: string; title?: string; createdAt: Date }>;
  threadId: string;
  isLoading: boolean;
}

const ThreadSidebar = ({ agentId, agentName, threads, threadId, isLoading }: ThreadSidebarProps) => {
  const { Link } = useLinkComponent();
  const { state } = useMainSidebar();
  const navigate = useNavigate();
  const { canDelete } = usePermissions();
  const { mutateAsync: deleteThread } = useDeleteThread();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canDeleteThread = canDelete('memory');

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteThread({ threadId: deleteId, agentId });
    if (deleteId === threadId) {
      void navigate(`/agents/${agentId}/threads/new`);
    }
    setDeleteId(null);
  };

  const threadsNav = (
    <MainSidebar.Nav>
      <MainSidebar.NavSection>
        <MainSidebar.NavHeader state={state}>Threads</MainSidebar.NavHeader>
        {isLoading ? (
          <ThreadListLoadingSkeleton />
        ) : (
          <MainSidebar.NavList data-testid="thread-list">
            {threads.map(thread => (
              <MainSidebar.NavLink
                key={thread.id}
                LinkComponent={Link}
                state={state}
                isActive={thread.id === threadId}
                link={{ name: threadDisplayName(thread), url: `/agents/${agentId}/threads/${thread.id}` }}
                className="group/thread-row"
                action={
                  canDeleteThread ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 opacity-0 transition-opacity group-focus-within/thread-row:opacity-100 group-hover/thread-row:opacity-100"
                      onClick={() => setDeleteId(thread.id)}
                      aria-label="Delete thread"
                    >
                      <X />
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </MainSidebar.NavList>
        )}
      </MainSidebar.NavSection>
    </MainSidebar.Nav>
  );

  return (
    <>
      <DeleteThreadDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onDelete={() => void handleDelete()}
      />
      <MainSidebar>
        <div className="mb-1.5 pt-2.5">
          <span className="flex h-7 items-center gap-2 pr-2 pl-3">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-display truncate text-sm font-semibold tracking-tight whitespace-nowrap">
              Mastra Studio
            </span>
          </span>
        </div>

        <div className="mb-1">
          <MainSidebar.NavList>
            <MainSidebar.NavLink state={state} asChild>
              <Link href={`/agents/${agentId}/overview`} data-testid="thread-sidebar-back">
                <ArrowLeft />
                <MainSidebar.NavLabel state={state}>Back to {agentName ?? 'agent'}</MainSidebar.NavLabel>
              </Link>
            </MainSidebar.NavLink>
            <MainSidebar.NavLink state={state} asChild>
              <Link href={`/agents/${agentId}/threads/new`} data-testid="thread-sidebar-new-chat">
                <Plus />
                <MainSidebar.NavLabel state={state}>New Chat</MainSidebar.NavLabel>
              </Link>
            </MainSidebar.NavLink>
          </MainSidebar.NavList>
        </div>

        {state === 'collapsed' ? (
          threadsNav
        ) : (
          // The memory body wraps the threads nav so the Memory card docks at the
          // bottom and expands over the thread list (same UX as the old sidebar).
          <div className="min-h-0 flex-1">
            <MemorySidebarBody agentId={agentId} threadId={threadId} threadsSlot={threadsNav} />
          </div>
        )}
      </MainSidebar>
    </>
  );
};

const DeleteThreadDialog = ({
  open,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
        <AlertDialog.Description>
          This action cannot be undone. This will permanently delete your chat and remove it from our servers.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action onClick={onDelete}>Continue</AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog>
);

/** Compact skeleton matching the thread NavLink rows — the overview sidebar skeleton doesn't fit here. */
const ThreadListLoadingSkeleton = () => (
  <div className="flex flex-col gap-px" data-testid="thread-list-skeleton" aria-busy="true">
    {['w-32', 'w-24', 'w-36', 'w-28'].map(width => (
      <div key={width} className="flex h-9 items-center px-3">
        <Skeleton className={`h-3 ${width}`} />
      </div>
    ))}
  </div>
);

const DEFAULT_THREAD_NAME = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function threadDisplayName(thread: { id: string; title?: string; createdAt: Date }): string {
  if (thread.title && !DEFAULT_THREAD_NAME.test(thread.title)) return thread.title;
  return new Date(thread.createdAt)
    .toLocaleString('en-us', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })
    .replace(',', ' at');
}

const AgentThreadLoadingSkeleton = () => (
  <MainContentLayout className="grid-rows-[1fr]">
    <div className="relative grid h-full overflow-y-auto pt-6" data-testid="agent-thread-skeleton" aria-busy="true">
      <AgentChatLoadingSkeleton />
    </div>
  </MainContentLayout>
);
