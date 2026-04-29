import { v4 as uuid } from '@lukeed/uuid';
import { coreFeatures } from '@mastra/core/features';

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
    MASTRA_EXPERIMENTAL_FEATURES?: string;
    MASTRA_TEMPLATES?: string;
    MASTRA_AUTO_DETECT_URL?: string;
    MASTRA_REQUEST_CONTEXT_PRESETS?: string;
    MASTRA_EXPERIMENTAL_UI?: string;
  }
}

import { MastraReactProvider } from '@mastra/react';
import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useNavigate, redirect } from 'react-router';
import { AgentBuilderRootLayout } from './domains/agent-builder/layout/agent-builder-root-layout';
import { StudioIndexRedirect } from './domains/agent-studio/components/studio-index-redirect';
import { RoutePermissionGuard } from './domains/auth/components/route-permission-guard';
import { WorkflowLayout } from './domains/workflows/workflow-layout';
import { PostHogProvider } from './lib/analytics';
import { Link } from './lib/link';
import { AgentBuilderRoot } from './pages/agent-builder';
import AgentBuilderAgents from './pages/agent-builder/agents';
import AgentBuilderCreate from './pages/agent-builder/agents/create';
import AgentBuilderAgentEdit from './pages/agent-builder/agents/edit';
import AgentBuilderAgentView from './pages/agent-builder/agents/view';
import AgentBuilderFavorite from './pages/agent-builder/favorite';
import AgentBuilderLibrary from './pages/agent-builder/library';
import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import AgentSession from './pages/agents/agent/session';
import AgentEvaluate from './pages/agents/agent-evaluate';
import AgentPlayground from './pages/agents/agent-playground';
import AgentReview from './pages/agents/agent-review';
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
import DatasetExperiment from './pages/datasets/dataset/experiment';
import CompareDatasetExperimentsPage from './pages/datasets/dataset/experiments';
import DatasetItemPage from './pages/datasets/dataset/item';
import DatasetItemsComparePage from './pages/datasets/dataset/item/compare';
import DatasetItemVersionsComparePage from './pages/datasets/dataset/item/versions';
import DatasetCompareDatasetVersions from './pages/datasets/dataset/versions';
import Evaluation from './pages/evaluation';
import Experiments from './pages/experiments';
import ExperimentPage from './pages/experiments/experiment';
import { Login } from './pages/login';
import Logs from './pages/logs';
import MCPs from './pages/mcps';
import { McpServerPage } from './pages/mcps/[serverId]';
import MCPServerToolExecutor from './pages/mcps/tool';
import Metrics from './pages/metrics';
import ObservabilityOverview from './pages/observability-overview';
import Primitives from './pages/primitives';
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
import TraceDetails from './pages/traces/trace';
import Workflows from './pages/workflows';
import { Workflow } from './pages/workflows/workflow';
import Workspace from './pages/workspace';
import WorkspaceSkillDetailPage from './pages/workspace/skills/[skillName]';
import { Layout } from '@/components/layout';
import { MinimalLayout } from '@/components/minimal-layout';
import { AgentBuilderEditionLayout, AgentBuilderLayout } from '@/domains/agent-builder/layout/agent-builder-layout';
import { AgentLayout } from '@/domains/agents/agent-layout';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import { createFetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';

import { PlaygroundConfigGuard } from '@/domains/configuration/components/playground-config-guard';
import { StudioConfigProvider, useStudioConfig } from '@/domains/configuration/context/studio-config-context';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { PlaygroundQueryClient } from '@/lib/tanstack-query';
import { Processors } from '@/pages/processors';
import { Processor } from '@/pages/processors/processor';
import Tools from '@/pages/tools';

const paths: LinkComponentProviderProps['paths'] = {
  agentLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId: string, skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${encodeURIComponent(skillName)}?agentId=${encodeURIComponent(agentId)}${skillPath ? `&path=${encodeURIComponent(skillPath)}` : ''}`
      : `/workspaces`,
  agentsLink: () => `/agents`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentThreadLink: (agentId: string, threadId: string, messageId?: string) =>
    messageId ? `/agents/${agentId}/chat/${threadId}?messageId=${messageId}` : `/agents/${agentId}/chat/${threadId}`,
  workflowsLink: () => `/workflows`,
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  networkLink: (networkId: string) => `/networks/v-next/${networkId}/chat`,
  networkNewThreadLink: (networkId: string) => `/networks/v-next/${networkId}/chat/${uuid()}`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/v-next/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: (scorerId: string) => `/cms/scorers/${scorerId}/edit`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  cmsAgentEditLink: (agentId: string) => `/cms/agents/${agentId}/edit`,
  promptBlockLink: (promptBlockId: string) => `/prompts/${promptBlockId}`,
  promptBlocksLink: () => '/prompts',
  cmsPromptBlockCreateLink: () => '/cms/prompts/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompts/${promptBlockId}/edit`,
  toolLink: (toolId: string) => `/tools/${toolId}`,
  skillLink: (skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${encodeURIComponent(skillName)}${skillPath ? `?path=${encodeURIComponent(skillPath)}` : ''}`
      : `/workspaces`,
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
  workspaceSkillLink: (skillName: string, skillPath?: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${encodeURIComponent(skillName)}${skillPath ? `?path=${encodeURIComponent(skillPath)}` : ''}`
      : `/workspaces`,
  workspacesLink: () => `/workspaces`,
  processorsLink: () => `/processors`,
  processorLink: (processorId: string) => `/processors/${processorId}`,
  mcpServerLink: (serverId: string) => `/mcps/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcps/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/graph/${runId}`,
  datasetLink: (datasetId: string) => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId: string, itemId: string) => `/datasets/${datasetId}/items/${itemId}`,
  datasetExperimentLink: (datasetId: string, experimentId: string) =>
    `/datasets/${datasetId}/experiments/${experimentId}`,
  experimentLink: (experimentId: string) => `/experiments/${experimentId}`,
};

const RootLayout = () => {
  const navigate = useNavigate();
  const frameworkNavigate = (path: string) => navigate(path, { viewTransition: true });

  return (
    <LinkComponentProvider Link={Link} navigate={frameworkNavigate} paths={paths}>
      <Layout>
        <RoutePermissionGuard>
          <Outlet />
        </RoutePermissionGuard>
      </Layout>
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

const routes = [
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
          { path: ':id/edit', element: <AgentBuilderAgentEdit /> },
          { path: ':id/view', element: <AgentBuilderAgentView /> },
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
            { path: '/templates', element: <Templates /> },
            { path: '/templates/:templateSlug', element: <Template /> },
          ]),

      { path: '/logs', element: <Logs /> },
      { path: '/primitives', element: <Primitives /> },
      { path: '/evaluation', element: <Evaluation /> },
      { path: '/scorers', element: <Scorers /> },
      { path: '/scorers/:scorerId', element: <Scorer /> },
      { path: '/metrics', element: <Metrics /> },
      { path: '/observability-overview', element: <ObservabilityOverview /> },
      { path: '/observability', element: <Traces /> },
      { path: '/traces/:traceId', element: <TraceDetails /> },
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
      { path: '/cms/scorers/create', element: <CmsScorersCreatePage /> },
      { path: '/cms/scorers/:scorerId/edit', element: <CmsScorersEditPage /> },
      { path: '/prompts', element: <PromptBlocks /> },
      { path: '/cms/prompts/create', element: <CmsPromptBlocksCreatePage /> },
      { path: '/cms/prompts/:promptBlockId/edit', element: <CmsPromptBlocksEditPage /> },
      { path: '/agents/:agentId/tools/:toolId', element: <AgentTool /> },
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
            loader: ({ params }: { params: { agentId: string } }) => redirect(`/agents/${params.agentId}/chat`),
          },
          { path: 'chat', element: <Agent /> },
          { path: 'chat/:threadId', element: <Agent /> },
          ...(isExperimentalFeatures
            ? [
                { path: 'editor', element: <AgentPlayground /> },
                { path: 'evaluate', element: <AgentEvaluate /> },
                { path: 'review', element: <AgentReview /> },
              ]
            : []),
          { path: 'traces', element: <AgentTraces /> },
        ],
      },

      { path: '/tools', element: <Tools /> },
      { path: '/tools/:toolId', element: <Tool /> },

      { path: '/processors', element: <Processors /> },
      { path: '/processors/:processorId', element: <Processor /> },

      { path: '/mcps', element: <MCPs /> },
      { path: '/mcps/:serverId', element: <McpServerPage /> },
      { path: '/mcps/:serverId/tools/:toolId', element: <MCPServerToolExecutor /> },

      { path: '/workspaces', element: <Workspace /> },
      { path: '/workspaces/:workspaceId', element: <Workspace /> },
      { path: '/workspaces/:workspaceId/skills/:skillName', element: <WorkspaceSkillDetailPage /> },

      { path: '/workflows', element: <Workflows /> },
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
            loader: ({ params }: { params: { workflowId: string } }) =>
              redirect(`/workflows/${params.workflowId}/graph`),
          },
          { path: 'graph', element: <Workflow /> },
          { path: 'graph/:runId', element: <Workflow /> },
        ],
      },

      ...(isExperimentalFeatures
        ? [
            { path: '/datasets', element: <Datasets /> },
            { path: '/datasets/:datasetId', element: <DatasetPage /> },
            { path: '/datasets/:datasetId/items/:itemId', element: <DatasetItemPage /> },
            {
              path: '/datasets/:datasetId/items/:itemId/versions',
              element: <DatasetItemVersionsComparePage />,
            },
            { path: '/datasets/:datasetId/experiments/:experimentId', element: <DatasetExperiment /> },
            { path: '/experiments', element: <Experiments /> },
            { path: '/experiments/:experimentId', element: <ExperimentPage /> },
            { path: '/datasets/:datasetId/experiments', element: <CompareDatasetExperimentsPage /> },
            { path: '/datasets/:datasetId/items', element: <DatasetItemsComparePage /> },
            { path: '/datasets/:datasetId/versions', element: <DatasetCompareDatasetVersions /> },
          ]
        : []),

      { index: true, element: <StudioIndexRedirect /> },
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

  if (isLoading) {
    // Config is loaded from localStorage. However, there might be a race condition
    // between the first tanstack resolution and the React useLayoutEffect where headers are not set yet on the first HTTP request.
    return null;
  }

  if (!baseUrl) {
    return <PlaygroundConfigGuard />;
  }

  const router = createBrowserRouter(routes, { basename: studioBasePath });

  return (
    <MastraReactProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix} customFetch={customFetch}>
      <RoleImpersonationProvider>
        <PostHogProvider>
          <RouterProvider router={router} />
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
