# @mastra/mcp-apps-components

## 0.1.0-alpha.6

### Minor Changes

- Added an optional `onConfigure` callback to `observabilityWidgetHost`. When a host passes it, each widget in the observability widget app shows a settings button. Clicking it hands the host the widget along with the date preset, custom range and filters it is drawn with, so the host can open its own settings dialog for that widget. ([#30043](https://github.com/mastra-ai/mastra/pull/30043))

  ```tsx
  import { observabilityWidgetHost } from '@mastra/mcp-apps-components/host';

  const host = observabilityWidgetHost({
    resourceUri: 'ui://mastra/observability-widget',
    onConfigure: ({ widget, datePreset, filters }) => openWidgetSettings(widget, datePreset, filters),
  });
  ```

### Patch Changes

- Replaced the `onPin` and `isPinned` props on `DashboardRenderer`, and the `pin` prop on `StatelessWidget`, with a host `actions` slot. `DashboardRenderer` takes a `widgetActions` callback that returns each widget's buttons, and `StatelessWidget` takes them as `actions`. This lets a host add any buttons to widget cards, not just a pin button, without changing the renderer. Host buttons sit after the card's own drilldown and alert buttons. ([#30043](https://github.com/mastra-ai/mastra/pull/30043))

  Compose the buttons with the new `MetricsCard.Action`. The card is a `group/metrics-card`, so each button sets its own visibility with classes. The exported `onCardHover` class makes a button wait for the card's hover, keyboard focus or open menu: until then it takes no room but stays in the tab order, so keyboard users can still reach it. Touch screens can't hover, so there it always shows. Without it, the button stays in view, e.g. for a pinned card's unpin. `PinAction` and the `WidgetPin` type are removed: a pin button is a `MetricsCard.Action` like any other.

  `ChartCard` now has a single `actions` slot: `persistentActions` is removed, and `MetricsCard.Actions` no longer takes `reveal`. Set `className={onCardHover}` on each `MetricsCard.Action` that should wait for hover instead.

  **Before**

  ```tsx
  <DashboardRenderer
    definition={definition}
    scope="project"
    isPinned={id => pinnedIds.includes(id)}
    onPin={(widget, isPinned) => savePin(widget, isPinned)}
  />
  ```

  **After**

  ```tsx
  import { MetricsCard, onCardHover } from '@mastra/playground-ui/components/MetricsCard';
  import { DashboardRenderer } from '@mastra/playground-ui/domains/dashboards';
  import { PinIcon, PinOffIcon } from 'lucide-react';

  <DashboardRenderer
    definition={definition}
    scope="project"
    widgetActions={widget => {
      const isPinned = pinnedIds.includes(widget.id);
      return (
        <MetricsCard.Action
          label={`${isPinned ? 'Unpin' : 'Pin'} ${widget.title ?? 'widget'}`}
          onClick={() => savePin(widget, !isPinned)}
          className={isPinned ? undefined : onCardHover}
        >
          {isPinned ? <PinOffIcon /> : <PinIcon />}
        </MetricsCard.Action>
      );
    }}
  />;
  ```

- Updated dependencies [[`c860b9b`](https://github.com/mastra-ai/mastra/commit/c860b9bb438d16fc8dcd81dbfabf1e481725cb6f), [`d0cc2fd`](https://github.com/mastra-ai/mastra/commit/d0cc2fdc13d09179e9747d8067e8e23ed1c5a2a2), [`b621401`](https://github.com/mastra-ai/mastra/commit/b62140115989dc564709a5f94c41357eb26bc778), [`59a60e4`](https://github.com/mastra-ai/mastra/commit/59a60e42d5985980d1a36cf0bcddeead09283703), [`9751742`](https://github.com/mastra-ai/mastra/commit/9751742c445864f42c400d235310bfc160342e44), [`7082623`](https://github.com/mastra-ai/mastra/commit/708262393a15c45a03bf2f58ea8c14b42aa1a2a4), [`166ad37`](https://github.com/mastra-ai/mastra/commit/166ad37debf0266fad6121c2f939f8575aba1512), [`afa19de`](https://github.com/mastra-ai/mastra/commit/afa19de57d0c578cb01ddc648baacddb6a5a87ae)]:
  - @mastra/core@1.83.0-alpha.8

## 0.1.0-alpha.5

### Minor Changes

- Added `createObservabilityDraftSchemas`, so tools that save dashboards can build the widget and dashboard schemas from one catalog, and offer a model only the choices they accept. ([#29832](https://github.com/mastra-ai/mastra/pull/29832))

  `createObservabilityDraftSchemas(catalog, options)` returns a `widget` and a `dashboard` schema. Pass `kinds` to offer only some widget kinds, and `dashboardFilters: false` to leave `defaults.filters` out. What you leave out is missing from the JSON schema the model sees, and rejected if the model writes it anyway. The draft schemas and converters are also exported from `@mastra/mcp-apps-components/dashboards`, which doesn't load the bundled apps.

  ```ts
  import { createObservabilityDraftSchemas, toObservabilityWidget } from '@mastra/mcp-apps-components/dashboards';

  const schemas = createObservabilityDraftSchemas({ metricNames }, { kinds: ['kpis', 'timeseries', 'table'] });

  const addWidget = createTool({
    id: 'addWidget',
    inputSchema: schemas.widget,
    // Keeps the widget's id when the model gives one
    execute: async widget => saveWidget(toObservabilityWidget(widget)),
  });
  ```

  Invalid widgets are rejected with paths into what the model wrote, such as `timeseries.series.1.value`. When `toObservabilityWidget` throws, the error's `cause` is the `ZodError` with those paths. Converted widgets pass `strictDashboardWidgetSchema`.

  The widget and dashboard input schemas are about 28% smaller, because metric and score filters are written out once instead of at every read. They also now reject a widget whose tabs share a label, which used to open as an error card.

- Added `createObservabilityWidgetInputSchema`, `observabilityWidgetInputSchema` and `toObservabilityWidget`, so a tool that adds one widget to a saved dashboard accepts the same widget a model writes for `showObservabilityDashboard`, checked and converted the same way. ([#29913](https://github.com/mastra-ai/mastra/pull/29913))

  ```ts
  import { createObservabilityWidgetInputSchema, toObservabilityWidget } from '@mastra/mcp-apps-components';

  const widgetSchema = createObservabilityWidgetInputSchema({ metricNames });
  const widget = toObservabilityWidget({
    title: 'Model spend',
    table: { groupBy: ['model'], columns: [/* ... */] },
  });
  ```

- Added `@mastra/mcp-apps-components/dashboards`, a strict schema for storing dashboard definitions. Unlike core's `dashboardDefinitionSchema`, it only accepts definitions the dashboard renderer can draw: built-in widget kinds only, each view's options checked against its kind, `columns` only on table views, and each kind's own checks run at both org and project scope. Every problem is a zod issue with a path. Problems in a view's options point into them, such as `rows.0.widgets.1.views.0.options.series.0.value`. Problems a kind finds, such as a KPI reading a query its view doesn't have, point at the view, such as `rows.0.widgets.1.views.0`, and their message says what's wrong. ([#29802](https://github.com/mastra-ai/mastra/pull/29802))

  **Before**

  ```ts
  import { dashboardDefinitionEnvelopeSchema } from '@mastra/core/storage/dashboards';

  dashboardDefinitionEnvelopeSchema.parse(body.definition);
  const definition = body.definition as Record<string, unknown>;
  ```

  **After**

  ```ts
  import { strictDashboardDefinitionSchema } from '@mastra/mcp-apps-components/dashboards';
  import type { StrictDashboardDefinition } from '@mastra/mcp-apps-components/dashboards';

  // In the service that stores dashboards, on every write
  const definition: StrictDashboardDefinition = strictDashboardDefinitionSchema.parse(body.definition);
  ```

  Use `strictDashboardWidgetSchema` to check a single widget. Call both in the code that stores dashboards, not in a request-body schema: their input type is `unknown` and their JSON schema is empty, so keep core's schema there for request types and API docs. The subpath doesn't load the package's bundled apps.

### Patch Changes

- Updated dependencies [[`ce86e53`](https://github.com/mastra-ai/mastra/commit/ce86e5327a0e835e26792e238dacc2c15a777bbf), [`bfda77d`](https://github.com/mastra-ai/mastra/commit/bfda77de9773c383f23101cde8f4ee12af8bff19), [`66c620c`](https://github.com/mastra-ai/mastra/commit/66c620c086cd4a5d12347a832057290a19cb9db2), [`964e1ba`](https://github.com/mastra-ai/mastra/commit/964e1baa24a5a383c86b9f3aa639d488e8742b13), [`311d434`](https://github.com/mastra-ai/mastra/commit/311d4342cc61e9f5a621625e28e483a892fda6bc), [`9730315`](https://github.com/mastra-ai/mastra/commit/9730315a2fddf51580599030916d43b17e1ca553), [`bf9212b`](https://github.com/mastra-ai/mastra/commit/bf9212b308c1d418cac64d54aa380dac324db1bd)]:
  - @mastra/core@1.83.0-alpha.5

## 0.1.0-alpha.4

### Patch Changes

- Fixed menus in observability widgets showing with a transparent background. Dropdowns such as the chart's view picker now draw their own surface, so the chart behind them no longer shows through. ([#29906](https://github.com/mastra-ai/mastra/pull/29906))

- Updated dependencies [[`3655736`](https://github.com/mastra-ai/mastra/commit/3655736ec9dc2e1d03d0af3c6be812ccddfc8223), [`2cfa924`](https://github.com/mastra-ai/mastra/commit/2cfa92405b0e0f8b644dd47c4f55abb4dce573c9), [`c0bad48`](https://github.com/mastra-ai/mastra/commit/c0bad48e3a7abef3d8f14fa2c194e09e0f431bba), [`69f481c`](https://github.com/mastra-ai/mastra/commit/69f481cb1e83f67d50cf83dd0baa6c9333609d48), [`832fb19`](https://github.com/mastra-ai/mastra/commit/832fb190f72fe8e0fc82e48ade5aaacdd4dbb2f7)]:
  - @mastra/core@1.83.0-alpha.4

## 0.1.0-alpha.3

### Minor Changes

- Added `observabilityWidgetHost` to `@mastra/mcp-apps-components/host`, so a host page such as Studio's Metrics page can pass its project, date range and filters down to observability widgets. The widgets read over the host's selection instead of the dashboard's defaults, read again when it changes, and send `projectId` with every `queryObservability` call so your server can scope reads to that project. With a `projectId`, the widgets show at project scope; without one, at org scope. A custom range reads over the same window as the Metrics page, and a pinned widget keeps it. Pinning is optional. ([#29736](https://github.com/mastra-ai/mastra/pull/29736))

  ```tsx
  import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
  import { observabilityWidgetHost } from '@mastra/mcp-apps-components/host';

  const host = observabilityWidgetHost({
    resourceUri: 'ui://mastra/observability-widget',
    projectId,
    datePreset: 'custom', // or '24h' | '3d' | '7d' | '14d' | '30d'
    customRange: { from: new Date('2026-10-01'), to: new Date('2026-10-04') },
    filters: [{ fieldId: 'environment', value: 'production' }],
    // pins: { pinnedIds, onPin, onUnpin },
  });

  <McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
  ```

  Accept `projectId` in your `queryObservability` tool's input schema and scope the reads with it. It comes from the app's iframe, so check that the caller can access that project before reading.

### Patch Changes

- Fixed missing TypeScript types for `@mastra/mcp-apps-components/host`. Importing `observabilityWidgetHost` from it no longer fails with "Could not find a declaration file". ([#29742](https://github.com/mastra-ai/mastra/pull/29742))

- Updated dependencies [[`58a66b0`](https://github.com/mastra-ai/mastra/commit/58a66b01d9b08e7b59c27fc3ab68eb90be13c0ed), [`ac2a640`](https://github.com/mastra-ai/mastra/commit/ac2a6401a09e2177555369cff2f7ad15f2cc7286), [`94b1641`](https://github.com/mastra-ai/mastra/commit/94b1641919dd90455131b16cd0572ce28008781b), [`8279c30`](https://github.com/mastra-ai/mastra/commit/8279c3073737dd1c228b5df15416ca4ce7e0c00c), [`bc9d8d4`](https://github.com/mastra-ai/mastra/commit/bc9d8d482cec626ef2107f1cbd5a05febceaa491), [`8a10dfe`](https://github.com/mastra-ai/mastra/commit/8a10dfe648610a6687d1e4ecc10a0a81e3d80c4c), [`d77893a`](https://github.com/mastra-ai/mastra/commit/d77893aed38eefe2dbac21e9fffd872137ee6b92), [`791cf60`](https://github.com/mastra-ai/mastra/commit/791cf606e91badea097b883949dc717689caa49d), [`b31cbe2`](https://github.com/mastra-ai/mastra/commit/b31cbe2888f890383629d20c853e21f870dee5a6), [`bfedbfe`](https://github.com/mastra-ai/mastra/commit/bfedbfe5a8e5721cba782efb4652be84e9fecc04), [`c9140d2`](https://github.com/mastra-ai/mastra/commit/c9140d2d4d16dfd674f163cd0a83e28593969c04), [`a836d09`](https://github.com/mastra-ai/mastra/commit/a836d09a43c3c471b5bfced711731355bf26db26), [`4854e36`](https://github.com/mastra-ai/mastra/commit/4854e3641931c984a5b3941371a4f0fa58eafd0e), [`7358ad7`](https://github.com/mastra-ai/mastra/commit/7358ad73a381765572858d520f8170ab59e88514), [`b93d804`](https://github.com/mastra-ai/mastra/commit/b93d804a7a406d834389e686687b06d22ea2e4f1), [`ed1cecb`](https://github.com/mastra-ai/mastra/commit/ed1cecba5c26a73600640f74e9a1c9d322271b23), [`4cd4c46`](https://github.com/mastra-ai/mastra/commit/4cd4c46e546d44c556fce4d731cac03cad4f88c4), [`9e5b108`](https://github.com/mastra-ai/mastra/commit/9e5b1082cbe2454c377b3328cd8a0085e7452d1a), [`b31cbe2`](https://github.com/mastra-ai/mastra/commit/b31cbe2888f890383629d20c853e21f870dee5a6), [`28ddc16`](https://github.com/mastra-ai/mastra/commit/28ddc161a441fdc3ecbdcc1168dee773f1f25243), [`0f496bd`](https://github.com/mastra-ai/mastra/commit/0f496bd3c1cc7f07d2e4ecb3005d480406b3d342), [`de005a4`](https://github.com/mastra-ai/mastra/commit/de005a43d8703d36c5dd25d7ddd1f618ea98bf55)]:
  - @mastra/core@1.83.0-alpha.3

## 0.1.0-alpha.2

### Minor Changes

- The observability app now draws a whole dashboard instead of a single widget, with rows of KPIs, time series, tables and scores. The app applies the dashboard's default date range and filters. ([#29645](https://github.com/mastra-ai/mastra/pull/29645))

  The model writes each widget, read and column under a key that names it, and each number holds the read it comes from, such as `{ timeseries: { series: [{ value: { metricTimeSeries: { … } } }] } }`. Nothing points at a query, series or column by id, so a dashboard can't reference something it lacks. A widget with a single view puts it directly on the widget; tabs go in `tabs`. `toObservabilityDashboard` turns this into a regular `dashboardDefinitionSchema` definition, gathering the reads into queries.

  **Why:** with a single fixed widget, the model could only show a handful of hard-coded charts. Now it can write its own dashboard against real data, checked against each widget kind's options.

  **New helpers**

  - `observabilityDashboardInputSchema` lists every widget kind's options, so the model gets clear errors when a widget is wrong. It also names the metrics Mastra records, such as `mastra_agent_duration_ms` and `mastra_model_total_input_tokens`, so the model doesn't guess names that read as zero.
  - `createObservabilityDashboardInputSchema({ metricNames })` builds the same schema with the project's metric names as the only allowed values, so a dashboard can't name a metric without data. Rebuild the tool when the names change.
  - `toObservabilityDashboard(input)` gives each widget without an id a fresh UUID, makes a widget without a `span` full width, and checks the result.
  - `OBSERVABILITY_READ_ACTIONS` lists every `MastraClient` read the app sends to `queryObservability`, from `aggregateTraces` to `listScores`. Allow exactly these with `z.enum(OBSERVABILITY_READ_ACTIONS)`, so no widget fails for a missing action.

  **Renamed:** `observabilityWidgetApp` is now `observabilityDashboardApp`, named `Observability dashboard`.

  **Before**

  ```ts
  outputSchema: z.object({ widget: z.unknown(), datePreset: z.string().optional() }),
  execute: async ({ widget, datePreset }) => ({ widget: WIDGETS[widget], datePreset }),
  ```

  **After**

  ```ts
  import {
    observabilityDashboardInputSchema,
    observabilityDashboardOutputSchema,
    toObservabilityDashboard,
  } from '@mastra/mcp-apps-components';

  createTool({
    id: 'showObservabilityDashboard',
    inputSchema: observabilityDashboardInputSchema,
    outputSchema: observabilityDashboardOutputSchema,
    execute: async input => toObservabilityDashboard(input),
  });
  ```

  Pins now also carry the dashboard's default filters as `filters`. `@mastra/core` and `zod` are now peer dependencies.

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
