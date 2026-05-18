import { Spinner } from '@mastra/playground-ui';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentBuilderMobileMenu } from '@/domains/agent-builder/components/agent-edit/agent-builder-mobile-menu';
import {
  AgentChatPanelChat,
  AgentChatPanelProvider,
} from '@/domains/agent-builder/components/agent-edit/agent-chat-panel';
import { PublishToChannelButton } from '@/domains/agent-builder/components/agent-edit/publish-to-channel-button';
import { VisibilitySelect } from '@/domains/agent-builder/components/agent-edit/visibility-select';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useBuilderAgentAccess } from '@/domains/agent-builder/hooks/use-builder-agent-access';
import { useChannelConnectToast } from '@/domains/agent-builder/hooks/use-channel-connect-toast';
import { WorkspaceLayout } from '@/domains/agent-builder/layouts/workspace-layout';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { storedAgentToAgentConfig } from '@/domains/agent-builder/services/stored-agent-to-agent-config';
import { storedAgentToFormValues } from '@/domains/agent-builder/services/stored-agent-to-form-values';
import { BrowserViewPanel } from '@/domains/agents/components/browser-view';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-context';
import { BrowserToolCallsProvider } from '@/domains/agents/context/browser-tool-calls-context';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import type { CurrentUser } from '@/domains/auth/types';

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  useChannelConnectToast();
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id, { status: 'draft' });
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const isReady = Boolean(id) && !isStoredAgentLoading && !isCurrentUserLoading;

  if (!isReady) return <AgentBuilderAgentViewSkeleton />;

  return <AgentBuilderAgentViewPage id={id} storedAgent={storedAgent} currentUser={currentUser ?? null} />;
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  currentUser: CurrentUser;
}

const AgentBuilderAgentViewPage = ({ id, storedAgent, currentUser }: PageProps) => {
  const defaultValues = useMemo(() => storedAgentToFormValues(storedAgent), [storedAgent]);
  const formMethods = useForm<AgentBuilderEditFormValues>({ defaultValues });

  useEffect(() => {
    formMethods.reset(defaultValues);
  }, [defaultValues, formMethods]);

  return (
    <FormProvider {...formMethods}>
      <AgentBuilderAgentViewReady id={id!} storedAgent={storedAgent} currentUser={currentUser} />
    </FormProvider>
  );
};

const AgentBuilderAgentViewSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);

interface AgentBuilderAgentViewReadyProps {
  id: string;
  storedAgent: StoredAgent | null | undefined;
  currentUser: CurrentUser;
}

const AgentBuilderAgentViewReady = ({ id, storedAgent, currentUser }: AgentBuilderAgentViewReadyProps) => {
  const navigate = useNavigate();
  // Gate publishing on the *saved* visibility — never on unsaved form state.
  const isPublishable = storedAgent?.visibility === 'public';
  const isOwner = !storedAgent?.authorId || currentUser?.id === storedAgent.authorId;
  const { canWrite } = useBuilderAgentAccess();
  const canModify = canWrite && isOwner;
  const threadId = currentUser?.id ? `${currentUser.id}-${id}` : id;

  const agent = useMemo(() => storedAgentToAgentConfig(storedAgent, id ?? ''), [storedAgent, id]);

  const features = useBuilderAgentFeatures();
  const hasBrowser = features.browser && storedAgent?.browser != null;

  const onModeToggle = isOwner
    ? () => navigate(`/agent-builder/agents/${id}/edit`, { viewTransition: true })
    : undefined;

  const content = (
    <AgentChatPanelProvider
      agentId={id}
      agentName={storedAgent?.name}
      agentDescription={storedAgent?.description}
      agentAvatarUrl={agent?.avatarUrl}
    >
      <ViewWorkspaceConnected
        agentId={id}
        agentName={storedAgent?.name ?? ''}
        isOwner={canModify}
        isPublishable={isPublishable}
        hasBrowser={hasBrowser}
        onModeToggle={onModeToggle}
      />
    </AgentChatPanelProvider>
  );

  if (!hasBrowser) return content;

  return (
    <BrowserToolCallsProvider>
      <BrowserSessionProvider agentId={id} threadId={threadId}>
        {content}
      </BrowserSessionProvider>
    </BrowserToolCallsProvider>
  );
};

interface ViewWorkspaceConnectedProps {
  agentId: string;
  agentName: string;
  isOwner: boolean;
  isPublishable: boolean;
  hasBrowser: boolean;
  onModeToggle: (() => void) | undefined;
}

const ViewWorkspaceConnected = ({
  agentId,
  agentName,
  isOwner,
  isPublishable,
  hasBrowser,
  onModeToggle,
}: ViewWorkspaceConnectedProps) => {
  const isRunning = useStreamRunning();
  return (
    <WorkspaceLayout
      isLoading={false}
      mode={isOwner ? 'test' : undefined}
      onModeToggle={onModeToggle}
      modeToggleDisabled={isRunning}
      modeAction={
        <div className="hidden lg:flex items-center gap-2">
          {isOwner && isPublishable && <PublishToChannelButton agentId={agentId} />}
          {isOwner && <VisibilitySelectIfAuth agentId={agentId} />}
        </div>
      }
      mobileExtra={
        isOwner ? (
          <AgentBuilderMobileMenuConnected
            agentId={agentId}
            agentName={agentName}
            showPublishToChannel={isPublishable}
          />
        ) : undefined
      }
      chat={<AgentChatPanelChat hasBrowser={hasBrowser} hideBrowserSidebar />}
      browserOverlay={hasBrowser ? <BrowserViewPanel hideSidebar /> : undefined}
    />
  );
};

const VisibilitySelectIfAuth = ({ agentId }: { agentId: string }) => {
  const { data: capabilities } = useAuthCapabilities();
  if (!capabilities?.enabled) return null;
  return <VisibilitySelect agentId={agentId} />;
};

const AgentBuilderMobileMenuConnected = ({
  agentId,
  agentName,
  showPublishToChannel,
}: {
  agentId: string;
  agentName: string;
  showPublishToChannel: boolean;
}) => {
  const isRunning = useStreamRunning();
  const { data: capabilities } = useAuthCapabilities();
  const authEnabled = !!capabilities?.enabled;
  return (
    <AgentBuilderMobileMenu
      agentId={agentId}
      showSetVisibility={authEnabled}
      showPublishToChannel={showPublishToChannel}
      showDelete
      agentName={agentName}
      disabled={isRunning}
    />
  );
};
