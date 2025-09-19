import { v4 as uuid } from '@lukeed/uuid';
import { Routes, Route, BrowserRouter, Outlet, useNavigate } from 'react-router';

import { Layout } from '@/components/layout';

import { AgentLayout } from '@/domains/agents/agent-layout';
import Tools from '@/pages/tools';

import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import AgentEvalsPage from './pages/agents/agent/evals';
import AgentTracesPage from './pages/agents/agent/traces';
import AgentTool from './pages/tools/agent-tool';
import Tool from './pages/tools/tool';
import Workflows from './pages/workflows';
import { Workflow } from './pages/workflows/workflow';
import WorkflowTracesPage from './pages/workflows/workflow/traces';
import Networks from './pages/networks';
import { NetworkLayout } from './domains/networks/network-layout';
import { WorkflowLayout } from './domains/workflows/workflow-layout';
import { PostHogProvider } from './lib/analytics';
import RuntimeContext from './pages/runtime-context';
import MCPs from './pages/mcps';
import MCPServerToolExecutor from './pages/mcps/tool';

import { McpServerPage } from './pages/mcps/[serverId]';

import {
  LinkComponentProvider,
  LinkComponentProviderProps,
  MastraClientProvider,
  PlaygroundQueryClient,
} from '@mastra/playground-ui';
import VNextNetwork from './pages/networks/network/v-next';
import { NavigateTo } from './lib/react-router';
import { Link } from './lib/framework';
import Scorers from './pages/scorers';
import Scorer from './pages/scorers/scorer';
import Observability from './pages/observability';
import Templates from './pages/templates';
import Template from './pages/templates/template';

const paths: LinkComponentProviderProps['paths'] = {
  agentLink: (agentId: string) => `/agents/${agentId}`,
  agentToolLink: (agentId: string, toolId: string) => `/agents/${agentId}/tools/${toolId}`,
  agentsLink: () => `/agents`,
  agentNewThreadLink: (agentId: string) => `/agents/${agentId}/chat/${uuid()}`,
  agentThreadLink: (agentId: string, threadId: string) => `/agents/${agentId}/chat/${threadId}`,
  workflowsLink: () => `/workflows`,
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
  networkLink: (networkId: string) => `/networks/v-next/${networkId}/chat`,
  networkNewThreadLink: (networkId: string) => `/networks/v-next/${networkId}/chat/${uuid()}`,
  networkThreadLink: (networkId: string, threadId: string) => `/networks/v-next/${networkId}/chat/${threadId}`,
  scorerLink: (scorerId: string) => `/scorers/${scorerId}`,
  toolLink: (toolId: string) => `/tools/all/${toolId}`,
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
    <PlaygroundQueryClient>
      <PostHogProvider>
        <MastraClientProvider>
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
                  <Route path="/networks" element={<Networks />} />
                  <Route
                    path="/networks/v-next/:networkId"
                    element={<NavigateTo to="/networks/v-next/:networkId/chat" />}
                  />
                  <Route
                    path="/networks/v-next/:networkId"
                    element={
                      <NetworkLayout>
                        <Outlet />
                      </NetworkLayout>
                    }
                  >
                    <Route path="chat" element={<VNextNetwork />} />
                    <Route path="chat/:threadId" element={<VNextNetwork />} />
                  </Route>
                  <Route path="/networks/:networkId" element={<NavigateTo to="/networks/:networkId/chat" />} />
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
                    <Route path="evals" element={<AgentEvalsPage />} />
                    <Route path="traces" element={<AgentTracesPage />} />
                  </Route>
                  <Route path="/tools" element={<Tools />} />

                  <Route path="/tools/all/:toolId" element={<Tool />} />
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
                    <Route path="traces" element={<WorkflowTracesPage />} />
                    <Route path="/workflows/:workflowId/graph" element={<Workflow />} />
                    <Route path="/workflows/:workflowId/graph/:runId" element={<Workflow />} />
                  </Route>

                  <Route path="/" element={<NavigateTo to="/agents" />} />
                  <Route path="/runtime-context" element={<RuntimeContext />} />
                </Route>
              </Routes>
            </LinkComponentWrapper>
          </BrowserRouter>
        </MastraClientProvider>
      </PostHogProvider>
    </PlaygroundQueryClient>
  );
}

export default App;
