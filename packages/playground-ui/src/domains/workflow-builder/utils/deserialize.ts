import Dagre from '@dagrejs/dagre';
import type {
  BuilderNode,
  BuilderEdge,
  AgentNodeData,
  ToolNodeData,
  ConditionNodeData,
  ConditionBranch,
  WorkflowNodeData,
  TransformNodeData,
  SuspendNodeData,
  SleepNodeData,
  LoopNodeData,
  ForeachNodeData,
  ParallelNodeData,
  ParallelBranch,
} from '../types';
import {
  createTriggerNodeData,
  createAgentNodeData,
  createToolNodeData,
  createConditionNodeData,
  createWorkflowNodeData,
  createTransformNodeData,
  createSuspendNodeData,
  createSleepNodeData,
  createLoopNodeData,
  createForeachNodeData,
  createParallelNodeData,
} from '../types';
import type {
  StorageWorkflowDefinitionType,
  DeclarativeStepDefinition,
  AgentStepDef,
  ToolStepDef,
  WorkflowStepDef,
  TransformStepDef,
  SuspendStepDef,
  VariableRef,
  DefinitionStepFlowEntry,
} from '@mastra/core/storage';

export interface DeserializeResult {
  nodes: BuilderNode[];
  edges: BuilderEdge[];
}

const NODE_WIDTH = 274;
const NODE_HEIGHT = 100;

/**
 * Convert StorageWorkflowDefinitionType to React Flow nodes/edges
 */
export function deserializeDefinition(definition: StorageWorkflowDefinitionType): DeserializeResult {
  const nodes: BuilderNode[] = [];
  const edges: BuilderEdge[] = [];

  // Extract node comments from metadata (if present)
  const nodeComments: Record<string, string> =
    (definition.metadata?.nodeComments as Record<string, string>) ?? {};

  // Create trigger node
  const triggerNode: BuilderNode = {
    id: 'trigger',
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: {
      ...createTriggerNodeData(),
      comment: nodeComments['trigger'],
    },
  };
  nodes.push(triggerNode);

  // Create nodes for each step in the steps object
  for (const [stepId, stepDef] of Object.entries(definition.steps)) {
    const node = stepDefToNode(stepId, stepDef, nodeComments[stepId]);
    if (node) {
      nodes.push(node);
    }
  }

  // Track generated nodes for flow entries that create nodes (sleep, loop, etc.)
  let conditionCounter = 0;
  let sleepCounter = 0;
  let loopCounter = 0;
  let foreachCounter = 0;
  let parallelCounter = 0;

  // Process stepGraph to create flow control nodes and edges
  let lastNodeId = 'trigger';
  const processedSteps = new Set<string>();

  for (const entry of definition.stepGraph) {
    const result = processStepGraphEntry(entry, lastNodeId, nodes, edges, processedSteps, {
      conditionCounter,
      sleepCounter,
      loopCounter,
      foreachCounter,
      parallelCounter,
    }, nodeComments);

    // Update counters
    conditionCounter = result.counters.conditionCounter;
    sleepCounter = result.counters.sleepCounter;
    loopCounter = result.counters.loopCounter;
    foreachCounter = result.counters.foreachCounter;
    parallelCounter = result.counters.parallelCounter;

    // Update lastNodeId if the entry type advances it
    if (result.nextNodeId) {
      lastNodeId = result.nextNodeId;
    }
  }

  // Apply dagre layout
  const layoutedNodes = applyDagreLayout(nodes, edges);

  return {
    nodes: layoutedNodes,
    edges,
  };
}

interface ProcessingCounters {
  conditionCounter: number;
  sleepCounter: number;
  loopCounter: number;
  foreachCounter: number;
  parallelCounter: number;
}

interface ProcessingResult {
  counters: ProcessingCounters;
  nextNodeId: string | null;
}

/**
 * Process a single step graph entry
 */
function processStepGraphEntry(
  entry: DefinitionStepFlowEntry,
  lastNodeId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  processedSteps: Set<string>,
  counters: ProcessingCounters,
  nodeComments: Record<string, string>,
): ProcessingResult {
  switch (entry.type) {
    case 'step': {
      // Don't create duplicate edges for already-processed steps
      if (!processedSteps.has(entry.step.id)) {
        edges.push({
          id: `e-${lastNodeId}-${entry.step.id}`,
          source: lastNodeId,
          target: entry.step.id,
          type: 'data',
        });
        processedSteps.add(entry.step.id);
      }
      return {
        counters,
        nextNodeId: entry.step.id,
      };
    }

    case 'sleep': {
      // Use the stored ID to preserve node identity (important for comments)
      const sleepNodeId = entry.id;
      const sleepData: SleepNodeData = {
        ...createSleepNodeData('Sleep'),
        sleepType: 'duration',
        duration: entry.duration,
        comment: nodeComments[sleepNodeId],
      };

      nodes.push({
        id: sleepNodeId,
        type: 'sleep',
        position: { x: 0, y: 0 },
        data: sleepData,
      });

      edges.push({
        id: `e-${lastNodeId}-${sleepNodeId}`,
        source: lastNodeId,
        target: sleepNodeId,
        type: 'data',
      });

      return {
        counters,
        nextNodeId: sleepNodeId,
      };
    }

    case 'sleepUntil': {
      // Use the stored ID to preserve node identity (important for comments)
      const sleepNodeId = entry.id;
      const sleepData: SleepNodeData = {
        ...createSleepNodeData('Sleep Until'),
        sleepType: 'timestamp',
        timestamp: entry.timestamp,
        comment: nodeComments[sleepNodeId],
      };

      nodes.push({
        id: sleepNodeId,
        type: 'sleep',
        position: { x: 0, y: 0 },
        data: sleepData,
      });

      edges.push({
        id: `e-${lastNodeId}-${sleepNodeId}`,
        source: lastNodeId,
        target: sleepNodeId,
        type: 'data',
      });

      return {
        counters,
        nextNodeId: sleepNodeId,
      };
    }

    case 'loop': {
      const loopNodeId = `loop-${counters.loopCounter++}`;
      const loopData: LoopNodeData = {
        ...createLoopNodeData('Loop'),
        loopType: entry.loopType,
        condition: entry.condition,
        comment: nodeComments[loopNodeId],
      };

      nodes.push({
        id: loopNodeId,
        type: 'loop',
        position: { x: 0, y: 0 },
        data: loopData,
      });

      // Edge from last node to loop
      edges.push({
        id: `e-${lastNodeId}-${loopNodeId}`,
        source: lastNodeId,
        target: loopNodeId,
        type: 'data',
      });

      // Edge from loop to body step
      edges.push({
        id: `e-${loopNodeId}-${entry.stepId}`,
        source: loopNodeId,
        target: entry.stepId,
        type: 'data',
        sourceHandle: 'loop-body',
        data: { label: 'Loop body' },
      });

      return {
        counters: { ...counters, loopCounter: counters.loopCounter },
        nextNodeId: loopNodeId,
      };
    }

    case 'foreach': {
      const foreachNodeId = `foreach-${counters.foreachCounter++}`;
      const foreachData: ForeachNodeData = {
        ...createForeachNodeData('For Each'),
        collection: entry.collection,
        concurrency: entry.concurrency,
        itemVariable: 'item',
        comment: nodeComments[foreachNodeId],
      };

      nodes.push({
        id: foreachNodeId,
        type: 'foreach',
        position: { x: 0, y: 0 },
        data: foreachData,
      });

      // Edge from last node to foreach
      edges.push({
        id: `e-${lastNodeId}-${foreachNodeId}`,
        source: lastNodeId,
        target: foreachNodeId,
        type: 'data',
      });

      // Edge from foreach to body step
      edges.push({
        id: `e-${foreachNodeId}-${entry.stepId}`,
        source: foreachNodeId,
        target: entry.stepId,
        type: 'data',
        sourceHandle: 'foreach-body',
        data: { label: 'For each item' },
      });

      return {
        counters: { ...counters, foreachCounter: counters.foreachCounter },
        nextNodeId: foreachNodeId,
      };
    }

    case 'parallel': {
      const parallelNodeId = `parallel-${counters.parallelCounter++}`;
      const branches: ParallelBranch[] = entry.steps.map((s, i) => ({
        id: `branch-${i}`,
        label: `Branch ${i + 1}`,
      }));

      const parallelData: ParallelNodeData = {
        ...createParallelNodeData('Parallel'),
        branches,
        comment: nodeComments[parallelNodeId],
      };

      nodes.push({
        id: parallelNodeId,
        type: 'parallel',
        position: { x: 0, y: 0 },
        data: parallelData,
      });

      // Edge from last node to parallel
      edges.push({
        id: `e-${lastNodeId}-${parallelNodeId}`,
        source: lastNodeId,
        target: parallelNodeId,
        type: 'data',
      });

      // Edge from parallel to each branch step
      for (let i = 0; i < entry.steps.length; i++) {
        const step = entry.steps[i];
        edges.push({
          id: `e-${parallelNodeId}-${step.step.id}`,
          source: parallelNodeId,
          target: step.step.id,
          type: 'data',
          sourceHandle: `branch-${i}`,
          data: {
            branchId: `branch-${i}`,
            label: `Branch ${i + 1}`,
          },
        });
      }

      return {
        counters: { ...counters, parallelCounter: counters.parallelCounter },
        // Parallel doesn't have a single "next" node
        nextNodeId: null,
      };
    }

    case 'conditional': {
      const conditionNodeId = `condition-${counters.conditionCounter++}`;
      const branches: ConditionBranch[] = entry.branches.map((branch, i) => ({
        id: String(i),
        label: `Branch ${i + 1}`,
        condition: branch.condition,
      }));

      // Add default branch if present
      if (entry.default) {
        branches.push({
          id: 'default',
          label: 'Default',
          condition: null,
        });
      }

      const conditionData: ConditionNodeData = {
        ...createConditionNodeData('Condition'),
        branches,
        defaultBranch: entry.default ? 'default' : undefined,
        comment: nodeComments[conditionNodeId],
      };

      nodes.push({
        id: conditionNodeId,
        type: 'condition',
        position: { x: 0, y: 0 },
        data: conditionData,
      });

      // Edge from last node to condition
      edges.push({
        id: `e-${lastNodeId}-${conditionNodeId}`,
        source: lastNodeId,
        target: conditionNodeId,
        type: 'data',
      });

      // Create edges to each branch target
      for (let i = 0; i < entry.branches.length; i++) {
        const branch = entry.branches[i];
        edges.push({
          id: `e-${conditionNodeId}-${branch.stepId}-${i}`,
          source: conditionNodeId,
          target: branch.stepId,
          type: 'data',
          sourceHandle: `branch-${i}`,
          data: {
            branchId: String(i),
            label: `Branch ${i + 1}`,
          },
        });
      }

      if (entry.default) {
        edges.push({
          id: `e-${conditionNodeId}-${entry.default}-default`,
          source: conditionNodeId,
          target: entry.default,
          type: 'data',
          sourceHandle: `branch-${entry.branches.length}`,
          data: {
            branchId: 'default',
            label: 'Default',
          },
        });
      }

      return {
        counters: { ...counters, conditionCounter: counters.conditionCounter },
        // Condition doesn't have a single "next" node
        nextNodeId: null,
      };
    }

    case 'map': {
      // Map entries are inline transforms, we don't create a separate node
      // The output is applied to the workflow state
      return {
        counters,
        nextNodeId: null,
      };
    }

    default:
      return {
        counters,
        nextNodeId: null,
      };
  }
}

/**
 * Convert a step definition to a React Flow node
 */
function stepDefToNode(stepId: string, stepDef: DeclarativeStepDefinition, comment?: string): BuilderNode | null {
  switch (stepDef.type) {
    case 'agent': {
      const agentDef = stepDef as AgentStepDef;
      // Use agent ID as label (more readable than UUID), fallback to generic label
      const label = agentDef.agentId || 'Agent Step';
      const agentData: AgentNodeData = {
        ...createAgentNodeData(label),
        agentId: agentDef.agentId,
        prompt: agentDef.input.prompt as VariableRef,
        instructions: typeof agentDef.input.instructions === 'string' ? agentDef.input.instructions : undefined,
        structuredOutput: agentDef.structuredOutput,
        comment,
      };

      return {
        id: stepId,
        type: 'agent',
        position: { x: 0, y: 0 },
        data: agentData,
      };
    }

    case 'tool': {
      const toolDef = stepDef as ToolStepDef;
      // Use tool ID as label (more readable than UUID), fallback to generic label
      const label = toolDef.toolId || 'Tool Step';
      const toolData: ToolNodeData = {
        ...createToolNodeData(label),
        toolId: toolDef.toolId,
        input: toolDef.input ?? {},
        comment,
      };

      return {
        id: stepId,
        type: 'tool',
        position: { x: 0, y: 0 },
        data: toolData,
      };
    }

    case 'workflow': {
      const workflowDef = stepDef as WorkflowStepDef;
      const label = workflowDef.workflowId || 'Sub-Workflow';
      const workflowData: WorkflowNodeData = {
        ...createWorkflowNodeData(label),
        workflowId: workflowDef.workflowId,
        input: workflowDef.input ?? {},
        comment,
      };

      return {
        id: stepId,
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: workflowData,
      };
    }

    case 'transform': {
      const transformDef = stepDef as TransformStepDef;
      const transformData: TransformNodeData = {
        ...createTransformNodeData('Transform'),
        output: transformDef.output,
        outputSchema: transformDef.outputSchema,
        comment,
      };

      return {
        id: stepId,
        type: 'transform',
        position: { x: 0, y: 0 },
        data: transformData,
      };
    }

    case 'suspend': {
      const suspendDef = stepDef as SuspendStepDef;
      const suspendData: SuspendNodeData = {
        ...createSuspendNodeData('Human Input'),
        resumeSchema: suspendDef.resumeSchema,
        payload: suspendDef.payload,
        comment,
      };

      return {
        id: stepId,
        type: 'suspend',
        position: { x: 0, y: 0 },
        data: suspendData,
      };
    }

    default:
      return null;
  }
}

/**
 * Apply dagre layout to position nodes in a top-to-bottom graph
 */
function applyDagreLayout(nodes: BuilderNode[], edges: BuilderEdge[]): BuilderNode[] {
  if (nodes.length === 0) return nodes;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });

  // Add nodes to graph
  for (const node of nodes) {
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // Add edges to graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run layout
  Dagre.layout(g);

  // Apply positions
  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}
