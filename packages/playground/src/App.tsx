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
    MASTRA_AUTO_DETECT_URL?: string;
    MASTRA_REQUEST_CONTEXT_PRESETS?: string;
  }
}

import type { LinkComponentProviderProps } from '@mastra/playground-ui';
import { LinkComponentProvider, PlaygroundQueryClient } from '@mastra/playground-ui';
import { PlaygroundConfigGuard, StudioConfigProvider, useStudioConfig } from '@mastra/playground-ui/configuration';
import { MastraReactProvider } from '@mastra/react';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useNavigate, redirect } from 'react-router';
import { PostHogProvider } from './lib/analytics';
import { Link } from './lib/framework';
import { Login } from './pages/login';
import { SignUp } from './pages/signup';
import { Layout } from '@/components/layout';
import { PageLoader } from '@/components/page-loader';

// -- Domain layouts (lazy) --
const AgentLayout = lazy(() => import('@/domains/agents/agent-layout').then(m => ({ default: m.AgentLayout })));
const WorkflowLayout = lazy(() =>
  import('./domains/workflows/workflow-layout').then(m => ({ default: m.WorkflowLayout })),
);

// -- Agent pages --
const Agents = lazy(() => import('./pages/agents'));
const Agent = lazy(() => import('./pages/agents/agent'));
const AgentTool = lazy(() => import('./pages/tools/agent-tool'));

// -- CMS Agent pages --
const CreateLayoutWrapper = lazy(() =>
  import('./pages/cms/agents/create-layout').then(m => ({ default: m.CreateLayoutWrapper })),
);
const EditLayoutWrapper = lazy(() =>
  import('./pages/cms/agents/edit-layout').then(m => ({ default: m.EditLayoutWrapper })),
);
const CmsAgentAgentsPage = lazy(() => import('./pages/cms/agents/agents'));
const CmsAgentInformationPage = lazy(() => import('./pages/cms/agents/information'));
const CmsAgentInstructionBlocksPage = lazy(() => import('./pages/cms/agents/instruction-blocks'));
const CmsAgentMemoryPage = lazy(() => import('./pages/cms/agents/memory'));
const CmsAgentScorersPage = lazy(() => import('./pages/cms/agents/scorers'));
const CmsAgentSkillsPage = lazy(() => import('./pages/cms/agents/skills'));
const CmsAgentToolsPage = lazy(() => import('./pages/cms/agents/tools'));
const CmsAgentVariablesPage = lazy(() => import('./pages/cms/agents/variables'));
const CmsAgentWorkflowsPage = lazy(() => import('./pages/cms/agents/workflows'));

// -- CMS Prompt & Scorer pages --
const CmsPromptBlocksCreatePage = lazy(() => import('./pages/cms/prompt-blocks/create'));
const CmsPromptBlocksEditPage = lazy(() => import('./pages/cms/prompt-blocks/edit'));
const CmsScorersCreatePage = lazy(() => import('./pages/cms/scorers/create'));
const CmsScorersEditPage = lazy(() => import('./pages/cms/scorers/edit'));

// -- Workflow pages --
const Workflows = lazy(() => import('./pages/workflows'));
const Workflow = lazy(() => import('./pages/workflows/workflow').then(m => ({ default: m.Workflow })));

// -- Tool pages --
const Tools = lazy(() => import('@/pages/tools'));
const Tool = lazy(() => import('./pages/tools/tool'));

// -- Processor pages --
const Processors = lazy(() => import('@/pages/processors').then(m => ({ default: m.Processors })));
const Processor = lazy(() => import('@/pages/processors/processor').then(m => ({ default: m.Processor })));

// -- MCP pages --
const MCPs = lazy(() => import('./pages/mcps'));
const McpServerPage = lazy(() => import('./pages/mcps/[serverId]').then(m => ({ default: m.McpServerPage })));
const MCPServerToolExecutor = lazy(() => import('./pages/mcps/tool'));

// -- Observability & Scorers --
const Observability = lazy(() => import('./pages/observability'));
const Scorers = lazy(() => import('./pages/scorers'));
const Scorer = lazy(() => import('./pages/scorers/scorer'));

// -- Prompts --
const PromptBlocks = lazy(() => import('./pages/prompt-blocks'));

// -- Workspace --
const Workspace = lazy(() => import('./pages/workspace'));
const WorkspaceSkillDetailPage = lazy(() => import('./pages/workspace/skills/[skillName]'));

// -- Settings & Templates --
const StudioSettingsPage = lazy(() => import('./pages/settings').then(m => ({ default: m.StudioSettingsPage })));
const Templates = lazy(() => import('./pages/templates'));
const Template = lazy(() => import('./pages/templates/template'));

// -- Datasets (experimental) --
const Datasets = lazy(() => import('./pages/datasets'));
const DatasetPage = lazy(() => import('./pages/datasets/dataset'));
const DatasetExperiment = lazy(() => import('./pages/datasets/dataset/experiment'));
const CompareDatasetExperimentsPage = lazy(() => import('./pages/datasets/dataset/experiments'));
const DatasetItemPage = lazy(() => import('./pages/datasets/dataset/item'));
const DatasetItemsComparePage = lazy(() => import('./pages/datasets/dataset/item/compare'));
const DatasetItemVersionsComparePage = lazy(() => import('./pages/datasets/dataset/item/versions'));
const DatasetCompareDatasetVersions = lazy(() => import('./pages/datasets/dataset/versions'));

// -- Request Context --
const RequestContext = lazy(() => import('./pages/request-context'));

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
  promptBlockLink: (promptBlockId: string) => `/prompts/${promptBlockId}`,
  promptBlocksLink: () => '/prompts',
  cmsPromptBlockCreateLink: () => '/cms/prompts/create',
  cmsPromptBlockEditLink: (promptBlockId: string) => `/cms/prompts/${promptBlockId}/edit`,
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
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
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
  // Auth pages - no layout
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <SignUp /> },
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
            { path: '/datasets/:datasetId/experiments', element: <CompareDatasetExperimentsPage /> },
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
