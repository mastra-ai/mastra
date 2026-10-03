import { createHash } from 'node:crypto';
import { standardSchemaToJSONSchema } from '@mastra/core/schema';
import type { AnyWorkflow, Step, StepFlowEntry } from '@mastra/core/workflows';
import { RenderProtocolError, unsupported } from './errors.js';
import { taskPolicy, type TaskPolicy } from './policy.js';
import { frameworkJson, type Json } from './protocol.js';
import { workflowBindings, type WorkflowBinding } from './bindings.js';

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
  nested: Map<string, WorkflowBinding>;
}

/** Serialize normalized manifest JSON deterministically for caller/worker compatibility hashing. */
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
/** Create a bounded native task name that separates root and step identities. */
function name(workflowId: string, stepId: string, role: 'root' | 'step' = 'step'): string {
  const identity = JSON.stringify([role, workflowId, stepId]);
  const prefix = `${workflowId}-${stepId}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 39);
  return `mastra-${prefix}-${digest(identity).slice(0, 16)}`;
}

/** Validate a committed supported graph and compile native definitions plus a deterministic compatibility hash. */
export function compileManifest(
  workflow: AnyWorkflow,
  buildId: string,
  defaults?: TaskPolicy,
  rootPolicy?: TaskPolicy,
  ancestors: ReadonlySet<AnyWorkflow> = new Set(),
): Manifest {
  if (ancestors.has(workflow)) throw new RenderProtocolError(`Nested workflow cycle at ${workflow.id}`);
  const path = new Set([...ancestors, workflow]);
  if (!workflow.committed) throw new RenderProtocolError(`Commit workflow ${workflow.id} before using Render`);
  const steps = new Map<string, RegisteredStep>();
  const nested = new Map<string, WorkflowBinding>();
  const walk = (entry: StepFlowEntry): Json => {
    switch (entry.type) {
      case 'step': {
        const step = entry.step;
        if (step.component === 'WORKFLOW') {
          const child = workflowBindings.get(step as AnyWorkflow);
          if (!child || child.provider !== workflowBindings.get(workflow)?.provider)
            return unsupported('nested workflows from another provider; create both workflows with the same init()');
          if (steps.has(step.id) || (nested.has(step.id) && nested.get(step.id) !== child))
            throw new RenderProtocolError(`Duplicate step id ${step.id}`);
          nested.set(step.id, child);
          return { type: 'workflow', id: step.id, manifest: child.manifest(path).hash };
        }
        if (step.resumeSchema || step.suspendSchema) unsupported(`suspend/resume schemas on ${step.id}`);
        if (step.scorers) unsupported(`step scorers on ${step.id}`);
        if (step.retries) unsupported(`Mastra step retries on ${step.id}; configure render.retry instead`);
        const existing = steps.get(step.id);
        if ((existing && existing.step !== step) || nested.has(step.id))
          throw new RenderProtocolError(`Duplicate step id ${step.id}`);
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
      case 'loop':
        return { type: entry.type, child: walk(entry.step), loopType: entry.loopType };
      default:
        return unsupported(
          `graph entry ${entry.type}; use explicit steps, mappings, parallel, branch, foreach or loops`,
        );
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
  const definitions = new Set([name(workflow.id, 'root', 'root'), ...[...steps.values()].map(step => step.name)]);
  const countNested = (binding: WorkflowBinding) => {
    const manifest = binding.manifest();
    if (definitions.has(manifest.rootName)) return;
    definitions.add(manifest.rootName);
    for (const step of manifest.steps.values()) definitions.add(step.name);
    for (const child of manifest.nested.values()) countNested(child);
  };
  nested.forEach(countNested);
  if (definitions.size > 500) throw new RenderProtocolError('Render allows at most 500 task definitions per service');
  return { hash: digest(stable(schema)), rootName: name(workflow.id, 'root', 'root'), steps, nested };
}
