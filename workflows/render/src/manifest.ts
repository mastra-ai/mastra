import { createHash } from 'node:crypto';
import { standardSchemaToJSONSchema } from '@mastra/core/schema';
import type { AnyWorkflow, Step, StepFlowEntry } from '@mastra/core/workflows';
import { RenderProtocolError, unsupported } from './errors.js';
import { taskPolicy, type TaskPolicy } from './policy.js';
import { frameworkJson, type Json } from './protocol.js';

export const stepPolicies = new WeakMap<object, TaskPolicy>();
export interface RegisteredStep {
  key: string;
  name: string;
  step: Step;
  policy: TaskPolicy;
}
export interface Manifest {
  hash: string;
  rootName: string;
  steps: Map<string, RegisteredStep>;
}

function stable(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(value[key]!)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function name(workflowId: string, stepId: string, role: 'root' | 'step' = 'step'): string {
  const identity = JSON.stringify([role, workflowId, stepId]);
  const prefix = `${workflowId}-${stepId}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 39);
  return `mastra-${prefix}-${digest(identity).slice(0, 16)}`;
}

export function compileManifest(
  workflow: AnyWorkflow,
  buildId: string,
  defaults?: TaskPolicy,
  rootPolicy?: TaskPolicy,
): Manifest {
  if (!workflow.committed) throw new RenderProtocolError(`Commit workflow ${workflow.id} before using Render`);
  const steps = new Map<string, RegisteredStep>();
  const walk = (entry: StepFlowEntry): Json => {
    switch (entry.type) {
      case 'step': {
        const step = entry.step;
        if (step.component === 'WORKFLOW') unsupported('nested Mastra workflows');
        if (step.resumeSchema || step.suspendSchema) unsupported(`suspend/resume schemas on ${step.id}`);
        if (step.scorers) unsupported(`step scorers on ${step.id}`);
        if (step.retries) unsupported(`Mastra step retries on ${step.id}; configure render.retry instead`);
        const existing = steps.get(step.id);
        if (existing && existing.step !== step) throw new RenderProtocolError(`Duplicate step id ${step.id}`);
        const policy = taskPolicy(stepPolicies.get(step), defaults);
        steps.set(step.id, { key: step.id, name: name(workflow.id, step.id), step, policy });
        return frameworkJson({
          type: entry.type,
          id: step.id,
          policy,
          input: standardSchemaToJSONSchema(step.inputSchema),
          output: standardSchemaToJSONSchema(step.outputSchema),
          state: step.stateSchema ? standardSchemaToJSONSchema(step.stateSchema) : undefined,
          context: step.requestContextSchema ? standardSchemaToJSONSchema(step.requestContextSchema) : undefined,
        });
      }
      case 'mapping':
        return { type: 'mapping', id: entry.id };
      case 'parallel':
      case 'conditional':
        return { type: entry.type, children: entry.steps.map(walk) };
      case 'foreach':
        return frameworkJson({ type: entry.type, child: walk(entry.step), options: entry.opts });
      default:
        return unsupported(`graph entry ${entry.type}; use explicit steps, mappings, parallel, branch or foreach`);
    }
  };
  const graph = workflow.stepGraph.map(walk);
  const schema = frameworkJson({
    workflow: workflow.id,
    buildId,
    graph,
    rootPolicy,
    input: standardSchemaToJSONSchema(workflow.inputSchema),
    output: standardSchemaToJSONSchema(workflow.outputSchema),
    state: workflow.stateSchema ? standardSchemaToJSONSchema(workflow.stateSchema) : undefined,
    context: workflow.requestContextSchema ? standardSchemaToJSONSchema(workflow.requestContextSchema) : undefined,
  });
  if (steps.size + 1 > 500) throw new RenderProtocolError('Render allows at most 500 task definitions per service');
  return { hash: digest(stable(schema)), rootName: name(workflow.id, 'root', 'root'), steps };
}
