import { Layout } from '@shared/components/layout';
import { Routes, Route, BrowserRouter } from 'react-router';

import Home from '@/pages/home';

import Tool from './pages/tool';

function App() {
  return (
    <Layout>
      <BrowserRouter basename="/playground">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tools/:toolId" element={<Tool />} />
        </Routes>
      </BrowserRouter>
    </Layout>
  );
}

export default App;
