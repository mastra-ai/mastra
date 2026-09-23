import { Button } from '@mastra/playground-ui/components/Button';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useFactoryQuery } from '../../hooks/useFactories';
import { useSupervisorHealth } from '../../hooks/useSupervisorHealth';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
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

import '../domains/chat/components/chat-enter.css';
import { Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { ShieldCheck } from 'lucide-react';

export function SupervisorPage() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  useDocumentTitle(factoryQuery.data ? `Supervisor · ${factoryQuery.data.name}` : 'Supervisor');
  const { sessionThreadId } = useChatSessionContext();

  return (
    <>
      {factoryQuery.isPending ? (
        <ResolvingSupervisorMain />
      ) : (
        <ChatSessionBoundary threadId={sessionThreadId}>
          <SupervisorMain factoryProjectId={factoryId} />
        </ChatSessionBoundary>
      )}
    </>
  );
}

const supervisorCrumb = (
  <Crumb as="span" isCurrent icon={<ShieldCheck />}>
    Supervisor
  </Crumb>
);

function ResolvingSupervisorMain() {
  return (
    <ChatPageLayout crumbs={supervisorCrumb}>
      <SessionFavicon state="initializing" />
      <div className="grid min-h-0 place-items-center">
        <Spinner aria-label="Loading supervisor" className="text-muted-foreground" />
      </div>
    </ChatPageLayout>
  );
}

function SupervisorMain({ factoryProjectId }: { factoryProjectId: string | undefined }) {
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

  const healthError = health.isError ? (
    <Txt variant="caption" className="text-destructive-fg px-3 py-2">
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
    <ChatPageLayout
      crumbs={supervisorCrumb}
      headerActions={
        <SupervisorFindingsToggle
          factoryId={factoryProjectId}
          findings={findings}
          open={findingsOpen}
          canDock={canDock}
          onOpenChange={setFindingsOpen}
          onAsk={prefillComposer}
        />
      }
    >
      <div ref={chatRef} className={cn('flex min-h-0 min-w-0 flex-1', threadGeometryClass)}>
        <SessionChatSurface
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
    </ChatPageLayout>
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
      <h1 id="supervisor-empty-title" className="text-display text-foreground mt-7 tracking-tight text-balance">
        What needs your attention?
      </h1>
      <p className="text-body text-muted-foreground mt-2 max-w-lg leading-relaxed text-pretty">
        Ask why a card is stuck, what changed overnight, or how to safely repair a Factory issue.
      </p>
      <div className="mt-7 flex w-full max-w-2xl flex-wrap justify-center gap-2" aria-label="Suggested prompts">
        <Button type="button" size="md" onClick={() => prefillComposer('What needs me right now?')}>
          What needs me?
        </Button>
        <Button type="button" size="md" onClick={() => prefillComposer('What is stalled, and why?')}>
          Explain stalled work
        </Button>
        <Button type="button" size="md" onClick={() => prefillComposer('What finished overnight?')}>
          Overnight digest
        </Button>
      </div>
    </section>
  );
}
