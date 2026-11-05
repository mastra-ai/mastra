---
'@mastra/playground-ui': minor
---

Added `StatelessWidget` and `planWidget` so a dashboard widget can be rendered by a host that does its own fetching, such as an MCP App.

**Why:** every built-in widget used to fetch its data and hold its view, sort, and compared column internally, so it only worked inside Studio's React Query and client providers. Widgets now split into a pure plan (which requests to send) and a component that renders the answers it is given. `DashboardRenderer` works as before.

**Rendering a widget from your own data**

```tsx
import {
  BUILT_IN_WIDGET_KINDS,
  StatelessWidget,
  planWidget,
  prepareWidget,
  sendRequest,
} from '@mastra/playground-ui/domains/dashboards';

const registry = new Map(BUILT_IN_WIDGET_KINDS.map(kind => [kind.kind, kind]));
const prepared = prepareWidget(widget, registry, 'project');

// `env` is plain data the host provides: { window, filters, comparisonLabel, gates }.
// Plan once, send `plan.discover`, then plan again with those answers and send `plan.requests`.
const plan = planWidget(prepared, env, state, discovered);
if (plan.status === 'ready') {
  const answers = await Promise.all(plan.requests.map(request => request && sendRequest(client, request)));
}

<StatelessWidget
  prepared={prepared}
  env={env}
  state={state}
  onStateChange={setState}
  discovered={discovered}
  results={results}
  onRetry={retryFailed}
  scope="project"
/>;
```

**Custom widget kinds** can add optional `discover` and `requests` planners and read `gate`, `state`, `onStateChange`, `results`, and `onRetry` from their props. Kinds that keep fetching with hooks inside `component` keep working in `DashboardRenderer`.
