import { App } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './app';
import './style.css';

const configuration: unknown = JSON.parse(document.getElementById('mastra-studio-configuration')?.textContent ?? '{}');
const root = document.getElementById('root');
if (
  !root ||
  !configuration ||
  typeof configuration !== 'object' ||
  !('baseUrl' in configuration) ||
  typeof configuration.baseUrl !== 'string' ||
  !('apiPrefix' in configuration) ||
  typeof configuration.apiPrefix !== 'string'
) {
  throw new Error('Missing Mastra Studio MCP App configuration');
}

const reactRoot = createRoot(root);
reactRoot.render(
  <StudioApp
    configuration={{
      baseUrl: configuration.baseUrl,
      apiPrefix: configuration.apiPrefix,
      localPreview: 'localPreview' in configuration && configuration.localPreview === true,
    }}
  />,
);

// The standalone preview also works without an MCP host. Embedded apps perform
// the standard MCP Apps handshake and follow the host's light/dark theme.
if (window.parent !== window) {
  const app = new App({ name: 'Mastra Studio', version: '0.1.0' });
  const applyTheme = (theme: string | undefined) =>
    document.documentElement.classList.toggle('light', theme === 'light');
  app.onhostcontextchanged = context => applyTheme(context.theme);
  app.onteardown = async () => {
    reactRoot.unmount();
    return {};
  };
  void app
    .connect()
    .then(() => applyTheme(app.getHostContext()?.theme))
    .catch(error => console.error('MCP App connection failed', error));
}
