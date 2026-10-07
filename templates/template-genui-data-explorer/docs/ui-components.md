# Adding UI components

The agent chooses registered components; React renders them. To add a view, declare its supported
data and selection guidance in the catalog, then connect it to a React renderer.

## How selection works

1. The agent calls `analyze` to obtain a verified result and its data shape.
2. It calls `compose` with a component ID, result ID, and display properties.
3. The server checks that the component supports that result. CopilotKit delivers the accepted
   composition to the app, which renders the registered React component.

The shared catalog lives in [`src/components/catalog.ts`](../src/components/catalog.ts). Each entry describes:

| Field            | Purpose                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `id`, `version`  | Identify the renderer and its saved property contract.                                       |
| `description`    | Tell the agent when to choose this component and how to configure it.                        |
| `enabled`        | Include the component in the default agent catalog.                                          |
| `kind`           | Reuse the validation rules for `metric`, `line`, `bar`, `table`, `comparison`, or `heatmap`. |
| `roles`, `units` | Restrict compatible result shapes and measurement units.                                     |
| `actions`        | Declare supported `filter`, `drill`, and `compare` interactions.                             |
| `properties`     | Validate the properties the agent can supply with a Zod schema.                              |
| `defaults`       | Configure the table page size, from 1 to 50 rows.                                            |

## Register a component

For example, add a compact summary for a single metric. Append this entry to `components` in
`src/components/catalog.ts`, using the existing `z` and `componentProperties` imports:

```ts
{
  id: "summary",
  version: "1",
  description:
    "Use for a concise total or rate when the user asks for a summary or KPI. " +
    "Do not use for trends, rankings, or individual records. " +
    "Set options.emphasis to verified for a prominent value or subtle for a quieter display.",
  enabled: true,
  kind: "metric",
  roles: ["scalar"],
  units: ["USD cents", "percent"],
  actions: [],
  properties: componentProperties.extend({
    options: z.strictObject({
      emphasis: z.enum(["verified", "subtle"]),
    }),
  }),
  defaults: { pageSize: 10 },
},
```

Keep display options under `properties.options`. The shared binding accepts strings, numbers,
booleans, and null there. Use the existing `title`, `x`, `y`, `value`, and `scenario` fields where
applicable; titles are plain labels without numbers or dates. Numeric facts come from the result.

The production catalog contains the default views only. Custom components used to verify
extensibility live under `tests/fixtures/` and are registered only by the test application.

## Add the React renderer

In [`src/ui/renderers.tsx`](../src/ui/renderers.tsx), add this function. `RendererProps` and
`formatValue` are already available in that file:

```tsx
function SummaryMetric({ binding, result }: RendererProps) {
  const value = formatValue(result.data.value, result.data.unit);
  return (
    <p className="metric-value">
      {binding.properties.options?.emphasis === "verified" ? <strong>{value}</strong> : value}
    </p>
  );
}
```

The `renderers` array automatically maps standard catalog entries to built-in views. Exclude your
custom ID from that mapping:

```ts
.filter((entry) => entry.id !== "summary")
```

Then append the custom renderer after constructing the array:

```ts
renderers.push({
  declaration: components.find((entry) => entry.id === "summary")!,
  render: SummaryMetric,
});
```

Each component ID should have one renderer registration. Read values from `result.data` and display
choices from `binding.properties`. If you add interactions, declare their supported actions and use
`act` with the action types in [`src/workspace/contracts.ts`](../src/workspace/contracts.ts).
[`DataTable`](../src/ui/data-table.tsx) provides a drill-down example.

## Tell the agent when to use it

The catalog's `description` is passed to the agent automatically by `agentCatalog()` in [`src/analysis/composition.ts`](../src/analysis/composition.ts). Write it as
selection guidance: the user's intent, the required data shape, when another view is better, and
what each option means. `roles` and `units` enforce compatibility; the description guides the choice
among compatible components.

The agent also has general preferences in [`src/mastra/agent.ts`](../src/mastra/agent.ts): line charts
for time series, bars for rankings, heatmaps for matrices, tables for records, and metric cards for
scalars. When a new component should take precedence, update those instructions too. For this example,
add a sentence to the existing composition guidance:

```text
For a scalar result, prefer summary when the user asks for a summary or KPI and summary is in
compatibleComponents. Use options.emphasis=verified unless the user asks for a subtle display.
Otherwise choose another compatible component.
```

A description cannot make incompatible data renderable. Line and bar charts must bind the returned
grouping key to `x` and a compatible numeric column to `y`. Heatmaps bind the returned `axes.x`,
`axes.y`, and `axes.value`. A new visual using an existing kind can reuse these rules; a new kind or
data shape also requires changes to the contracts and composition validation.

## Try the new view

Restart `npm run dev`, open a new chat, and ask “Show a summary of bookings for the last complete
month.” Look for the custom value display. Then ask for monthly bookings and check that the agent
chooses a trend view instead.

If `.env` sets `UI_COMPONENT_IDS`, add `summary` to that comma-separated list or remove the override
to use catalog defaults. An explicit list selects exactly those registered IDs, including entries
whose default `enabled` flag is false.

Increase `version` when changing the saved property contract. Keep extension tests under `tests/`;
cover selection compatibility, invalid options, and rendering against known results.
