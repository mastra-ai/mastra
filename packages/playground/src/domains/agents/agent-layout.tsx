import { coreFeatures } from '@mastra/core/features';
import { AgentPage } from '@mastra/playground-ui/domains/agents/chat';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { cleanProviderId } from '@mastra/playground-ui/domains/llm';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import {
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  traceFilterOperatorParam,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgent } from '@mastra/react/hooks/agents';
import type { ReactNode } from 'react';
import { matchPath, useParams, useLocation, useNavigate } from 'react-router';
import { useCanCreateAgent } from '@/domains/agent-builder/hooks/use-can-create-agent';
import { AgentSwitcher } from '@/domains/agents/agent-crumb';
import { AgentOverviewPanel } from '@/domains/agents/components/agent-overview-panel/agent-overview-panel';
import { OVERVIEW_PANEL_SHORTCUT, OverviewPanelShortcuts } from '@/domains/agents/components/overview-panel-shortcuts';
import { PlaygroundModelProvider } from '@/domains/agents/context/playground-model-context';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { AgentToolDrawerBody } from '@/domains/tools/components/tool-drawer/agent-tool-drawer-body';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';
import { RouteSidePanel, useRouteSidePanel } from '@/lib/route-side-panel';
import { withStudioBasePath } from '@/lib/studio-base-path';

/** Shadows the global "go to" sequences with agent-scoped targets while an agent page is mounted. */
const AgentShortcuts = ({ agentId }: { agentId: string }) => {
  const navigate = useNavigate();
  useKeydown({ 'g$+t': () => navigate(`/agents/${agentId}/traces`) });
  return null;
};

const THREAD_FILTER_PARAM = TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.threadId;

/** The conversation the user is looking at: the open thread on Chat, or the thread Traces is filtered to. */
function getConversationThreadId(activeTab: 'chat' | 'versions' | 'traces' | 'none', pathname: string, search: string) {
  if (activeTab === 'chat') {
    const threadId = matchPath('/agents/:agentId/threads/:threadId', pathname)?.params.threadId;
    return threadId === 'new' ? undefined : threadId;
  }
  if (activeTab === 'traces') {
    const params = new URLSearchParams(search);
    const operator = params.get(traceFilterOperatorParam(THREAD_FILTER_PARAM));
    if (operator && operator !== 'is') return undefined;
    return params.get(THREAD_FILTER_PARAM) || undefined;
  }
  return undefined;
}

function AgentConfigMount({ children }: { children: ReactNode }) {
  return <RouteSidePanel owner="agent-detail">{children}</RouteSidePanel>;
}

export const AgentLayout = ({ children }: { children: ReactNode }) => {
  const { agentId } = useParams();
  const location = useLocation();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { hasObservability } = useHasObservability();
  const { canCreateAgent } = useCanCreateAgent();
  const { paths } = useLinkComponent();
  const sidePanel = useRouteSidePanel();

  const isExperimentalFeatures = coreFeatures.has('datasets');
  const showPlayground = isCmsAvailable && isExperimentalFeatures;
  const showObservability = hasObservability && isExperimentalFeatures;

  const { data: agent } = useAgent({
    agentId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });

  const defaultProvider = cleanProviderId(agent?.provider ?? '');
  const defaultModel = agent?.modelId ?? '';

  const activeTab: 'chat' | 'versions' | 'traces' | 'none' = location.pathname.includes('/threads')
    ? 'chat'
    : location.pathname.includes('/editor')
      ? 'versions'
      : location.pathname.includes('/traces')
        ? 'traces'
        : 'none';
  const threadId = getConversationThreadId(activeTab, location.pathname, location.search);
  const tracesHref = threadId
    ? `/agents/${agentId}/traces?${new URLSearchParams({ [THREAD_FILTER_PARAM]: threadId })}`
    : `/agents/${agentId}/traces`;

  const sessionUrl = `${window.location.origin}${withStudioBasePath(`/agents/${encodeURIComponent(agentId!)}/session`)}`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });
  const editPath = paths.cmsAgentEditLink(agentId!);

  return (
    <PlaygroundModelProvider
      key={`${agentId}:${defaultProvider}/${defaultModel}`}
      defaultProvider={defaultProvider}
      defaultModel={defaultModel}
    >
      <KeyboardScope>
        <AgentShortcuts agentId={agentId!} />
        <OverviewPanelShortcuts />
        <ToolDrawer>
          <AgentToolDrawerBody agentId={agentId!} />
        </ToolDrawer>

        <AgentPage
          agent={{ id: agentId!, name: agent?.name || agentId! }}
          overviewHref="/agents"
          switcher={<AgentSwitcher />}
          actions={{
            editHref: canCreateAgent && agent?.source === 'stored' ? editPath : undefined,
            onShare: handleShareLink,
            isShareCopied,
          }}
          tabs={{
            activeTab,
            chatHref: `/agents/${agentId}/threads/${threadId ?? 'new'}`,
            tracesHref,
            versionsHref: `/agents/${agentId}/editor`,
            showPlayground,
            showObservability,
          }}
          config={
            activeTab === 'versions'
              ? undefined
              : {
                  shortcut: OVERVIEW_PANEL_SHORTCUT,
                  dock: { open: !sidePanel.isCollapsed, toggle: sidePanel.toggle, Mount: AgentConfigMount },
                  children: () => (
                    <ActivatedSkillsProvider key={agentId}>
                      <AgentOverviewPanel agentId={agentId!} />
                    </ActivatedSkillsProvider>
                  ),
                }
          }
        >
          {children}
        </AgentPage>
      </KeyboardScope>
    </PlaygroundModelProvider>
  );
};
