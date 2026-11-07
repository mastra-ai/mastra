# @mastra/mcp-apps-components

## 0.1.0-alpha.1

### Minor Changes

- Added pinning to `observabilityWidgetApp`. When the chat host supports it, the widget shows a pin button, and the host decides what stays pinned. Hosts built on `@mastra/playground-ui` can use `observabilityWidgetPins` from the new `@mastra/mcp-apps-components/host` entry: ([#29557](https://github.com/mastra-ai/mastra/pull/29557))

  ```tsx
  import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
  import { observabilityWidgetPins } from '@mastra/mcp-apps-components/host';

  const host = observabilityWidgetPins({
    resourceUri: 'ui://mastra/observability-widget',
    pinnedIds,
    onPin: ({ widget, datePreset }) => savePin(widget, datePreset),
    onUnpin: widgetId => removePin(widgetId),
  });

  <McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
  ```

- `@mastra/mcp-apps-components` now ships MCP Apps that use only messages from the MCP Apps spec. The first one is `greetingApp`, exported from the package root. To use it, register it as an app resource on an `MCPServer` and write its two tools as regular Mastra tools. The model calls one tool to open the app. The app calls the other, an app-only tool (`visibility: ['app']`), to get its data. ([#29510](https://github.com/mastra-ai/mastra/pull/29510))

  ```ts
  import { createTool } from '@mastra/core/tools';
  import { MCPServer } from '@mastra/mcp';
  import { greetingApp } from '@mastra/mcp-apps-components';
  import { z } from 'zod';

  const uri = 'ui://mastra/greeting';

  new MCPServer({
    id: 'greeting',
    name: 'Greeting',
    version: '1.0.0',
    appResources: { [uri]: greetingApp },
    tools: {
      showGreeting: createTool({
        id: 'showGreeting',
        description: 'Shows a greeting card for someone',
        inputSchema: z.object({ name: z.string() }),
        mcp: { _meta: { ui: { resourceUri: uri } } },
        execute: async ({ name }) => ({ name }),
      }),
      getGreeting: createTool({
        id: 'getGreeting',
        description: 'Returns the greeting for a name',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        mcp: { _meta: { ui: { resourceUri: uri, visibility: ['app'] } } },
        execute: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
      }),
    },
  });
  ```

  **Breaking:** the dashboard app is removed. The `./dashboard-renderer` (`dashboardRendererApp`) and `./observability-tools` (`observabilityAppTools`) entry points no longer exist. The package also has no peer dependencies anymore, so `@mastra/server` is no longer required.

- Added `observabilityWidgetApp`, an MCP App that draws one observability dashboard widget (KPIs, time series, table or scores) with the same components as Studio. The model opens it with a tool whose result is `{ widget, datePreset }`. The app then reads its data through an app-only `queryObservability` tool (`QUERY_OBSERVABILITY_TOOL`) that you write, so you choose which Mastra server it reads from and how it authenticates. ([#29557](https://github.com/mastra-ai/mastra/pull/29557))

  ```ts
  import { MCPServer } from '@mastra/mcp';
  import { QUERY_OBSERVABILITY_TOOL, observabilityWidgetApp } from '@mastra/mcp-apps-components';

  new MCPServer({
    id: 'observability',
    name: 'Observability',
    version: '1.0.0',
    appResources: { 'ui://mastra/observability-widget': observabilityWidgetApp },
    tools: { showObservabilityWidget, [QUERY_OBSERVABILITY_TOOL]: queryObservability },
  });
  ```

  The tool receives `{ action, args }`, where `action` is a `MastraClient` observability method such as `getMetricAggregate`, and returns `{ data }`, that method's result. See the package README for a full example.

### Patch Changes

- `StatelessWidget` now passes the widget definition to `pin.onPin`, the same way `DashboardRenderer` does, so a host can save which chart or widget was pinned or unpinned. ([#29587](https://github.com/mastra-ai/mastra/pull/29587))

  ```tsx
  <StatelessWidget
    prepared={prepared}
    pin={{
      name: 'Agent runs',
      isPinned,
      onPin: (widget, isPinned) => savePin(widget, isPinned),
    }}
    {...props}
  />
  ```

## 0.1.0-alpha.0

### Minor Changes

- Added widget pinning to the dashboard MCP App. Hosts that set `mastra.ai/dashboard-pinned-widgets` in their host context to the ids of their pinned widgets get a pin button on each widget. Clicking it sends a `mastra.ai/dashboard-widget-pin` notification with the widget, the dashboard's scope, the date range and filters the user had on (as dashboard `defaults`), and `isPinned`, so the host can render the widget on its own as the user saw it. Each button follows the ids the host sends back, so the host and the app stay in sync. ([#29443](https://github.com/mastra-ai/mastra/pull/29443))

  `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY`, `DASHBOARD_WIDGET_PIN_NOTIFICATION`, and `dashboardWidgetPinNotificationParamsSchema` are exported from `@mastra/mcp-apps-components/dashboard-renderer`. Parse the params with the schema, since they come from the app's iframe:

  ```typescript
  bridge.fallbackNotificationHandler = async ({ method, params }) => {
    if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
    const parsed = dashboardWidgetPinNotificationParamsSchema.safeParse(params);
    if (!parsed.success) return;
    const { widget, isPinned } = parsed.data;
    const pinned = hostContext[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
    if (isPinned === pinned.includes(widget.id)) return;
    const ids = isPinned ? [...pinned, widget.id] : pinned.filter(id => id !== widget.id);
    hostContext = { ...hostContext, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids };
    bridge.setHostContext(hostContext);
  };
  ```

### Patch Changes

- Added `@mastra/mcp-apps-components`, prebuilt MCP Apps that render Mastra UI inside any MCP App host such as Mastra Studio. The first app, `dashboardRendererApp`, renders a Mastra dashboard definition with live observability data. ([#29321](https://github.com/mastra-ai/mastra/pull/29321))

  Register the app and `observabilityAppTools` on an `MCPServer`, then link a tool to the app's `ui://` URI:

  ```ts
  import { MCPServer } from '@mastra/mcp';
  import { dashboardRendererApp } from '@mastra/mcp-apps-components/dashboard-renderer';
  import { observabilityAppTools } from '@mastra/mcp-apps-components/observability-tools';

  export const dashboardServer = new MCPServer({
    id: 'dashboard-server',
    name: 'Dashboard Server',
    version: '1.0.0',
    appResources: { 'ui://mastra/dashboard': dashboardRendererApp() },
    tools: { showDashboard, ...observabilityAppTools },
  });
  ```

  The app never reaches the network from its iframe. It reads data through the observability tools, which only apps can call and agents don't see. Each tool runs its observability route as the signed-in caller, with the route's own validation and permission checks.

- Updated dependencies [[`1a078af`](https://github.com/mastra-ai/mastra/commit/1a078afbb1cb4ac73eca047e80d366c57e83e5e8), [`a3caf25`](https://github.com/mastra-ai/mastra/commit/a3caf25629671bb76fdfdef77189443b02f550b8), [`49eaabb`](https://github.com/mastra-ai/mastra/commit/49eaabb19b1a28e3614cc79e82a30ab342530f85), [`4afecea`](https://github.com/mastra-ai/mastra/commit/4afeceaf2de5ae85e9c14d25227805ebaf3eaace), [`944d4bc`](https://github.com/mastra-ai/mastra/commit/944d4bcb13c98c326f326b5a9d870b8a613bf4f5), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0893940`](https://github.com/mastra-ai/mastra/commit/0893940ca2f2017ccb59432fdd93f63748561e3b), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f2df1f`](https://github.com/mastra-ai/mastra/commit/0f2df1f3d69c25a5bbb6f1f046df30e5a83b8e2b), [`b5acfcd`](https://github.com/mastra-ai/mastra/commit/b5acfcdff695b5c3f42512e4939b3b0eed71ac44), [`aa67776`](https://github.com/mastra-ai/mastra/commit/aa6777693de4d78758e8c4f57e5592fe10bb0b03), [`f611832`](https://github.com/mastra-ai/mastra/commit/f611832d661439f6b2aada795dcc16efdc2b12c3), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`0f8a26f`](https://github.com/mastra-ai/mastra/commit/0f8a26f9112f5946b3c5a3152e79003daaa4cdde), [`b4fdcf5`](https://github.com/mastra-ai/mastra/commit/b4fdcf59a5df1baeb0c4683bb1e6e0175a37df6d), [`944d4bc`](https://github.com/mastra-ai/mastra/commit/944d4bcb13c98c326f326b5a9d870b8a613bf4f5), [`944d4bc`](https://github.com/mastra-ai/mastra/commit/944d4bcb13c98c326f326b5a9d870b8a613bf4f5), [`a5d56cd`](https://github.com/mastra-ai/mastra/commit/a5d56cd4aaec46f84a1217ab2dd62375b6b5e354), [`c351978`](https://github.com/mastra-ai/mastra/commit/c3519781275689a562e9347121b6316c909c5cdb), [`f9feb98`](https://github.com/mastra-ai/mastra/commit/f9feb98ba33a362ace4db6ad8ec6ac01ca933ca5), [`33d1dc2`](https://github.com/mastra-ai/mastra/commit/33d1dc21107c402d244b3ac372d309e0d8e73199), [`8ad7773`](https://github.com/mastra-ai/mastra/commit/8ad7773cd4f50dd344f047547074607f5bb81ff6), [`a7c4069`](https://github.com/mastra-ai/mastra/commit/a7c4069df2d7207a74916e2ced5cc35dc42bf3b6), [`8ad7773`](https://github.com/mastra-ai/mastra/commit/8ad7773cd4f50dd344f047547074607f5bb81ff6), [`a7c4069`](https://github.com/mastra-ai/mastra/commit/a7c4069df2d7207a74916e2ced5cc35dc42bf3b6), [`2ab2b9b`](https://github.com/mastra-ai/mastra/commit/2ab2b9b494e1033b1415e880cad5f28bf65d32d8)]:
  - @mastra/core@1.83.0-alpha.0
  - @mastra/server@1.83.0-alpha.0
  - @mastra/mcp@2.9.0-alpha.0
