# Workflow UI

Import workflow presentation from `@mastra/playground-ui/components/Workflow`.
Studio uses these same components for its workflow graph. They do not fetch
workflows, subscribe to streams, or start, resume, or cancel runs.

## Cards and controls

`WorkflowStepCardView` renders the step label, indicators, execution status,
timing, foreach progress, selection, and hover state. Use its `actionBar` slot
for application actions.

Cards combine a running title shimmer with the shared `ActivityWick` animated edge.
Use `nodeKind` to identify agent, tool, map, delay, or scheduled-wait entries.
Pass `onSelect` for card selection, `body` for a collapsible structure summary,
and `onOpenBody` to open the application's full nested graph. These callbacks
do not execute workflow steps. Foreach progress and all execution states come
from the caller's run data.

`WorkflowConditionCard` derives its badge from the first supplied condition and
shows expressions inline. `WorkflowConditionCardView` accepts an explicit type
for callers that group conditions themselves. Both accept code predicates and
reference/query conditions, without maintaining disclosure or dialog state.

`WorkflowDebugControls` shows `nextStepLabel` above the primary step action.
Supply `canRunNextStep`, `isStreaming`, `onRunNextStep`, and `onContinueRun`;
use `disabled` while another run action is pending. Both execution controls
are disabled when the next step cannot be resolved. Optional `children`
place application actions, such as cancellation, alongside the controls.
The application decides when a paused run should show it and owns execution.

```tsx
import { WorkflowStepCardView } from '@mastra/playground-ui/components/Workflow';

<WorkflowStepCardView
  label="Enrich customers"
  displayStatus="running"
  isForEach
  foreachProgress={{ completedCount: 2, totalCount: 5, iterationStatus: 'success' }}
/>;
```

## Graph composition

Mount `WorkflowGraphCanvas` inside a `ReactFlowProvider`. Supply positioned
`nodes`, `edges`, `nodeTypes`, `edgeTypes`, and `onNodesChange`. Keep node state
with React Flow's `useNodesState`. Use a new React key when switching to a
different graph; changes to the current graph are controlled through its nodes
and edges.

The canvas owns the background, zoom controls, and viewport focus.
`WorkflowCanvasInsetContext` supplies the width covered by a floating left panel;
the canvas stays underneath it while fitting nodes and placing controls in the visible area. Pass the
React Flow node ID as `focusNodeId` to center that node after layout. The
optional `onNodeClick` callback lets the caller own selection. `variant="nested"`
uses the nested graph's background.

Drag empty canvas space to pan. Nodes remain fixed in the automatic layout;
card buttons, disclosures, and edge data controls accept pointer interaction.
Studio recalculates layout when a node's measured size changes, keeping
successors clear of expanded bodies. The nested view offers an item selector
when a run contains per-item foreach results.

Use `WorkflowNodeFrame` around step and condition cards to provide graph
handles, `WorkflowBoundaryNode` for start/end nodes, and `WorkflowDataEdgeView`
for the edge path and data inspector. Supply the edge's resolved `output` and
optional `label`; `undefined` hides the inspector while `null`, `false`, `0`,
and empty strings remain inspectable.

Pass `dataControl` to supply an application-owned edge control. `WorkflowEdgeDataButton`
accepts `onInspect` and `selected` for a shared inspector; without `onInspect`,
it opens its standalone dialog. Studio resolves selected data from the current run
and displays it in a floating panel alongside the canvas.

`dataLabelPlacement: 'source'` positions shared data
at a fork's source; `'hidden'` suppresses duplicate labels on its sibling edges.
Each branch keeps its own connection and execution state.

Workflow edges connect the bottom center of their source to the top center of
their target using measured node bounds in graph coordinates. This keeps arrows
and data inspectors aligned when inline graphs inherit an outer canvas zoom.

Studio retains serialized-workflow parsing, automatic graph layout, execution
state, payload resolution, and run mutations. The shared package accepts their
presentation results through props and callbacks.

## Storybook

The `Workflows` group contains step types, execution and interaction states,
conditions, debug controls, edge payloads, and complete graph compositions.
Graph fixtures contain positioned nodes, so they demonstrate the real
renderers and viewport independently of Studio's parser and live execution.
Use the existing Studio tests for those integrations.

Step cards use a tinted outer shell and a two-pixel inset surface for the
description, execution time, status, and controls. Set `bodyLayout="graph"`
when supplying a connected graph: the body expands inside a dashed group.
Use `initiallyOpen` for the first level; leave deeper workflows collapsed to
limit the initial amount of detail. Graph disclosures do not select the parent.

Condition cards show the supplied expression with syntax highlighting and
formatting. Unparsable source remains unchanged, and Copy expression copies the
original text. Structured queries retain their reference and operator data.
The UI never evaluates functions or infers a rule from their source. Long
expressions scroll within the card.

`variant="inline"` fits the body within its group and omits a second grid and
zoom toolbar. Its empty space passes pan and zoom gestures to the outer canvas;
individual controls retain `nopan` and scrollable code retains `nowheel`.
The main canvas fits on initial layout. Run updates and node expansion preserve
the camera. Explicit Fit and selected-step focus still work. Studio retains the
canvas across run selection when the workflow definition is unchanged; loading
a saved run only changes its execution panel, not the canvas.

Supply `groups` with node IDs, a label, and a description to mark related paths
with a dashed boundary. Studio derives parallel membership from serialized
parallel entries. Map nodes transform results; they do not create those paths.

Canvas zoom ranges from 10% to 400%; the percentage button restores actual
size (100%), while Fit view frames the graph at up to 100%.

Studio uses a container query to dock the input and recent-run panels below
the canvas below 900px of available width. In the floating layout only the
visible panels and resize handles intercept pointer input. Canvas fitting
measures the actual panel overlap, including after container resizing.

## Condition and timing fallbacks

Condition cards display the supplied expression without evaluating it. If syntax formatting fails, the original source remains visible and copyable. Expressions longer than 10,000 characters use plain source to avoid expensive formatting and highlighting. Structured query values retain their keys; non-JSON values use the shared safe serializer.

Step cards label every current core step status, including `paused`. Unknown display statuses use an unavailable label. Execution clocks advance only when `isRunning` is true; missing, invalid, or reversed timing displays an unavailable value. Delay dials describe configured delays, not live execution progress.
