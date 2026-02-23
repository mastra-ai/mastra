import { coreFeatures } from '@mastra/core/features';
import { v4 as uuid } from '@lukeed/uuid';
import { createBrowserRouter, RouterProvider, Outlet, useNavigate, redirect } from 'react-router';

import { Layout } from '@/components/layout';

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
    MASTRA_REQUEST_CONTEXT_PRESETS?: string;
  }
}

import { AgentLayout } from '@/domains/agents/agent-layout';
import Tools from '@/pages/tools';
import { Processors } from '@/pages/processors';
import { Processor } from '@/pages/processors/processor';

import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import AgentTool from './pages/tools/agent-tool';
import Tool from './pages/tools/tool';
import Workflows from './pages/workflows';
import { Workflow } from './pages/workflows/workflow';
import { WorkflowLayout } from './domains/workflows/workflow-layout';
import { PostHogProvider } from './lib/analytics';
import RequestContext from './pages/request-context';
import MCPs from './pages/mcps';
import MCPServerToolExecutor from './pages/mcps/tool';

import { McpServerPage } from './pages/mcps/[serverId]';

import {
  LinkComponentProvider,
  LinkComponentProviderProps,
  PlaygroundConfigGuard,
  PlaygroundQueryClient,
  StudioConfigProvider,
  useStudioConfig,
} from '@mastra/playground-ui';
import { Link } from './lib/framework';
import Scorers from './pages/scorers';
import Scorer from './pages/scorers/scorer';
import Observability from './pages/observability';
import Workspace from './pages/workspace';
import WorkspaceSkillDetailPage from './pages/workspace/skills/[skillName]';
import Templates from './pages/templates';
import Template from './pages/templates/template';
import { MastraReactProvider } from '@mastra/react';
import { StudioSettingsPage } from './pages/settings';
import { CreateLayoutWrapper } from './pages/cms/agents/create-layout';
import { EditLayoutWrapper } from './pages/cms/agents/edit-layout';
import CmsAgentInformationPage from './pages/cms/agents/information';
import CmsAgentToolsPage from './pages/cms/agents/tools';
import CmsAgentAgentsPage from './pages/cms/agents/agents';
import CmsAgentScorersPage from './pages/cms/agents/scorers';
import CmsAgentWorkflowsPage from './pages/cms/agents/workflows';
import CmsAgentMemoryPage from './pages/cms/agents/memory';
import CmsAgentVariablesPage from './pages/cms/agents/variables';
import CmsAgentSkillsPage from './pages/cms/agents/skills';
import CmsAgentInstructionBlocksPage from './pages/cms/agents/instruction-blocks';
import CmsScorersCreatePage from './pages/cms/scorers/create';
import CmsScorersEditPage from './pages/cms/scorers/edit';
import Datasets from './pages/datasets';
import DatasetPage from './pages/datasets/dataset';
import DatasetItemPage from './pages/datasets/dataset/item';
import DatasetExperiment from './pages/datasets/dataset/experiment';
import DatasetCompare from './pages/datasets/dataset/compare';
import DatasetItemsComparePage from './pages/datasets/dataset/item/compare';
import DatasetItemVersionsComparePage from './pages/datasets/dataset/item/versions';
import DatasetCompareDatasetVersions from './pages/datasets/dataset/versions';

const paths: LinkComponentProviderProps['paths'] = {
  agentLink: (agentId: string) => `/agents/${agentId}/chat/new`,
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId: string, skillName: string, workspaceId?: string) =>
    workspaceId
      ? `/workspaces/${workspaceId}/skills/${skillName}?agentId=${encodeURIComponent(agentId)}`
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
  toolLink: (toolId: string) => `/tools/${toolId}`,
  skillLink: (skillName: string, workspaceId?: string) =>
    workspaceId ? `/workspaces/${workspaceId}/skills/${skillName}` : `/workspaces`,
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
  workspaceSkillLink: (skillName: string, workspaceId?: string) =>
    workspaceId ? `/workspaces/${workspaceId}/skills/${skillName}` : `/workspaces`,
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
};

const RootLayout = () => {
  const navigate = useNavigate();
  const frameworkNavigate = (path: string) => navigate(path, { viewTransition: true });

  return (
    <LinkComponentProvider Link={Link} navigate={frameworkNavigate} paths={paths}>
      <Layout>
        <Outlet />
      </Layout>
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

      { path: '/scorers', element: <Scorers /> },
      { path: '/scorers/:scorerId', element: <Scorer /> },
      { path: '/observability', element: <Observability /> },
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
            { path: '/datasets/:datasetId/items/:itemId/versions', element: <DatasetItemVersionsComparePage /> },
            { path: '/datasets/:datasetId/experiments/:experimentId', element: <DatasetExperiment /> },
            { path: '/datasets/:datasetId/compare', element: <DatasetCompare /> },
            { path: '/datasets/:datasetId/items', element: <DatasetItemsComparePage /> },
            { path: '/datasets/:datasetId/versions', element: <DatasetCompareDatasetVersions /> },
          ]
        : []),

      { index: true, loader: () => redirect('/agents') },
      { path: '/request-context', element: <RequestContext /> },
    ],
  },
];

function App() {
  const studioBasePath = window.MASTRA_STUDIO_BASE_PATH || '';
  const { baseUrl, headers, apiPrefix, isLoading } = useStudioConfig();

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
    <MastraReactProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix}>
      <PostHogProvider>
        <RouterProvider router={router} />
      </PostHogProvider>
    </MastraReactProvider>
  );
}

export default function AppWrapper() {
  const protocol = window.MASTRA_SERVER_PROTOCOL || 'http';
  const host = window.MASTRA_SERVER_HOST || 'localhost';
  const port = window.MASTRA_SERVER_PORT || 4111;
  const apiPrefix = window.MASTRA_API_PREFIX || '/api';
  const cloudApiEndpoint = window.MASTRA_CLOUD_API_ENDPOINT || '';
  const endpoint = cloudApiEndpoint || `${protocol}://${host}:${port}`;

  return (
    <PlaygroundQueryClient>
      <StudioConfigProvider endpoint={endpoint} defaultApiPrefix={apiPrefix}>
        <App />
      </StudioConfigProvider>
    </PlaygroundQueryClient>
  );
}
