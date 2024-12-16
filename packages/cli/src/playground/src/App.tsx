import { Layout } from '@shared/components/layout';
import { Routes, Route, BrowserRouter } from 'react-router';

import Home from '@/pages/home';

function App() {
  return (
    <Layout>
      <BrowserRouter basename="/playground">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </Layout>
  );
}

export default App;
