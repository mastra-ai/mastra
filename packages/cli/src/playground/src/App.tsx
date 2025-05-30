import { Routes, Route, BrowserRouter, Navigate, Outlet } from 'react-router';

import { Layout } from '@/components/layout';

import { AgentLayout } from '@/domains/agents/agent-layout';
import { LegacyWorkflowLayout } from '@/domains/workflows/legacy-workflow-layout';
import Tools from '@/pages/tools';

import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import AgentEvalsPage from './pages/agents/agent/evals';
import AgentTracesPage from './pages/agents/agent/traces';
import AgentTool from './pages/tools/agent-tool';
import Tool from './pages/tools/tool';
import Workflows from './pages/workflows';
import { Workflow } from './pages/workflows/workflow';
import LegacyWorkflow from './pages/workflows/workflow/legacy';
import WorkflowTracesPage from './pages/workflows/workflow/traces';
import LegacyWorkflowTracesPage from './pages/workflows/workflow/legacy/traces';
import Networks from './pages/networks';
import { NetworkLayout } from './domains/networks/network-layout';
import { WorkflowLayout } from './domains/workflows/workflow-layout';
import Network from './pages/networks/network';
import { PostHogProvider } from './lib/analytics';
import RuntimeContext from './pages/runtime-context';
import MCPs from './pages/mcps';
import MCPServerToolExecutor from './pages/mcps/tool';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { McpServerPage } from './pages/mcps/[serverId]';
import { WorkflowGraphLayout } from './pages/workflows/layouts/workflow-graph-layout';
import { MastraClientProvider } from '@mastra/playground-ui';

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider>
        <MastraClientProvider>
          <BrowserRouter>
            <Routes>
              <Route
                element={
                  <Layout>
                    <Outlet />
                  </Layout>
                }
              >
                <Route path="/networks" element={<Networks />} />
                <Route path="/networks/:networkId" element={<Navigate to="/networks/:networkId/chat" />} />
                <Route
                  path="/networks/:networkId"
                  element={
                    <NetworkLayout>
                      <Outlet />
                    </NetworkLayout>
                  }
                >
                  <Route path="chat" element={<Network />} />
                </Route>
              </Route>

              <Route
                element={
                  <Layout>
                    <Outlet />
                  </Layout>
                }
              >
                <Route path="/agents" element={<Agents />} />
                <Route path="/agents/:agentId" element={<Navigate to="/agents/:agentId/chat" />} />
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
                <Route path="/tools/:agentId/:toolId" element={<AgentTool />} />
                <Route path="/tools/all/:toolId" element={<Tool />} />
                <Route path="/mcps" element={<MCPs />} />

                <Route path="/mcps/:serverId" element={<McpServerPage />} />
                <Route path="/mcps/:serverId/tools/:toolId" element={<MCPServerToolExecutor />} />

                <Route path="/workflows" element={<Workflows />} />
                <Route path="/workflows/:workflowId" element={<Navigate to="/workflows/:workflowId/graph" />} />

                <Route path="/workflows/:workflowId" element={<Outlet />}>
                  <Route
                    path="traces"
                    element={
                      <WorkflowLayout>
                        <WorkflowTracesPage />
                      </WorkflowLayout>
                    }
                  />

                  <Route
                    path="/workflows/:workflowId/graph"
                    element={
                      <WorkflowLayout>
                        <WorkflowGraphLayout>
                          <Outlet />
                        </WorkflowGraphLayout>
                      </WorkflowLayout>
                    }
                  >
                    <Route path="/workflows/:workflowId/graph" element={<Workflow />} />
                    <Route path="/workflows/:workflowId/graph/:runId" element={<Workflow />} />
                  </Route>
                </Route>

                <Route
                  path="/workflows/legacy/:workflowId"
                  element={<Navigate to="/workflows/legacy/:workflowId/graph" />}
                />

                <Route
                  path="/workflows/legacy/:workflowId"
                  element={
                    <LegacyWorkflowLayout>
                      <Outlet />
                    </LegacyWorkflowLayout>
                  }
                >
                  <Route path="graph" element={<LegacyWorkflow />} />
                  <Route path="traces" element={<LegacyWorkflowTracesPage />} />
                </Route>
                <Route path="/" element={<Navigate to="/agents" />} />
                <Route path="/runtime-context" element={<RuntimeContext />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </MastraClientProvider>
      </PostHogProvider>
    </QueryClientProvider>
  );
}

export default App;
