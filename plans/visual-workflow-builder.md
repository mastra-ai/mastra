# Visual Workflow Builder - Beating n8n with AI-Native UX

This document outlines the plan to build the **best AI workflow builder in the market** - not just matching n8n, but surpassing it by leveraging Mastra's AI-native architecture.

---

## Strategic Vision: Why Mastra Can Beat n8n

### n8n's Position

- **General-purpose** workflow automation with AI as an add-on
- 500+ integrations, huge community (168k GitHub stars)
- Visual-first with code escape hatches
- Basic AI nodes (LLM calls, simple agents)

### Mastra's Unfair Advantages

| Mastra Has                  | n8n Doesn't Have                |
| --------------------------- | ------------------------------- |
| **Multi-Agent Networks**    | Only single agent nodes         |
| **Semantic Memory**         | No memory system                |
| **LLM Evals (10+ scorers)** | No quality evaluation           |
| **Tool Suspension**         | No typed human-in-the-loop      |
| **Working Memory**          | Context must be manually passed |
| **MCP Server + Client**     | No MCP support                  |
| **Voice Integration**       | No TTS/STT                      |
| **Model Fallbacks**         | Manual retry only               |
| **TripWire System**         | No quality gates                |

### The Winning Strategy

**Be "Temporal + n8n for AI"** - Durable execution designed specifically for LLM workloads, with the visual UX of n8n but **AI-native observability**.

---

## Competitive Analysis: What to Steal from Each

### From n8n (Table Stakes)

- [x] Visual drag-and-drop canvas (Done)
- [ ] Quick-add "+" button on nodes
- [ ] Data pinning for test consistency
- [ ] Visual data mapping (drag from output to input)
- [ ] Keyboard shortcuts for power users
- [ ] Historical execution replay/debug
- [ ] Sticky notes for documentation

### From Retool Workflows (AI-Specific)

- [ ] Zero-config LLM integrations
- [ ] AI Copilot for workflow generation
- [ ] Block-level debugging with historical replay
- [ ] Human approval gates with "intelligent waiting"

### From Temporal (Durability)

- [ ] Event history timeline
- [ ] Checkpoint at every LLM call
- [ ] Recovery/replay from any point
- [ ] Heartbeat for long-running inference

### From Inngest (AI Observability)

- [ ] AI-specific traces (tokens, costs, prompts)
- [ ] Step-level retry policies
- [ ] Agent network orchestration
- [ ] Prompt playground for testing

---

## Implementation Phases

### Phase 0: AI-Native Differentiators (NEW)

**Priority**: Strategic Differentiator
**Effort**: 5-7 days
**Goal**: Add features n8n can never match due to architecture.

#### Task 0.1: Agent Network Node

**Description**: Visualize and configure multi-agent collaboration.

**What to do**:

1. Create `AgentNetworkNode` that represents an agent network
2. Show participating agents as mini-nodes inside
3. Configure routing strategy (round-robin, capability-based, priority)
4. Visualize which agent handled each request in test mode

**Files**:

- New: `nodes/agent-network-node.tsx`
- New: `panels/agent-network-config.tsx`

**Why n8n can't copy**: n8n has no concept of agent networks - it's a Mastra-native feature.

---

#### Task 0.2: Memory Visualization Panel

**Description**: Show what the agent "remembers" in real-time.

**What to do**:

1. Add "Memory" tab to agent node properties panel
2. Show working memory template with current values
3. Show semantic recall results (what memories were retrieved)
4. Display message history with token counts
5. Visualize context window usage (% full)

**Files**:

- New: `panels/memory-panel.tsx`
- Update: `panels/agent-config.tsx`

**Why n8n can't copy**: n8n has no memory system.

---

#### Task 0.3: AI Trace Overlay

**Description**: Show AI-specific execution data on nodes.

**What to do**:

1. During test runs, show on each agent/tool node:
   - Token usage (input/output)
   - Cost estimate
   - Model used
   - Latency
2. Click node to see full prompt/response
3. Show tool calls made by agent
4. Highlight which memory was used

**Files**:

- New: `components/ai-trace-overlay.tsx`
- Update: `components/step-status-overlay.tsx`

**Why n8n can't copy**: n8n doesn't track AI-specific metrics at this level.

---

#### Task 0.4: Eval Integration

**Description**: Run quality evaluations as part of workflow testing.

**What to do**:

1. Add "Evals" section to agent node config
2. Allow selecting from built-in scorers (Hallucination, Faithfulness, etc.)
3. Show eval results after test run (scores with explanations)
4. Configure TripWire thresholds (abort if score below X)

**Files**:

- New: `panels/eval-config.tsx`
- New: `components/eval-results-panel.tsx`

**Why n8n can't copy**: n8n has no evaluation framework.

---

#### Task 0.5: Human-in-the-Loop Config

**Description**: First-class suspend/resume with typed schemas.

**What to do**:

1. Enhance Suspend node config with visual schema builder
2. Show what data will be shown to human (payload preview)
3. Show what data human needs to provide (resume schema)
4. In test mode, render actual form for human input

**Files**:

- Update: `nodes/suspend-node.tsx`
- Update: `panels/suspend-config.tsx`
- New: `components/human-input-modal.tsx`

**Why n8n can't copy**: n8n's Wait node is time-based, not data-typed.

---

### Phase 1: Quick-Add UX

**Goal**: Match n8n's signature interaction.
**Effort**: 2-3 days

#### Task 1.1: Add Quick-Add Button to BaseNode

**File**: `packages/playground-ui/src/domains/workflow-builder/components/nodes/base-node.tsx`

**What to do**:

1. Add a circular "+" button that appears on hover near the bottom output handle
2. Button should only show when `hasBottomHandle` is true
3. Use `Plus` icon from lucide-react
4. Style: 20x20px, bg-accent1, rounded-full, opacity-0 by default, group-hover:opacity-100
5. Position: absolute, centered horizontally, 8px below the node bottom
6. Add onClick handler that calls a callback prop `onQuickAdd`

**Acceptance criteria**:

- [ ] "+" button appears on hover for nodes with output handles
- [ ] Button is positioned below the node, centered
- [ ] Clicking button stops event propagation
- [ ] Button calls onQuickAdd callback when clicked

---

#### Task 1.2: Create QuickAddPopover Component

**File**: `packages/playground-ui/src/domains/workflow-builder/components/quick-add-popover.tsx` (new file)

**What to do**:

1. Create a popover component using Radix UI Popover
2. Display a list of available node types (reuse STEP_ITEMS from builder-sidebar.tsx)
3. Each item shows icon, label, and description
4. Items are clickable and call onSelect with the node type
5. Include a search input at the top to filter items
6. Support keyboard navigation (arrow keys, enter to select)

**Acceptance criteria**:

- [ ] Popover renders with all node types except trigger
- [ ] Search filters items by label
- [ ] Clicking an item calls onSelect and closes popover
- [ ] Escape key closes popover
- [ ] Arrow keys navigate items, Enter selects

---

#### Task 1.3: Add addConnectedNode Action to Store

**File**: `packages/playground-ui/src/domains/workflow-builder/store/workflow-builder-store.ts`

**What to do**:

1. Add new action `addConnectedNode(sourceNodeId: string, type: BuilderNodeType, sourceHandle?: string)`
2. Calculate position: source node position + { x: 0, y: 150 }
3. Create new node at calculated position
4. Create edge from source to new node (use sourceHandle if provided for condition nodes)
5. Select the new node
6. Push to history

**Acceptance criteria**:

- [ ] New node is created 150px below source node
- [ ] Edge is automatically created connecting source to new node
- [ ] New node is selected after creation
- [ ] History is updated for undo support
- [ ] Works with condition nodes using sourceHandle parameter

---

#### Task 1.4: Integrate Quick-Add into Node Components

**Files**: All node components in `components/nodes/`

**What to do**:

1. Import QuickAddPopover component
2. Add local state for popover open/closed
3. Pass onQuickAdd callback to BaseNode that opens popover
4. Calculate anchor position based on node position
5. Handle onSelect to call store's addConnectedNode

**Acceptance criteria**:

- [ ] Each node type (trigger, agent, tool, condition) has quick-add functionality
- [ ] Clicking "+" opens popover at correct position below the node
- [ ] Selecting a type creates connected node and closes popover
- [ ] Condition node passes sourceHandle for branch-specific connections

---

#### Task 1.5: Add Keyboard Support for Quick-Add

**File**: `packages/playground-ui/src/domains/workflow-builder/components/builder-canvas.tsx`

**What to do**:

1. Add keyboard event listener for Tab key
2. When Tab is pressed and a node is selected, trigger quick-add on that node
3. Use store-based approach with `quickAddNodeId` state

**Acceptance criteria**:

- [ ] Pressing Tab when a node is selected opens quick-add popover
- [ ] Tab is prevented from normal focus behavior when node is selected
- [ ] Works for all node types
- [ ] Shift+Tab does not trigger quick-add

---

### Phase 2: Complete Workflow Primitives

**Goal**: Support all Mastra workflow capabilities visually.
**Effort**: 5-7 days

#### Task 2.1: Update Types with New Node Data Interfaces

**File**: `packages/playground-ui/src/domains/workflow-builder/types.ts`

**New types to add**:

```typescript
export type BuilderNodeType =
  | 'trigger'
  | 'agent'
  | 'tool'
  | 'condition' // existing
  | 'parallel'
  | 'loop'
  | 'foreach'
  | 'transform'
  | 'suspend'
  | 'workflow'
  | 'sleep'
  | 'agent-network'; // new

export interface ParallelNodeData extends BaseNodeData {
  type: 'parallel';
  branches: Array<{ id: string; label: string }>;
}

export interface LoopNodeData extends BaseNodeData {
  type: 'loop';
  loopType: 'dowhile' | 'dountil';
  condition: ConditionDef | null;
  maxIterations?: number;
}

export interface ForeachNodeData extends BaseNodeData {
  type: 'foreach';
  collection: VariableRef | null;
  concurrency?: number;
  itemVariable: string;
}

export interface TransformNodeData extends BaseNodeData {
  type: 'transform';
  output: Record<string, ValueOrRef>;
  outputSchema: Record<string, unknown>;
}

export interface SuspendNodeData extends BaseNodeData {
  type: 'suspend';
  resumeSchema: Record<string, unknown>;
  payload?: Record<string, ValueOrRef>;
}

export interface WorkflowNodeData extends BaseNodeData {
  type: 'workflow';
  workflowId: string | null;
  input: Record<string, ValueOrRef>;
}

export interface SleepNodeData extends BaseNodeData {
  type: 'sleep';
  sleepType: 'duration' | 'timestamp';
  duration?: number;
  timestamp?: ValueOrRef;
}

export interface AgentNetworkNodeData extends BaseNodeData {
  type: 'agent-network';
  networkId: string | null;
  agents: string[]; // Agent IDs in network
  routingStrategy: 'round-robin' | 'capability' | 'priority';
}
```

---

#### Tasks 2.2-2.15: Node Components and Config Panels

| Task      | Node Type | Node File            | Config File            | Color            |
| --------- | --------- | -------------------- | ---------------------- | ---------------- |
| 2.2-2.3   | parallel  | `parallel-node.tsx`  | `parallel-config.tsx`  | Cyan `#06b6d4`   |
| 2.4-2.5   | loop      | `loop-node.tsx`      | `loop-config.tsx`      | Orange `#f97316` |
| 2.6-2.7   | foreach   | `foreach-node.tsx`   | `foreach-config.tsx`   | Pink `#ec4899`   |
| 2.8-2.9   | transform | `transform-node.tsx` | `transform-config.tsx` | Teal `#14b8a6`   |
| 2.10-2.11 | suspend   | `suspend-node.tsx`   | `suspend-config.tsx`   | Red `#ef4444`    |
| 2.12-2.13 | workflow  | `workflow-node.tsx`  | `workflow-config.tsx`  | Indigo `#6366f1` |
| 2.14-2.15 | sleep     | `sleep-node.tsx`     | `sleep-config.tsx`     | Gray `#6b7280`   |

---

#### Tasks 2.16-2.21: Infrastructure Updates

| Task | Description             | File                        |
| ---- | ----------------------- | --------------------------- |
| 2.16 | Update node registry    | `nodes/index.ts`            |
| 2.17 | Update sidebar          | `builder-sidebar.tsx`       |
| 2.18 | Update properties panel | `properties-panel.tsx`      |
| 2.19 | Update store factories  | `workflow-builder-store.ts` |
| 2.20 | Update serializer       | `utils/serialize.ts`        |
| 2.21 | Update deserializer     | `utils/deserialize.ts`      |

---

### Phase 3: Validation & Error Handling

**Goal**: Prevent invalid workflows and guide users to fix issues.
**Effort**: 3-4 days

#### Task 3.1: Create Validation Utility

**File**: `packages/playground-ui/src/domains/workflow-builder/utils/validate.ts` (new)

**Validation rules**:

- trigger: Exactly one required
- agent: agentId required, prompt source required
- tool: toolId required
- condition: At least one branch condition (warning)
- parallel: At least 2 branches
- loop: condition required
- foreach: collection required
- workflow: workflowId required
- suspend: resumeSchema should have properties (warning)
- sleep: duration > 0 or timestamp required

**Graph validation**:

- All non-trigger nodes reachable from trigger
- No orphaned nodes (warning)
- Valid connections (output to input only)

---

#### Tasks 3.2-3.10: Validation UI

| Task | Description                      | File                        |
| ---- | -------------------------------- | --------------------------- |
| 3.2  | Node validation rules            | `utils/validate.ts`         |
| 3.3  | Graph validation rules           | `utils/validate.ts`         |
| 3.4  | Add validation state to store    | `workflow-builder-store.ts` |
| 3.5  | Visual error state on nodes      | `base-node.tsx`             |
| 3.6  | Error tooltip on hover           | `base-node.tsx`             |
| 3.7  | Validation panel                 | New: `validation-panel.tsx` |
| 3.8  | Click-to-select from panel       | `validation-panel.tsx`      |
| 3.9  | Save blocking with override      | `builder-toolbar.tsx`       |
| 3.10 | Real-time validation (debounced) | Store integration           |

---

### Phase 4: Data Mapping UX (n8n's Killer Feature)

**Goal**: Visual data flow that non-developers can understand.
**Effort**: 3-4 days

#### Task 4.1: Data Preview Panel

**Description**: Show output data from previous nodes.

**What to do**:

1. Add collapsible "Data" panel on left side of properties panel
2. Show JSON tree of available data from upstream nodes
3. Expandable/collapsible nested objects
4. Search/filter within data

---

#### Task 4.2: Drag-and-Drop Data Mapping

**Description**: Drag from data preview directly into input fields.

**What to do**:

1. Make data preview items draggable
2. Input fields become drop targets
3. On drop, auto-generate `$ref` expression
4. Visual feedback during drag (highlight valid drop targets)

---

#### Task 4.3: Data Pinning (n8n's Best Feature)

**Description**: Lock node output data for consistent testing.

**What to do**:

1. Add "Pin" button to each node during test mode
2. Pinned nodes show indicator
3. When running tests, use pinned data instead of re-executing
4. Persist pinned data in local storage
5. Allow editing pinned data

**Why this matters**: Speeds up testing by 10x for workflows with slow API calls.

---

#### Task 4.4: Expression Editor Enhancement

**Description**: Better expression editing experience.

**What to do**:

1. Syntax highlighting for `$ref` expressions
2. Autocomplete for available paths
3. Expression validation (show error if path doesn't exist)
4. "Try it" button to evaluate expression against pinned data

---

### Phase 5: Test & Debug Mode

**Goal**: Run workflows from the builder with visual feedback.
**Effort**: 5-7 days

#### Task 5.1: Test Runner Store

**File**: `packages/playground-ui/src/domains/workflow-builder/store/test-runner-store.ts` (new)

**State**:

```typescript
interface TestRunnerState {
  isRunning: boolean;
  runId: string | null;
  inputs: Record<string, unknown>;
  stepStates: Record<
    string,
    {
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'suspended';
      output?: unknown;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
      // AI-specific
      tokenUsage?: { input: number; output: number };
      cost?: number;
      model?: string;
      toolCalls?: Array<{ name: string; input: unknown; output: unknown }>;
    }
  >;
  currentStepId: string | null;
  isPaused: boolean;
  suspendedStepId: string | null;
  suspendedPayload?: unknown;
}
```

---

#### Tasks 5.2-5.8: Test Mode UI

| Task | Description                     | File                           |
| ---- | ------------------------------- | ------------------------------ |
| 5.2  | Test input form                 | New: `test-input-panel.tsx`    |
| 5.3  | Run button in toolbar           | `builder-toolbar.tsx`          |
| 5.4  | Step status overlay             | New: `step-status-overlay.tsx` |
| 5.5  | AI trace overlay (tokens, cost) | New: `ai-trace-overlay.tsx`    |
| 5.6  | Output inspector                | `properties-panel.tsx`         |
| 5.7  | Suspend handling (show form)    | New: `human-input-modal.tsx`   |
| 5.8  | Historical execution replay     | Integration with API           |

---

### Phase 6: Workflow Templates

**Goal**: Pre-built starters for non-developers.
**Effort**: 2-3 days

#### Built-in Templates

1. **Simple Agent Chat**
   - Trigger -> Agent
   - Shows: Basic agent configuration

2. **Agent with Tools**
   - Trigger -> Agent (with tools attached)
   - Shows: Tool configuration, tool calls

3. **Multi-Agent Collaboration**
   - Trigger -> Agent Network
   - Shows: Agent network routing

4. **Human Approval Workflow**
   - Trigger -> Agent -> Suspend -> Agent
   - Shows: Human-in-the-loop pattern

5. **RAG Pipeline**
   - Trigger -> Tool (search) -> Agent (with context)
   - Shows: Context injection

6. **Parallel Agent Processing**
   - Trigger -> Parallel -> [Agent A, Agent B] -> Transform (merge)
   - Shows: Parallel execution, result merging

7. **Agent with Memory**
   - Trigger -> Agent (with semantic recall)
   - Shows: Memory configuration, working memory

8. **Evaluated Agent**
   - Trigger -> Agent (with evals) -> Condition (quality gate)
   - Shows: Eval integration, quality routing

---

## UX Principles for Beating n8n

### 1. AI-First Visualization

- Show tokens, costs, prompts inline - not buried in logs
- Visualize agent reasoning, not just data flow
- Display memory state, context windows, tool calls

### 2. Developer Velocity

- Keyboard shortcuts for everything
- Data pinning for fast iteration
- Historical replay for debugging
- Expression autocomplete

### 3. Non-Developer Accessibility

- Visual data mapping (drag-and-drop)
- Templates for common patterns
- Clear error messages with fix suggestions
- Progressive disclosure (simple by default, power features available)

### 4. AI-Specific Debugging

- See exactly what prompt was sent
- Trace which memory was used
- View tool call sequence
- Compare model outputs

### 5. Production Readiness

- Built-in quality evaluation
- TripWire abort thresholds
- Cost monitoring and alerts
- Human approval gates

---

## Success Metrics

| Metric                       | Target                      |
| ---------------------------- | --------------------------- |
| Time to build first workflow | < 5 minutes                 |
| Workflows built without docs | 80%+                        |
| Invalid workflows saved      | 0 (validation blocks)       |
| Test iteration speed         | < 3 seconds with pinning    |
| AI-specific issues debugged  | 90% without code inspection |

---

## Timeline Summary

| Phase                       | Tasks | Effort   | Priority |
| --------------------------- | ----- | -------- | -------- |
| Phase 0: AI Differentiators | 5     | 5-7 days | Highest  |
| Phase 1: Quick-Add          | 5     | 2-3 days | High     |
| Phase 2: Primitives         | 21    | 5-7 days | High     |
| Phase 3: Validation         | 10    | 3-4 days | High     |
| Phase 4: Data Mapping       | 4     | 3-4 days | Medium   |
| Phase 5: Test/Debug         | 8     | 5-7 days | Medium   |
| Phase 6: Templates          | 4     | 2-3 days | Low      |

**Total**: 57 tasks, 25-35 days

---

## References

- **n8n Docs**: https://docs.n8n.io
- **Retool Workflows**: https://retool.com/products/workflows
- **Temporal**: https://temporal.io
- **Inngest**: https://inngest.com
- **Mastra Core**: `packages/core/src/`
- **Mastra Evals**: `packages/evals/src/`
- **Mastra Memory**: `packages/memory/src/`
