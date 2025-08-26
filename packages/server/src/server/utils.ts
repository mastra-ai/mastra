import type { StepWithComponent, Workflow, WorkflowInfo } from '@mastra/core/workflows';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

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

/**
 * Workflow Registry for temporarily registering additional workflows
 * that are not part of the user's Mastra instance (e.g., internal template workflows)
 */
export class WorkflowRegistry {
  private static additionalWorkflows: Record<string, Workflow> = {};

  /**
   * Register a workflow temporarily
   */
  static registerTemporaryWorkflow(id: string, workflow: Workflow): void {
    this.additionalWorkflows[id] = workflow;
  }

  /**
   * Get a workflow by ID from the registry (returns undefined if not found)
   */
  static getWorkflow(workflowId: string): Workflow | undefined {
    return this.additionalWorkflows[workflowId];
  }

  /**
   * Clean up a temporary workflow
   */
  static cleanup(workflowId: string): void {
    delete this.additionalWorkflows[workflowId];
  }

  /**
   * Get all registered temporary workflow IDs (for debugging)
   */
  static getRegisteredWorkflowIds(): string[] {
    return Object.keys(this.additionalWorkflows);
  }
}
