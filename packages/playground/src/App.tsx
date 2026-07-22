import { v4 as uuid } from '@lukeed/uuid';
import { coreFeatures } from '@mastra/core/features';
import { MastraReactProvider } from '@mastra/react';
import { CalendarClockIcon } from 'lucide-react';
import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useNavigate, redirect } from 'react-router';
import type { LoaderFunctionArgs, RouteObject } from 'react-router';
import { AgentBuilderRootLayout } from './domains/agent-builder/layouts/agent-builder-root-layout';
import { RoutePermissionGuard } from './domains/auth/components/route-permission-guard';
import { RoutePermissionsGate } from './domains/auth/components/route-permissions-gate';
import { DatasetCrumb } from './domains/datasets/dataset-crumb';
import { WorkflowLayout } from './domains/workflows/workflow-layout';
import SignalsOverviewPage from './ee/signals';
import { PostHogProvider } from './lib/analytics';
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
import TraceDetails from './pages/traces/trace';
import Workflows from './pages/workflows';
import SchedulePage from './pages/workflows/schedule';
import SchedulesPage from './pages/workflows/schedules';
import { Workflow } from './pages/workflows/workflow';
import Workspace from './pages/workspace';
import WorkspaceSkillDetailPage from './pages/workspace/skills/[skillName]';
import { Layout } from '@/components/layout';
import { MinimalLayout } from '@/components/minimal-layout';
import { AgentBuilderEditionLayout, AgentBuilderLayout } from '@/domains/agent-builder/layouts/agent-builder-layout';
import { AgentCrumb, AgentToolCrumb } from '@/domains/agents/agent-crumb';
import { AgentLayout } from '@/domains/agents/agent-layout';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import { createFetchWithRefresh } from '@/domains/auth/hooks/fetch-with-refresh';

import { PlaygroundConfigGuard } from '@/domains/configuration/components/playground-config-guard';
import { StudioConfigProvider } from '@/domains/configuration/context/studio-config-context';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';
import { McpServerCrumb, McpServerToolCrumb } from '@/domains/mcps/mcp-crumbs';
import { ProcessorCrumb } from '@/domains/processors/processor-crumb';
import { PromptBlockCrumb } from '@/domains/prompt-blocks/prompt-block-crumb';
import { StoredScorerCrumb, ScorerCrumb } from '@/domains/scores/scorer-crumb';
import { ToolCrumb } from '@/domains/tools/tool-crumb';
import { TraceCrumb } from '@/domains/traces/trace-crumb';
import { WorkflowCrumb, WorkflowRunCrumb } from '@/domains/workflows/workflow-crumbs';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { navCrumb, navHandle, navHandleWithChildren } from '@/lib/nav';
import type { CrumbDef, RouteHeaderHandle } from '@/lib/route-header';
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
  schedulesLink: () => `/workflows/schedules`,
  scheduleLink: (scheduleId: string) => `/workflows/schedules/${encodeURIComponent(scheduleId)}`,
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

const schedulesCrumb = {
  id: 'workflow-schedules',
  label: 'Schedules',
  icon: CalendarClockIcon,
  to: '/workflows/schedules',
} satisfies CrumbDef;

const decodeRouteParam = (value: string | undefined) => {
  if (!value) return '';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// eslint-disable-next-line react-refresh/only-export-components -- route metadata is covered by regression tests.
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
            { path: '/settings', element: <StudioSettingsPage />, handle: navHandle('/settings') },
            {
              path: '/templates',
              element: <Templates />,
              handle: { crumbs: [{ id: 'templates', label: 'Templates' }] },
            },
            {
              path: '/templates/:templateSlug',
              element: <Template />,
              handle: {
                crumbs: ({ params }) => [
                  { id: 'templates', label: 'Templates', to: '/templates' },
                  { id: 'template', label: decodeRouteParam(params.templateSlug) },
                ],
              } satisfies RouteHeaderHandle,
            },
          ]),

      { path: '/logs', element: <Logs />, handle: navHandle('/logs') },
      { path: '/evaluation', element: <Evaluation />, handle: navHandle('/evaluation') },
      { path: '/scorers', element: <Scorers />, handle: navHandle('/scorers') },
      {
        path: '/scorers/:scorerId',
        element: <Scorer />,
        handle: navHandleWithChildren('/scorers', [{ id: 'scorer', Component: ScorerCrumb, heading: 'Scorer' }]),
      },
      { path: '/metrics', element: <Metrics />, handle: navHandle('/metrics') },
      { path: '/signals', element: <SignalsOverviewPage />, handle: navHandle('/signals') },
      { path: '/observability', element: <Traces />, handle: navHandle('/observability') },
      {
        path: '/traces/:traceId',
        element: <TraceDetails />,
        handle: navHandleWithChildren('/observability', [{ id: 'trace', Component: TraceCrumb, heading: 'Trace' }]),
      },
      { path: '/resources', element: <Resources />, handle: navHandle('/resources') },
      { path: '/agents', element: <Agents />, handle: navHandle('/agents') },
      {
        path: '/cms/agents/create',
        element: <CreateLayoutWrapper />,
        handle: navHandleWithChildren('/agents', [{ id: 'create-agent', label: 'Create agent' }]),
        children: agentCmsChildRoutes,
      },
      {
        path: '/cms/agents/:agentId/edit',
        element: <EditLayoutWrapper />,
        handle: navHandleWithChildren('/agents', [{ id: 'agent', Component: AgentCrumb, heading: 'Agent' }]),
        children: agentCmsChildRoutes,
      },
      {
        path: '/cms/scorers/create',
        element: <CmsScorersCreatePage />,
        handle: navHandleWithChildren('/scorers', [{ id: 'create-scorer', label: 'Create scorer' }]),
      },
      {
        path: '/cms/scorers/:scorerId/edit',
        element: <CmsScorersEditPage />,
        handle: navHandleWithChildren('/scorers', [{ id: 'scorer', Component: StoredScorerCrumb, heading: 'Scorer' }]),
      },
      { path: '/prompts', element: <PromptBlocks />, handle: navHandle('/prompts') },
      {
        path: '/cms/prompts/create',
        element: <CmsPromptBlocksCreatePage />,
        handle: navHandleWithChildren('/prompts', [{ id: 'create-prompt-block', label: 'Create prompt block' }]),
      },
      {
        path: '/cms/prompts/:promptBlockId/edit',
        element: <CmsPromptBlocksEditPage />,
        handle: navHandleWithChildren('/prompts', [
          { id: 'prompt-block', Component: PromptBlockCrumb, heading: 'Prompt block' },
        ]),
      },
      {
        path: '/agents/:agentId/tools/:toolId',
        element: <AgentTool />,
        handle: navHandleWithChildren('/agents', [
          { id: 'agent', Component: AgentCrumb, heading: 'Agent' },
          { id: 'agent-tool', Component: AgentToolCrumb, heading: 'Agent tool' },
        ]),
      },
      {
        path: '/agents/:agentId',
        element: (
          <AgentLayout>
            <Outlet />
          </AgentLayout>
        ),
        handle: navHandleWithChildren('/agents', [{ id: 'agent', Component: AgentCrumb, heading: 'Agent' }]),
        children: [
          {
            index: true,
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/agents/${params.agentId}/chat`),
          },
          { path: 'chat', element: <Agent /> },
          { path: 'chat/:threadId', element: <Agent /> },
          { path: 'settings', element: <Agent view="settings" /> },
          ...(isExperimentalFeatures
            ? [
                { path: 'editor', element: <AgentPlayground /> },
                { path: 'evaluate', element: <AgentEvaluate /> },
                { path: 'review', element: <AgentReview /> },
              ]
            : []),
          { path: 'traces', element: <AgentTraces /> },
          {
            // Channels is configuration, not a tool tab: it now lives in the
            // agent settings view. Keep old links working.
            path: 'channels',
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/agents/${params.agentId}/settings?tab=channels`),
          },
        ],
      },

      { path: '/tools', element: <Tools />, handle: navHandle('/tools') },
      {
        path: '/tools/:toolId',
        element: <Tool />,
        handle: navHandleWithChildren('/tools', [{ id: 'tool', Component: ToolCrumb, heading: 'Tool' }]),
      },

      {
        path: '/integrations',
        element: <IntegrationsPage />,
        handle: { crumbs: [{ id: 'integrations', label: 'Integrations' }] } satisfies RouteHeaderHandle,
      },

      { path: '/processors', element: <Processors />, handle: navHandle('/processors') },
      {
        path: '/processors/:processorId',
        element: <Processor />,
        handle: navHandleWithChildren('/processors', [
          { id: 'processor', Component: ProcessorCrumb, heading: 'Processor' },
        ]),
      },

      { path: '/mcps', element: <MCPs />, handle: navHandle('/mcps') },
      {
        path: '/mcps/:serverId',
        element: <McpServerPage />,
        handle: navHandleWithChildren('/mcps', [
          { id: 'mcp-server', Component: McpServerCrumb, heading: 'MCP server' },
        ]),
      },
      {
        path: '/mcps/:serverId/tools/:toolId',
        element: <MCPServerToolExecutor />,
        handle: navHandleWithChildren('/mcps', [
          { id: 'mcp-server', Component: McpServerCrumb, heading: 'MCP server' },
          { id: 'mcp-server-tool', Component: McpServerToolCrumb, heading: 'MCP server tool' },
        ]),
      },

      { path: '/workspaces', element: <Workspace />, handle: navHandle('/workspaces') },
      { path: '/workspaces/:workspaceId', element: <Workspace />, handle: navHandle('/workspaces') },
      {
        path: '/workspaces/:workspaceId/skills/:skillName',
        element: <WorkspaceSkillDetailPage />,
        handle: {
          crumbs: ({ params }) => [
            navCrumb('/workspaces'),
            {
              id: 'workspace',
              label: decodeRouteParam(params.workspaceId),
              to: params.workspaceId ? `/workspaces/${encodeURIComponent(params.workspaceId)}` : undefined,
            },
            { id: 'skill', label: decodeRouteParam(params.skillName) },
          ],
        } satisfies RouteHeaderHandle,
      },

      { path: '/workflows', element: <Workflows />, handle: navHandle('/workflows') },
      {
        path: '/workflows/schedules',
        element: <SchedulesPage />,
        handle: navHandleWithChildren('/workflows', [schedulesCrumb]),
      },
      {
        path: '/workflows/schedules/:scheduleId',
        element: <SchedulePage />,
        handle: {
          crumbs: ({ params }) => [
            navCrumb('/workflows'),
            schedulesCrumb,
            { id: 'schedule', label: decodeRouteParam(params.scheduleId), icon: CalendarClockIcon },
          ],
        } satisfies RouteHeaderHandle,
      },
      {
        path: '/workflows/:workflowId',
        element: (
          <WorkflowLayout>
            <Outlet />
          </WorkflowLayout>
        ),
        handle: navHandleWithChildren('/workflows', [
          { id: 'workflow', Component: WorkflowCrumb, heading: 'Workflow' },
        ]),
        children: [
          {
            index: true,
            loader: ({ params }: LoaderFunctionArgs) => redirect(`/workflows/${params.workflowId}/graph`),
          },
          { path: 'graph', element: <Workflow /> },
          {
            path: 'graph/:runId',
            element: <Workflow />,
            handle: {
              crumbs: [{ id: 'workflow-run', Component: WorkflowRunCrumb, heading: 'Workflow run' }],
            } satisfies RouteHeaderHandle,
          },
        ],
      },

      ...(isExperimentalFeatures
        ? [
            { path: '/datasets', element: <Datasets />, handle: navHandle('/datasets') },
            {
              path: '/datasets/:datasetId',
              element: <DatasetPage />,
              handle: {
                crumbs: () => [navCrumb('/datasets'), { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' }],
              } satisfies RouteHeaderHandle,
            },
            {
              path: '/datasets/:datasetId/items/:itemId',
              element: <DatasetItemPage />,
              handle: {
                crumbs: ({ params }) => [
                  navCrumb('/datasets'),
                  { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' },
                  { id: 'dataset-item', label: decodeRouteParam(params.itemId) },
                ],
              } satisfies RouteHeaderHandle,
            },
            {
              path: '/datasets/:datasetId/items/:itemId/versions',
              element: <DatasetItemVersionsComparePage />,
              handle: {
                crumbs: ({ params }) => [
                  navCrumb('/datasets'),
                  { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' },
                  {
                    id: 'dataset-item',
                    label: decodeRouteParam(params.itemId),
                    to:
                      params.datasetId && params.itemId
                        ? `/datasets/${encodeURIComponent(params.datasetId)}/items/${encodeURIComponent(params.itemId)}`
                        : undefined,
                  },
                  { id: 'dataset-item-versions', label: 'Versions' },
                ],
              } satisfies RouteHeaderHandle,
            },
            {
              path: '/datasets/:datasetId/experiments/:experimentId',
              element: <DatasetExperiment />,
              handle: {
                crumbs: ({ params }) => [
                  navCrumb('/datasets'),
                  { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' },
                  { id: 'dataset-experiment', label: decodeRouteParam(params.experimentId) },
                ],
              } satisfies RouteHeaderHandle,
            },
            { path: '/experiments', element: <Experiments />, handle: navHandle('/experiments') },
            {
              path: '/experiments/:experimentId',
              element: <ExperimentPage />,
              handle: {
                crumbs: ({ params }) => [
                  navCrumb('/experiments'),
                  { id: 'experiment', label: decodeRouteParam(params.experimentId) },
                ],
              } satisfies RouteHeaderHandle,
            },
            {
              path: '/datasets/:datasetId/experiments',
              element: <CompareDatasetExperimentsPage />,
              handle: {
                crumbs: () => [
                  navCrumb('/datasets'),
                  { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' },
                  { id: 'dataset-experiments', label: 'Experiments' },
                ],
              },
            },
            {
              path: '/datasets/:datasetId/items',
              element: <DatasetItemsComparePage />,
              handle: {
                crumbs: () => [
                  navCrumb('/datasets'),
                  { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' },
                  { id: 'dataset-items', label: 'Items' },
                ],
              },
            },
            {
              path: '/datasets/:datasetId/versions',
              element: <DatasetCompareDatasetVersions />,
              handle: {
                crumbs: () => [
                  navCrumb('/datasets'),
                  { id: 'dataset', Component: DatasetCrumb, heading: 'Dataset' },
                  { id: 'dataset-versions', label: 'Versions' },
                ],
              },
            },
          ]
        : []),

      {
        index: true,
        element: <StudioIndexRedirect />,
        handle: { crumbs: [{ id: 'home', label: 'Home' }] },
      },
      { path: '/request-context', element: <RequestContext />, handle: navHandle('/request-context') },
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
