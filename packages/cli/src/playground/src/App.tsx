import { Routes, Route, BrowserRouter, Navigate, Outlet } from 'react-router';

import { Layout } from '@/components/layout';

import { AgentLayout } from '@/domains/agents/agent-layout';
import { WorkflowLayout } from '@/domains/workflows/workflow-layout';
import Tools from '@/pages/tools';

import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import AgentEvalsPage from './pages/agents/agent/evals';
import AgentTracesPage from './pages/agents/agent/traces';
import AgentTool from './pages/tools/agent-tool';
import Tool from './pages/tools/tool';
import Workflows from './pages/workflows';
import Workflow from './pages/workflows/workflow';
import WorkflowTracesPage from './pages/workflows/workflow/traces';
import Networks from './pages/networks';
import { NetworkLayout } from './domains/networks/network-layout';
import Network from './pages/networks/network';
import { PostHogProvider } from './lib/analytics';

function App() {
  return (
    <PostHogProvider>
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
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/:workflowId" element={<Navigate to="/workflows/:workflowId/graph" />} />
            <Route
              path="/workflows/:workflowId"
              element={
                <WorkflowLayout>
                  <Outlet />
                </WorkflowLayout>
              }
            >
              <Route path="graph" element={<Workflow />} />
              <Route path="traces" element={<WorkflowTracesPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/agents" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PostHogProvider>
  );
}

export default App;
