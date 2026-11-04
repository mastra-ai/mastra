import type { App } from '@modelcontextprotocol/ext-apps';
import { createContext, useContext } from 'react';

const McpAppContext = createContext<App | null>(null);

export const McpAppProvider = McpAppContext.Provider;

/**
 * The app's connection to its host: send it messages (`sendMessage`), update what the model
 * sees (`updateModelContext`), call the server's tools (`callServerTool`), open links. Check
 * `getHostCapabilities()` first; hosts only handle what they advertise.
 */
export function useMcpApp(): App {
  const app = useContext(McpAppContext);
  if (!app) throw new Error('useMcpApp must be used inside an app defined with defineMcpApp.');
  return app;
}
