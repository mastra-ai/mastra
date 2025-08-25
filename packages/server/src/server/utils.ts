import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import type { StepWithComponent, Workflow, WorkflowInfo } from '@mastra/core/workflows';
import { stringify } from 'superjson';

function getSteps(steps: Record<string, StepWithComponent>, path?: string) {
  return Object.entries(steps).reduce<any>((acc, [key, step]) => {
    const fullKey = path ? `${path}.${key}` : key;
    acc[fullKey] = {
      id: step.id,
      description: step.description,
      inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
      outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
      resumeSchema: step.resumeSchema ? stringify(zodToJsonSchema(step.resumeSchema)) : undefined,
      suspendSchema: step.suspendSchema ? stringify(zodToJsonSchema(step.suspendSchema)) : undefined,
      isWorkflow: step.component === 'WORKFLOW',
    };

    if (step.component === 'WORKFLOW' && step.steps) {
      const nestedSteps = getSteps(step.steps, fullKey) || {};
      acc = { ...acc, ...nestedSteps };
    }

    return acc;
  }, {});
}

export function getWorkflowInfo(workflow: Workflow): WorkflowInfo {
  return {
    name: workflow.name,
    description: workflow.description,
    steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      acc[key] = {
        id: step.id,
        description: step.description,
        inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
        outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
        resumeSchema: step.resumeSchema ? stringify(zodToJsonSchema(step.resumeSchema)) : undefined,
        suspendSchema: step.suspendSchema ? stringify(zodToJsonSchema(step.suspendSchema)) : undefined,
      };
      return acc;
    }, {}),
    allSteps: getSteps(workflow.steps) || {},
    stepGraph: workflow.serializedStepGraph,
    inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
    outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
  };
}
