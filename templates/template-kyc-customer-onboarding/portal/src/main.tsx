import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/base.css';

const root = document.querySelector<HTMLDivElement>('#root');

if (root === null) {
  throw new Error('Portal root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
