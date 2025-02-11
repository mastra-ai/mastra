import { Routes, Route, BrowserRouter, Navigate, Outlet } from 'react-router';

import { Layout } from '@/components/layout';

import Tools from '@/pages/tools';

import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import AgentEvalsPage from './pages/agents/agent/evals';
import AgentTool from './pages/tools/agent-tool';
import Tool from './pages/tools/tool';
import Workflows from './pages/workflows';
import Workflow from './pages/workflows/workflow';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Layout>
              <Outlet />
            </Layout>
          }
        >
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/:agentId" element={<Agent />} />
          <Route path="/agents/:agentId/evals" element={<AgentEvalsPage />} />
          <Route path="/agents/:agentId/:threadId" element={<Agent />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/tools/:agentId/:toolId" element={<AgentTool />} />
          <Route path="/tools/all/:toolId" element={<Tool />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/workflows/:workflowId" element={<Workflow />} />
          <Route path="/" element={<Navigate to="/agents" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
