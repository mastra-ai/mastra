import type { WorkflowDraft, WorkflowDraftStep } from './workflow-draft';

export interface WorkflowDefinitionGraphNode {
  id: string;
  type: WorkflowDraftStep['type'];
  label: string;
  detail?: string;
  parentId?: string;
}

export interface WorkflowDefinitionGraphEdge {
  source: string;
  target: string;
  kind: 'sequence' | 'branch' | 'iteration';
}

export interface WorkflowDefinitionGraph {
  nodes: WorkflowDefinitionGraphNode[];
  edges: WorkflowDefinitionGraphEdge[];
}

function getStepId(step: WorkflowDraftStep, index: number): string {
  return 'id' in step ? step.id : `${step.type}-${index}`;
}

function getStepDetail(step: WorkflowDraftStep): string | undefined {
  switch (step.type) {
    case 'agent':
      return step.agentId;
    case 'tool':
      return step.toolId;
    case 'workflow':
      return step.workflowId;
    case 'mapping':
      return 'Transform data';
    case 'parallel':
      return `${step.steps.length} branches`;
    case 'foreach':
      return step.opts?.concurrency ? `Concurrency ${step.opts.concurrency}` : 'For each item';
    case 'conditional':
      return `${step.steps.length} branches`;
    case 'loop':
      return step.loopType === 'dowhile' ? 'Do while' : 'Do until';
    case 'sleep':
      return `${step.duration} ms`;
    case 'sleepUntil':
      return step.date;
  }
}

function getStepLabel(step: WorkflowDraftStep): string {
  switch (step.type) {
    case 'agent':
      return step.id;
    case 'tool':
      return step.id;
    case 'workflow':
      return step.id;
    case 'mapping':
      return step.id;
    case 'parallel':
      return 'Parallel';
    case 'foreach':
      return 'For each';
    case 'conditional':
      return 'Conditional';
    case 'loop':
      return 'Loop';
    case 'sleep':
      return step.id;
    case 'sleepUntil':
      return step.id;
  }
}

export function createWorkflowDefinitionGraph(draft: WorkflowDraft): WorkflowDefinitionGraph {
  const nodes: WorkflowDefinitionGraphNode[] = [];
  const edges: WorkflowDefinitionGraphEdge[] = [];

  draft.graph.forEach((step, index) => {
    const id = getStepId(step, index);
    nodes.push({ id, type: step.type, label: getStepLabel(step), detail: getStepDetail(step) });

    if (index > 0) {
      edges.push({ source: getStepId(draft.graph[index - 1], index - 1), target: id, kind: 'sequence' });
    }

    if (step.type === 'parallel') {
      step.steps.forEach((nestedStep, nestedIndex) => {
        const nestedId = `${id}/${getStepId(nestedStep, nestedIndex)}`;
        nodes.push({
          id: nestedId,
          type: nestedStep.type,
          label: getStepLabel(nestedStep),
          detail: getStepDetail(nestedStep),
          parentId: id,
        });
        edges.push({ source: id, target: nestedId, kind: 'branch' });
      });
    }

    if (step.type === 'foreach') {
      const nestedId = `${id}/${getStepId(step.step, 0)}`;
      nodes.push({
        id: nestedId,
        type: step.step.type,
        label: getStepLabel(step.step),
        detail: getStepDetail(step.step),
        parentId: id,
      });
      edges.push({ source: id, target: nestedId, kind: 'iteration' });
    }
  });

  return { nodes, edges };
}
