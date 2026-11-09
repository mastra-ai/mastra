import { App } from '@modelcontextprotocol/ext-apps';
import { waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';

type AppTransport = Parameters<App['connect']>[0];

const apps = new Set<App>();

afterEach(async () => {
  await Promise.all([...apps].map(app => app.close()));
  apps.clear();
});

/** The sandbox iframe the viewer rendered into `container`, once mounted. */
export function sandboxFrame(container: HTMLElement) {
  return waitFor(() => {
    const frame = container.querySelector('iframe');
    const contentWindow = frame?.contentWindow;
    if (!frame || !contentWindow) throw new Error('sandbox iframe not mounted yet');
    return { frame, contentWindow };
  });
}

/**
 * Connects a real MCP App to the viewer rendered in `container`, standing in for the sandbox proxy
 * page it loads: the proxy announces itself, then relays JSON-RPC between the viewer and the app.
 */
export async function connectApp(container: HTMLElement, setup?: (app: App) => void) {
  const { contentWindow: frame } = await sandboxFrame(container);

  // The viewer only accepts messages coming from its sandbox iframe.
  const fromSandbox = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, source: frame }));
  const onHostMessage = (event: MessageEvent) => transport.onmessage?.(event.data);
  const transport: AppTransport = {
    async start() {
      frame.addEventListener('message', onHostMessage);
    },
    async send(message) {
      // Like a real postMessage, deliver on a later task, once the viewer is listening.
      setTimeout(() => fromSandbox(message));
    },
    async close() {
      frame.removeEventListener('message', onHostMessage);
      transport.onclose?.();
    },
  };

  fromSandbox({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} });
  const app = new App({ name: 'test-app', version: '1.0.0' }, {}, { autoResize: false });
  apps.add(app);
  setup?.(app);
  await app.connect(transport);
  return app;
}
