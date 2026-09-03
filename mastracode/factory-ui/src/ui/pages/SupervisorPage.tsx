import { Button } from '@mastra/playground-ui/components/Button';
import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFactoryQuery } from '../../hooks/useFactories';
import { useSupervisorHealth } from '../../hooks/useSupervisorHealth';
import { Sidebar } from '../Sidebar';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { SessionFavicon } from '../domains/chat/components/SessionFavicon';
import { useChatCommands } from '../domains/chat/context/ChatCommandsProvider';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatSessionContext } from '../domains/chat/context/useChatSessionContext';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import {
  SupervisorFindingsSurface,
  SupervisorFindingsToggle,
} from '../domains/supervisor/components/SupervisorFindingsPanel';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { chatColumnClass, DOCK_MIN_REM, threadGeometryClass } from '../domains/workspace-viewer/layout';
import { ChatLayout } from '../layouts/ChatLayout';

import '../domains/chat/components/chat-enter.css';

export function SupervisorPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  useDocumentTitle(factoryQuery.data ? `Supervisor · ${factoryQuery.data.name}` : 'Supervisor');
  const { sessionThreadId } = useChatSessionContext();

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      main={
        factoryQuery.isPending ? (
          <ResolvingSupervisorMain />
        ) : (
          <ChatSessionBoundary threadId={sessionThreadId}>
            <SupervisorMain factoryProjectId={factoryId} factoryName={factoryQuery.data?.name} />
          </ChatSessionBoundary>
        )
      }
    />
  );
}

function ResolvingSupervisorMain() {
  return (
    <>
      <SessionFavicon state="initializing" />
      <ChatShell className="flex-1">
        <ChatShell.Bar>
          <ChatHeader />
        </ChatShell.Bar>
        <div className="grid min-h-0 flex-1 place-items-center">
          <Spinner aria-label="Loading supervisor" className="text-icon3" />
        </div>
      </ChatShell>
    </>
  );
}

function SupervisorMain({
  factoryProjectId,
  factoryName,
}: {
  factoryProjectId: string | undefined;
  factoryName: string | undefined;
}) {
  useGlobalShortcuts();
  useHandoffPrompt();
  useAskParam();
  const { prefillComposer } = useChatCommands();
  const health = useSupervisorHealth(factoryProjectId);
  const chatRef = useRef<HTMLDivElement>(null);
  const { wider: canDock, revision: layoutRevision } = useWiderThan(chatRef, DOCK_MIN_REM);
  const [panelState, setPanelState] = useState<{ layoutRevision: number; open: boolean }>();
  const findingsOpen = panelState?.layoutRevision === layoutRevision ? panelState.open : false;
  const setFindingsOpen = (open: boolean) => setPanelState({ layoutRevision, open });
  const findings = health.data?.findings ?? [];

  const header = (
    <ChatHeader className="border-border1 border-b md:px-5">
      <div role="region" aria-label="Supervisor session" className="flex min-w-0 flex-1 items-center gap-2">
        <nav className="text-ui-sm flex min-w-0 items-center gap-2" aria-label="Supervisor session breadcrumb">
          <Link
            to={`/factories/${factoryProjectId}/overview`}
            className="text-icon4 hover:text-icon6 shrink-0 font-medium hover:underline"
          >
            {factoryName ?? 'Factory'}
          </Link>
          <span className="text-icon3" aria-hidden>
            /
          </span>
          <span className="text-icon6 truncate">Supervisor</span>
        </nav>
        <div className="ml-auto shrink-0">
          <SupervisorFindingsToggle
            factoryId={factoryProjectId}
            findings={findings}
            open={findingsOpen}
            canDock={canDock}
            onOpenChange={setFindingsOpen}
            onAsk={prefillComposer}
          />
        </div>
      </div>
    </ChatHeader>
  );
  const healthError = health.isError ? (
    <Txt variant="ui-sm" className="text-accent2 px-3 py-2">
      Couldn't run the health check: {health.error.message}
    </Txt>
  ) : undefined;
  const findingsSurface = (
    <SupervisorFindingsSurface
      factoryId={factoryProjectId}
      findings={findings}
      open={findingsOpen}
      canDock={canDock}
      onOpenChange={setFindingsOpen}
      onAsk={prefillComposer}
    />
  );

  return (
    <div ref={chatRef} className={cn('flex min-h-0 min-w-0 flex-1', threadGeometryClass)}>
      <SessionChatSurface
        header={header}
        secondaryBar={healthError}
        emptyState={<SupervisorEmptyState />}
        composerLabel="Supervisor composer"
        className={cn(
          chatColumnClass,
          '[--chat-gutter:0.25rem]',
          findingsOpen && canDock ? '[--chat-inset-end:22rem]' : '[--chat-inset-end:0px]',
        )}
        stageSurface={findingsSurface}
      />
    </div>
  );
}

function useAskParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { prefillComposer } = useChatCommands();
  const ask = searchParams.get('ask');
  const applied = useRef(false);
  useEffect(() => {
    if (!ask || applied.current) return;
    applied.current = true;
    prefillComposer(ask);
    const next = new URLSearchParams(searchParams);
    next.delete('ask');
    setSearchParams(next, { replace: true });
  }, [ask, prefillComposer, searchParams, setSearchParams]);
}

function SupervisorEmptyState() {
  const { prefillComposer } = useChatCommands();
  return (
    <section
      className="flex w-full max-w-full min-w-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center"
      aria-labelledby="supervisor-empty-title"
    >
      <Logo size="md" aria-label="Mastra Code" />
      <h1
        id="supervisor-empty-title"
        className="text-header-xl text-icon6 mt-7 font-medium tracking-tight text-balance"
      >
        What needs your attention?
      </h1>
      <p className="text-ui-lg text-icon3 mt-2 max-w-lg leading-relaxed text-pretty">
        Ask why a card is stuck, what changed overnight, or how to safely repair a Factory issue.
      </p>
      <div className="mt-7 flex w-full max-w-2xl flex-wrap justify-center gap-2" aria-label="Suggested prompts">
        <Button type="button" variant="outline" size="md" onClick={() => prefillComposer('What needs me right now?')}>
          What needs me?
        </Button>
        <Button type="button" variant="outline" size="md" onClick={() => prefillComposer('What is stalled, and why?')}>
          Explain stalled work
        </Button>
        <Button type="button" variant="outline" size="md" onClick={() => prefillComposer('What finished overnight?')}>
          Overnight digest
        </Button>
      </div>
    </section>
  );
}
