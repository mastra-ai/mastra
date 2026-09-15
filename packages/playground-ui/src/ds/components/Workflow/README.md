# Workflow UI

Import workflow presentation from `@mastra/playground-ui/components/Workflow`.
Studio uses these same components for its workflow graph. They do not fetch
workflows, subscribe to streams, or start, resume, or cancel runs.

## Cards and controls

`WorkflowStepCardView` renders the step label, indicators, execution status,
timing, foreach progress, selection, and hover state. Use its `actionBar` slot
for application actions.

`WorkflowConditionCard` owns expansion and the condition-code dialog.
`WorkflowConditionCardView` exposes those controls for callers that need to own
that state. Conditions include code predicates and reference/query conditions.

`WorkflowDebugControls` receives `canRunNextStep`, `isStreaming`,
`onRunNextStep`, and `onContinueRun`. The application decides when a paused
run should show it and implements the actions.

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

The canvas owns the background, zoom controls, and viewport focus. Pass the
React Flow node ID as `focusNodeId` to center that node after layout. The
optional `onNodeClick` callback lets the caller own selection. `variant="nested"`
uses the nested graph's background.

Use `WorkflowNodeFrame` around step and condition cards to provide graph
handles, `WorkflowBoundaryNode` for start/end nodes, and `WorkflowDataEdgeView`
for the edge path and data inspector. Supply the edge's resolved `output` and
optional `label`; `undefined` hides the inspector while `null`, `false`, `0`,
and empty strings remain inspectable.

Studio retains serialized-workflow parsing, automatic graph layout, execution
state, payload resolution, and run mutations. The shared package accepts their
presentation results through props and callbacks.

## Storybook

The `Workflows` group contains step types, execution and interaction states,
conditions, debug controls, edge payloads, and complete graph compositions.
Graph fixtures contain positioned nodes, so they demonstrate the real
renderers and viewport independently of Studio's parser and live execution.
Use the existing Studio tests for those integrations.
