import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { McpAppDefinition } from './define-mcp-app';
import './base.css';

/** The entry point of an app's iframe: renders it into `#root` and connects to the host page. */
export function mountMcpApp<Input>({ createSession, View }: McpAppDefinition<Input>) {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');

  const session = createSession();
  createRoot(root).render(
    <StrictMode>
      <View session={session} />
    </StrictMode>,
  );
  void session.connect();
}
