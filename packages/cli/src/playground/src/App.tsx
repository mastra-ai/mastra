import { Routes, Route, BrowserRouter, Navigate, Outlet } from 'react-router';

import { Layout } from '@/components/layout';

import Tools from '@/pages/tools';

import Agents from './pages/agents';
import Agent from './pages/agents/agent';
import Tool from './pages/tools/tool';

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
          <Route path="/" element={<Navigate to="/agents" />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/:agentId" element={<Agent />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/tools/:agentId/:toolId" element={<Tool />} />
          {/* <Route path="/tools/dev-tools/:toolId" element={<>Dev Tools</>} />
          <Route path="/workflows" element={<>Workflows</>} />
          <Route path="/workflows/:workflowId" element={<>Workflow</>} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
