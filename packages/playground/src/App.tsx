import { coreFeatures } from '@mastra/core/features';
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { MastraReactProvider } from '@mastra/react';
import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useNavigate, redirect } from 'react-router';
import type { LoaderFunctionArgs, RouteObject } from 'react-router';
import { AgentBuilderRootLayout } from './domains/agent-builder/layouts/agent-builder-root-layout';
import { RoutePermissionGuard } from './domains/auth/components/route-permission-guard';
import { RoutePermissionsGate } from './domains/auth/components/route-permissions-gate';
import { WorkflowLayout } from './domains/workflows/workflow-layout';
import SignalsOverviewPage from './ee/signals';
import { SignalsEntityDetailPage } from './ee/signals/signals-entity-detail-page';
import { PostHogProvider } from './lib/analytics';
import {
  agentIndexLoader,
  agentThreadsIndexLoader,
  legacyAgentChatLoader,
  legacyAgentSettingsLoader,
  paths,
} from './lib/app-routing';
import { Link } from './lib/link';
import { StudioIndexRedirect } from './lib/studio-index-redirect';
import { AgentBuilderRoot } from './pages/agent-builder';
import AgentBuilderAgents from './pages/agent-builder/agents';
import AgentBuilderCreate from './pages/agent-builder/agents/create';
import AgentBuilderAgentEdit from './pages/agent-builder/agents/edit';
import AgentBuilderAgentView from './pages/agent-builder/agents/view';
import AgentBuilderFavorite from './pages/agent-builder/favorite';
import AgentBuilderInfrastructure from './pages/agent-builder/infrastructure';
import AgentBuilderLibrary from './pages/agent-builder/library';
import AgentBuilderSkills from './pages/agent-builder/skills';
import AgentBuilderSkillsCreate from './pages/agent-builder/skills/create';
import AgentBuilderSkillsEdit from './pages/agent-builder/skills/edit';
import AgentBuilderSkillsView from './pages/agent-builder/skills/view';
import Agents from './pages/agents';
import AgentSession from './pages/agents/agent/session';
import AgentThread from './pages/agents/agent/thread';
import AgentPlayground from './pages/agents/agent-playground';
import AgentTraces from './pages/agents/agent-traces';
import CmsAgentAgentsPage from './pages/cms/agents/agents';
import { CreateLayoutWrapper } from './pages/cms/agents/create-layout';
import { EditLayoutWrapper } from './pages/cms/agents/edit-layout';
import CmsAgentInformationPage from './pages/cms/agents/information';
import CmsAgentInstructionBlocksPage from './pages/cms/agents/instruction-blocks';
import CmsAgentMemoryPage from './pages/cms/agents/memory';
import CmsAgentScorersPage from './pages/cms/agents/scorers';
import CmsAgentSkillsPage from './pages/cms/agents/skills';
import CmsAgentToolsPage from './pages/cms/agents/tools';
import CmsAgentVariablesPage from './pages/cms/agents/variables';
import CmsAgentWorkflowsPage from './pages/cms/agents/workflows';
import CmsPromptBlocksCreatePage from './pages/cms/prompt-blocks/create';
import CmsPromptBlocksEditPage from './pages/cms/prompt-blocks/edit';
import CmsScorersCreatePage from './pages/cms/scorers/create';
import CmsScorersEditPage from './pages/cms/scorers/edit';
import Datasets from './pages/datasets';
import DatasetPage from './pages/datasets/dataset';
import EditDatasetPage from './pages/datasets/dataset/edit';
import DatasetItemVersionsComparePage from './pages/datasets/dataset/item/versions';
import DatasetCompareDatasetVersions from './pages/datasets/dataset/versions';
import CreateDatasetPage from './pages/datasets/new';
import Evaluation from './pages/evaluation';
import Experiments from './pages/experiments';
import CompareExperimentsPage from './pages/experiments/compare';
import ExperimentPage from './pages/experiments/experiment';
import ReviewQueuePage from './pages/experiments/review-queue';
import InboxPage from './pages/inbox';
import IntegrationsPage from './pages/integrations';
import { Login } from './pages/login';
import Logs from './pages/logs';
import MCPs from './pages/mcps';
import { McpServerPage } from './pages/mcps/[serverId]';
import MCPServerToolExecutor from './pages/mcps/tool';
import Metrics from './pages/metrics';
import PromptBlocks from './pages/prompt-blocks';
import RequestContext from './pages/request-context';
import Resources from './pages/resources';
import Scorers from './pages/scorers';
import Scorer from './pages/scorers/scorer';
import { StudioSettingsPage } from './pages/settings';
import { SignUp } from './pages/signup';
import Templates from './pages/templates';
import Template from './pages/templates/template';
import AgentTool from './pages/tools/agent-tool';
import Tool from './pages/tools/tool';
import Traces from './pages/traces';
import Workflows from './pages/workflows';
import SchedulePage from './pages/workflows/schedule';
import SchedulesPage from './pages/workflows/schedules';
import { Workflow } from './pages/workflows/workflow';
import Workspace from './pages/workspace';
import WorkspaceSkillDetailPage from './pages/workspace/skills/[skillName]';
import { Layout } from '@/components/layout';
import { MinimalLayout } from '@/components/minimal-layout';
import { AgentBuilderEditionLayout, AgentBuilderLayout } from '@/domains/agent-builder/layouts/agent-builder-layout';
import { AgentLayout } from '@/domains/agents/agent-layout';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import { createFetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';

import { PlaygroundConfigGuard } from '@/domains/configuration/components/playground-config-guard';
import { StudioConfigProvider } from '@/domains/configuration/context/studio-config-context';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';
import { GlobalShortcuts } from '@/domains/navigation/components/global-shortcuts';
import { LinkComponentProvider } from '@/lib/framework';
import { PlaygroundQueryClient } from '@/lib/tanstack-query';
import { Processors } from '@/pages/processors';
import { Processor } from '@/pages/processors/processor';
import Tools from '@/pages/tools';

// Extend window type for Mastra config
declare global {
  interface Window {
    MASTRA_STUDIO_BASE_PATH?: string;
    MASTRA_SERVER_HOST: string;
    MASTRA_SERVER_PORT: string;
    MASTRA_API_PREFIX?: string;
    MASTRA_TELEMETRY_DISABLED?: string;
    MASTRA_HIDE_CLOUD_CTA: string;
    MASTRA_SERVER_PROTOCOL: string;
    MASTRA_CLOUD_API_ENDPOINT: string;
    MASTRA_PLATFORM_PROJECT_ID?: string;
    MASTRA_EXPERIMENTAL_FEATURES?: string;
    MASTRA_TEMPLATES?: string;
    MASTRA_AUTO_DETECT_URL?: string;
    MASTRA_REQUEST_CONTEXT_PRESETS?: string;
    MASTRA_EXPERIMENTAL_UI?: string;
    MASTRA_AGENT_SIGNALS?: string;
    MASTRA_SIGNALS_UI?: string;
    MASTRA_ORGANIZATION_ID?: string;
    MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
  }
}

const RootLayout = () => {
  const navigate = useNavigate();
  const frameworkNavigate = (path: string) => navigate(path, { viewTransition: true });

  return (
    <LinkComponentProvider Link={Link} navigate={frameworkNavigate} paths={paths}>
      <KeyboardShortcutsProvider>
        <GlobalShortcuts />
        <Layout>
          <RoutePermissionGuard>
            <Outlet />
          </RoutePermissionGuard>
        </Layout>
      </KeyboardShortcutsProvider>
    </LinkComponentProvider>
  );
};

const MinimalRootLayout = () => {
  const navigate = useNavigate();
  const frameworkNavigate = (path: string) => navigate(path, { viewTransition: true });

  return (
    <LinkComponentProvider Link={Link} navigate={frameworkNavigate} paths={paths}>
      <MinimalLayout>
        <Outlet />
      </MinimalLayout>
    </LinkComponentProvider>
  );
};

// Determine platform status at module level for route configuration
const isMastraPlatform = Boolean(window.MASTRA_CLOUD_API_ENDPOINT);
const isExperimentalFeatures = coreFeatures.has('datasets');

const agentCmsChildRoutes = [
  { index: true, element: <CmsAgentInformationPage /> },
  { path: 'instruction-blocks', element: <CmsAgentInstructionBlocksPage /> },
  { path: 'tools', element: <CmsAgentToolsPage /> },
  { path: 'agents', element: <CmsAgentAgentsPage /> },
  { path: 'scorers', element: <CmsAgentScorersPage /> },
  { path: 'workflows', element: <CmsAgentWorkflowsPage /> },
  { path: 'skills', element: <CmsAgentSkillsPage /> },
  { path: 'memory', element: <CmsAgentMemoryPage /> },
  { path: 'variables', element: <CmsAgentVariablesPage /> },
];

// eslint-disable-next-line react-refresh/only-export-components -- routes are consumed by the router and tests.
export const routes: RouteObject[] = [
  // Auth pages - no layout
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <SignUp /> },
  {
    path: '/agent-builder',
    element: <AgentBuilderRootLayout paths={paths} />,
    children: [
      {
        index: true,
        element: <AgentBuilderRoot />,
      },
      {
        path: 'agents',
        element: <AgentBuilderLayout />,
        children: [
          {
            index: true,
            element: <AgentBuilderAgents />,
          },
        ],
      },
      {
        path: 'agents',
        element: <AgentBuilderEditionLayout />,
        children: [
          { path: 'create', element: <AgentBuilderCreate /> },
          {
            path: ':id',
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/agent-builder/agents/${params.id}/view`),
          },
          { path: ':id/edit', element: <AgentBuilderAgentEdit /> },
          { path: ':id/view', element: <AgentBuilderAgentView /> },
        ],
      },
      {
        path: 'skills',
        element: <AgentBuilderLayout />,
        children: [
          {
            index: true,
            element: <AgentBuilderSkills />,
          },
        ],
      },
      {
        path: 'skills',
        element: <AgentBuilderEditionLayout />,
        children: [
          { path: 'create', element: <AgentBuilderSkillsCreate /> },
          {
            path: ':id',
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/agent-builder/skills/${params.id}/edit`),
          },
          { path: ':id/edit', element: <AgentBuilderSkillsEdit /> },
          { path: ':id/view', element: <AgentBuilderSkillsView /> },
        ],
      },
      {
        path: 'infrastructure',
        element: <AgentBuilderLayout />,
        children: [
          {
            index: true,
            element: <AgentBuilderInfrastructure />,
          },
        ],
      },
      {
        path: 'favorite',
        element: <AgentBuilderLayout />,
        children: [
          {
            index: true,
            element: <AgentBuilderFavorite />,
          },
        ],
      },
      {
        path: 'library',
        element: <AgentBuilderLayout />,
        children: [
          {
            index: true,
            element: <AgentBuilderLibrary />,
          },
        ],
      },
    ],
  },
  {
    element: <MinimalRootLayout />,
    children: [
      { path: '/agents/:agentId/session', element: <AgentSession /> },
      { path: '/agents/:agentId/session/:threadId', element: <AgentSession /> },
    ],
  },
  {
    element: <RootLayout />,
    children: [
      // Conditional routes (non-platform only)
      ...(isMastraPlatform
        ? []
        : [
            { path: '/settings', element: <StudioSettingsPage /> },
            {
              path: '/templates',
              element: <Templates />,
            },
            {
              path: '/templates/:templateSlug',
              element: <Template />,
            },
          ]),

      { path: '/logs', element: <Logs /> },
      { path: '/evaluation', element: <Evaluation /> },
      { path: '/scorers', element: <Scorers /> },
      {
        path: '/scorers/:scorerId',
        element: <Scorer />,
      },
      { path: '/metrics', element: <Metrics /> },
      {
        path: '/intelligence',
        element: <SignalsOverviewPage />,
      },
      {
        path: '/intelligence/entities/:entityType/:entityId',
        element: <SignalsEntityDetailPage />,
      },
      { path: '/traces', element: <Traces /> },
      { path: '/inbox', element: <InboxPage /> },
      {
        path: '/traces/:traceId',
        loader: ({ params, request }: LoaderFunctionArgs) => {
          const search = new URL(request.url).searchParams;
          search.set('traceId', params.traceId ?? '');
          return redirect(`/traces?${search.toString()}`);
        },
      },
      {
        path: '/observability',
        loader: ({ request }: LoaderFunctionArgs) => redirect(`/traces${new URL(request.url).search}`),
      },
      { path: '/resources', element: <Resources /> },
      { path: '/agents', element: <Agents /> },
      {
        path: '/cms/agents/create',
        element: <CreateLayoutWrapper />,
        children: agentCmsChildRoutes,
      },
      {
        path: '/cms/agents/:agentId/edit',
        element: <EditLayoutWrapper />,
        children: agentCmsChildRoutes,
      },
      {
        path: '/cms/scorers/create',
        element: <CmsScorersCreatePage />,
      },
      {
        path: '/cms/scorers/:scorerId/edit',
        element: <CmsScorersEditPage />,
      },
      { path: '/prompts', element: <PromptBlocks /> },
      {
        path: '/cms/prompts/create',
        element: <CmsPromptBlocksCreatePage />,
      },
      {
        path: '/cms/prompts/:promptBlockId/edit',
        element: <CmsPromptBlocksEditPage />,
      },
      {
        path: '/agents/:agentId/tools/:toolId',
        element: <AgentTool />,
      },
      {
        path: '/agents/:agentId',
        element: (
          <AgentLayout>
            <Outlet />
          </AgentLayout>
        ),
        children: [
          {
            index: true,
            loader: agentIndexLoader,
          },
          { path: 'chat', loader: legacyAgentChatLoader },
          { path: 'chat/:threadId', loader: legacyAgentChatLoader },
          { path: 'threads', loader: agentThreadsIndexLoader },
          { path: 'threads/:threadId', element: <AgentThread /> },
          { path: 'overview', loader: legacyAgentSettingsLoader },
          { path: 'settings', loader: legacyAgentSettingsLoader },
          ...(isExperimentalFeatures ? [{ path: 'editor', element: <AgentPlayground /> }] : []),
          { path: 'traces', element: <AgentTraces /> },
          {
            // Channels is configuration, not a tool tab: it now lives in the
            // agent overview side panel. Keep old links working.
            path: 'channels',
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/agents/${params.agentId}/threads/new`),
          },
        ],
      },

      { path: '/tools', element: <Tools /> },
      {
        path: '/tools/:toolId',
        element: <Tool />,
      },

      {
        path: '/integrations',
        element: <IntegrationsPage />,
      },

      { path: '/processors', element: <Processors /> },
      {
        path: '/processors/:processorId',
        element: <Processor />,
      },

      { path: '/mcps', element: <MCPs /> },
      {
        path: '/mcps/:serverId',
        element: <McpServerPage />,
      },
      {
        path: '/mcps/:serverId/tools/:toolId',
        element: <MCPServerToolExecutor />,
      },

      { path: '/workspaces', element: <Workspace /> },
      { path: '/workspaces/:workspaceId', element: <Workspace /> },
      {
        path: '/workspaces/:workspaceId/skills/:skillName',
        element: <WorkspaceSkillDetailPage />,
      },

      { path: '/workflows', element: <Workflows /> },
      {
        path: '/workflows/schedules',
        element: <SchedulesPage />,
      },
      {
        path: '/workflows/schedules/:scheduleId',
        element: <SchedulePage />,
      },
      {
        path: '/workflows/:workflowId',
        element: (
          <WorkflowLayout>
            <Outlet />
          </WorkflowLayout>
        ),
        children: [
          {
            index: true,
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/workflows/${params.workflowId}/graph`),
          },
          { path: 'graph', element: <Workflow /> },
          {
            path: 'graph/:runId',
            element: <Workflow />,
          },
        ],
      },

      ...(isExperimentalFeatures
        ? [
            { path: '/datasets', element: <Datasets /> },
            {
              path: '/datasets/new',
              element: <CreateDatasetPage />,
            },
            {
              path: '/datasets/:datasetId',
              element: <DatasetPage />,
              children: [
                {
                  path: 'items/:itemId',
                  // Drawer is rendered by the dataset page; this route only carries params.
                  element: null,
                },
              ],
            },
            {
              path: '/datasets/:datasetId/edit',
              element: <EditDatasetPage />,
            },
            {
              path: '/datasets/:datasetId/items/:itemId/versions',
              element: <DatasetItemVersionsComparePage />,
            },
            { path: '/experiments', element: <Experiments /> },
            {
              path: '/experiments/compare',
              element: <CompareExperimentsPage />,
            },
            {
              path: '/experiments/review-queue',
              element: <ReviewQueuePage />,
            },
            {
              path: '/experiments/:experimentId',
              element: <ExperimentPage />,
              children: [
                {
                  path: 'items/:itemId',
                  // Drawer is rendered by the experiment page; this route only carries params.
                  element: null,
                },
              ],
            },
            {
              path: '/datasets/:datasetId/versions',
              element: <DatasetCompareDatasetVersions />,
            },
          ]
        : []),

      {
        index: true,
        element: <StudioIndexRedirect />,
      },
      { path: '/request-context', element: <RequestContext /> },
    ],
  },
];

function App() {
  const studioBasePath = window.MASTRA_STUDIO_BASE_PATH || '';
  const { baseUrl, headers, apiPrefix, isLoading } = useStudioConfig();

  // Create a stable fetch function that auto-refreshes on 401
  const customFetch = useMemo(
    () => (baseUrl ? createFetchWithRefresh(baseUrl, apiPrefix) : undefined),
    [baseUrl, apiPrefix],
  );
  const studioHeaders = useMemo(() => ({ ...headers, 'x-mastra-client-type': 'studio' }), [headers]);
  const router = useMemo(() => createBrowserRouter(routes, { basename: studioBasePath }), [studioBasePath]);

  if (isLoading) {
    // Config is loaded from localStorage. However, there might be a race condition
    // between the first tanstack resolution and the React useLayoutEffect where headers are not set yet on the first HTTP request.
    return null;
  }

  if (!baseUrl) {
    return <PlaygroundConfigGuard />;
  }

  return (
    <MastraReactProvider baseUrl={baseUrl} headers={studioHeaders} apiPrefix={apiPrefix} customFetch={customFetch}>
      <RoleImpersonationProvider>
        <PostHogProvider>
          <RoutePermissionsGate baseUrl={baseUrl}>
            <RouterProvider router={router} />
          </RoutePermissionsGate>
        </PostHogProvider>
      </RoleImpersonationProvider>
    </MastraReactProvider>
  );
}

export default function AppWrapper() {
  const protocol = window.MASTRA_SERVER_PROTOCOL || 'http';
  const host = window.MASTRA_SERVER_HOST || 'localhost';
  const port = window.MASTRA_SERVER_PORT || 4111;
  const apiPrefix = window.MASTRA_API_PREFIX || '/api';
  const cloudApiEndpoint = window.MASTRA_CLOUD_API_ENDPOINT || '';
  const autoDetectUrl = window.MASTRA_AUTO_DETECT_URL === 'true';
  const endpoint = cloudApiEndpoint || (autoDetectUrl ? window.location.origin : `${protocol}://${host}:${port}`);

  return (
    <PlaygroundQueryClient>
      <StudioConfigProvider endpoint={endpoint} defaultApiPrefix={apiPrefix}>
        <App />
      </StudioConfigProvider>
    </PlaygroundQueryClient>
  );
}
