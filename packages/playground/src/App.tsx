import { v4 as uuid } from '@lukeed/uuid';
import { Routes, Route, BrowserRouter, Outlet, useNavigate } from 'react-router';

import { Layout } from '@/components/layout';

import { AgentLayout } from '@/domains/agents/agent-layout';
import Tools from '@/pages/tools';

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

import { LinkComponentProvider, LinkComponentProviderProps, PlaygroundQueryClient } from '@mastra/playground-ui';
import { NavigateTo } from './lib/react-router';
import { Link } from './lib/framework';
import Scorers from './pages/scorers';
import Scorer from './pages/scorers/scorer';
import Observability from './pages/observability';
import Templates from './pages/templates';
import Template from './pages/templates/template';
import { MastraReactProvider } from '@mastra/react';

const paths: LinkComponentProviderProps['paths'] = {
  agentLink: (agentId: string) => `/agents/${agentId}`,
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentsLink: () => `/agents`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/chat/${uuid()}`,
  agentThreadLink: (agentId: string, threadId: string, messageId?: string) =>
    messageId ? `/agents/${agentId}/chat/${threadId}?messageId=${messageId}` : `/agents/${agentId}/chat/${threadId}`,
  workflowsLink: () => `/workflows`,
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  networkLink: (networkId: string) => `/networks/v-next/${networkId}/chat`,
  networkNewThreadLink: (networkId: string) => `/networks/v-next/${networkId}/chat/${uuid()}`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/v-next/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  toolLink: (toolId: string) => `/tools/${toolId}`,
  mcpServerLink: (serverId: string) => `/mcps/${serverId}`,
  mcpServerToolLink: (serverId: string, toolId: string) => `/mcps/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId: string, runId: string) => `/workflows/${workflowId}/graph/${runId}`,
};

const LinkComponentWrapper = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const frameworkNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <LinkComponentProvider Link={Link} navigate={frameworkNavigate} paths={paths}>
      {children}
    </LinkComponentProvider>
  );
};

function App() {
  return (
    <MastraReactProvider>
      <PlaygroundQueryClient>
        <PostHogProvider>
          <BrowserRouter>
            <LinkComponentWrapper>
              <Routes>
                <Route
                  element={
                    <Layout>
                      <Outlet />
                    </Layout>
                  }
                >
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/templates/:templateSlug" element={<Template />} />
                </Route>
                <Route
                  element={
                    <Layout>
                      <Outlet />
                    </Layout>
                  }
                >
                  <Route path="/scorers" element={<Scorers />} />
                  <Route path="/scorers/:scorerId" element={<Scorer />} />
                </Route>
                <Route
                  element={
                    <Layout>
                      <Outlet />
                    </Layout>
                  }
                >
                  <Route path="/observability" element={<Observability />} />
                </Route>
                <Route
                  element={
                    <Layout>
                      <Outlet />
                    </Layout>
                  }
                >
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/agents/:agentId" element={<NavigateTo to="/agents/:agentId/chat" />} />
                  <Route path="/agents/:agentId/tools/:toolId" element={<AgentTool />} />
                  <Route
                    path="/agents/:agentId"
                    element={
                      <AgentLayout>
                        <Outlet />
                      </AgentLayout>
                    }
                  >
                    <Route path="chat" element={<Agent />} />
                    <Route path="chat/:threadId" element={<Agent />} />
                  </Route>
                  <Route path="/tools" element={<Tools />} />

                  <Route path="/tools/:toolId" element={<Tool />} />
                  <Route path="/mcps" element={<MCPs />} />

                  <Route path="/mcps/:serverId" element={<McpServerPage />} />
                  <Route path="/mcps/:serverId/tools/:toolId" element={<MCPServerToolExecutor />} />

                  <Route path="/workflows" element={<Workflows />} />
                  <Route path="/workflows/:workflowId" element={<NavigateTo to="/workflows/:workflowId/graph" />} />

                  <Route
                    path="/workflows/:workflowId"
                    element={
                      <WorkflowLayout>
                        <Outlet />
                      </WorkflowLayout>
                    }
                  >
                    <Route path="/workflows/:workflowId/graph" element={<Workflow />} />
                    <Route path="/workflows/:workflowId/graph/:runId" element={<Workflow />} />
                  </Route>

                  <Route path="/" element={<NavigateTo to="/agents" />} />
                  <Route path="/request-context" element={<RequestContext />} />
                </Route>
              </Routes>
            </LinkComponentWrapper>
          </BrowserRouter>
        </PostHogProvider>
      </PlaygroundQueryClient>
    </MastraReactProvider>
  );
}

export default App;
