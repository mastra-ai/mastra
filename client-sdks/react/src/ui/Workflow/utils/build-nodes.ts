import { MarkerType, type Edge } from '@xyflow/react';
import { type StepMetadataType, type WorkflowNode } from '../types';
import { type SerializedStepFlowEntry, type WorkflowStreamResult } from '@mastra/core/workflows';
import { type StepWithMetadata } from '../types';

type WorkflowStepToNodeArgs = {
  id: string;
  step: StepWithMetadata;
  hasChild: boolean;
  stepRun?: WorkflowStreamResult<any, any, any, any>['steps'][string];
  parentNodes?: WorkflowNode[];
  type?: StepMetadataType;
  nestedWorkflowNodes?: { nodes: WorkflowNode[]; edges: Edge[] };
};

const workflowStepToNode = ({
  id,
  step,
  hasChild,
  stepRun,
  parentNodes,
  type,
  nestedWorkflowNodes,
}: WorkflowStepToNodeArgs): WorkflowNode => {
  return {
    id,
    position: { x: 0, y: 0 }, // Will be overridden by positioning logic
    data: {
      step,
      stepRun,
      isLastStep: !hasChild,
      parentNodes,
      type,
      nestedWorkflowNodes,
      showParentHandle: Boolean(parentNodes && parentNodes?.length > 0),
      isParentStepSuccessful: Boolean(parentNodes?.some(node => node.data.stepRun?.status === 'success')),
    },
    type: 'default',
  };
};

export const buildNodes = (
  stepGraph: SerializedStepFlowEntry[],
  workflowResult: WorkflowStreamResult<any, any, any, any>,
  parentIdForNestedNodes?: string,
) => {
  const nodes: WorkflowNode[] = [];
  const edges: Edge[] = [];
  let currentParentNodes: WorkflowNode[] = [];

  for (let i = 0; i < stepGraph.length; i++) {
    const step = stepGraph[i];
    const childStep = stepGraph[i + 1];
    const hasChild = Boolean(childStep);

    const { nodes: nodesToAdd, edges: edgesToAdd } = createStepNode({
      step,
      parentNodes: currentParentNodes,
      hasChild,
      workflowResult,
      parentIdForNestedNodes,
    });

    nodes.push(...nodesToAdd);
    edges.push(...edgesToAdd);

    currentParentNodes = nodesToAdd;
  }

  // Apply positioning to all nodes

  return { nodes, edges };
};

type CreateStepNodeArgs = {
  step: StepWithMetadata;
  hasChild: boolean;
  workflowResult: WorkflowStreamResult<any, any, any, any>;
  parentNodes?: WorkflowNode[];
  type?: StepMetadataType;
  parentIdForNestedNodes?: string;
};
const createStepNode = ({
  step,
  hasChild,
  workflowResult,
  parentNodes,
  type,
  parentIdForNestedNodes,
}: CreateStepNodeArgs): { nodes: WorkflowNode[]; edges: Edge[] } => {
  const parents = parentNodes || [];
  const hasParents = parents.length > 0;

  switch (step.type) {
    case 'waitForEvent':
    case 'foreach':
    case 'loop':
    case 'step': {
      const id = step.step.id;
      // We are dealing with the nested workflow ID generation here
      const adjustedId = parentIdForNestedNodes ? `${parentIdForNestedNodes}.${id}` : id;
      const adjustedParentId = parentIdForNestedNodes ? parentIdForNestedNodes : id;

      const node = workflowStepToNode({
        id: adjustedId,
        step,
        hasChild,
        stepRun: workflowResult?.steps[adjustedId],
        parentNodes,
        type:
          type ||
          (['waitForEvent', 'loop', 'foreach'].includes(step.type) ? (step.type as StepMetadataType) : undefined),
        nestedWorkflowNodes: step.step.serializedStepFlow
          ? buildNodes(step.step.serializedStepFlow, workflowResult, adjustedParentId)
          : undefined,
      });

      const edges: Edge[] = [];
      if (hasParents) {
        edges.push(...parents.map(parentNode => buildEdge({ parentNode, node })));
      }
      return { nodes: [node], edges };
    }

    case 'sleepUntil':
    case 'sleep': {
      const id = step.id;
      const node = workflowStepToNode({
        id,
        step,
        parentNodes,
        hasChild,
        stepRun: workflowResult?.steps[step.id],
        type,
      });

      const edges: Edge[] = [];

      if (hasParents) {
        edges.push(...parents.map(parentNode => buildEdge({ parentNode, node })));
      }

      return { nodes: [node], edges };
    }

    case 'conditional': {
      const nodes: WorkflowNode[] = [];
      const edges: Edge[] = [];

      step.steps.forEach((subStep, index) => {
        const node = createStepNode({
          step: { ...subStep, condition: step.serializedConditions[index]?.fn },
          parentNodes,
          hasChild,
          workflowResult,
          type: step.type,
          parentIdForNestedNodes,
        });

        nodes.push(...node.nodes);
        edges.push(...node.edges);
      });

      return { nodes, edges };
    }

    case 'parallel': {
      const nodes: WorkflowNode[] = [];
      const edges: Edge[] = [];

      step.steps.forEach(subStep => {
        const node = createStepNode({
          step: subStep,
          parentNodes,
          hasChild,
          workflowResult,
          type: step.type,
          parentIdForNestedNodes,
        });

        nodes.push(...node.nodes);
        edges.push(...node.edges);
      });

      return { nodes, edges };
    }
  }
};

type BuildEdgeArgs = {
  parentNode: WorkflowNode;
  node: WorkflowNode;
};

const buildEdge = ({ parentNode, node }: BuildEdgeArgs): Edge => {
  const status = parentNode.data.stepRun?.status;

  return {
    id: `${parentNode.id}->${node.id}`,
    source: parentNode.id,
    target: node.id,
    style: {
      stroke: status === 'success' ? 'var(--color-accent1)' : undefined,
      strokeWidth: status === 'success' ? 2 : undefined,
      strokeDasharray: status === 'success' ? undefined : '5 5',
    },
    animated: status !== 'success',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: status === 'success' ? 'var(--color-accent1)' : 'var(--color-text1)',
    },
  };
};
