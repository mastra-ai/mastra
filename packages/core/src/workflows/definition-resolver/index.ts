/**
 * WorkflowDefinitionResolver - Converts stored workflow definitions to executable Workflows.
 *
 * This is the main entry point for the definition-resolver module.
 * It orchestrates the resolution of declarative workflow definitions
 * into executable Workflow instances that can be run.
 */

import type { Mastra } from '../../mastra';
import type { StorageWorkflowDefinitionType, DefinitionStepFlowEntry, ConditionDef } from '../../storage/types';
import { Workflow } from '../workflow';
import { type Step } from '../step';
import { resolveStep, type StepResolverContext } from './resolve-steps';
import { jsonSchemaToZod } from './json-schema-to-zod';
import { evaluateCondition } from './evaluate-condition';
import type { EvaluationContext } from './evaluate-ref';

// Re-export utilities for external use
export { evaluateRef, evaluateValueOrRef, evaluateInputMapping, type EvaluationContext } from './evaluate-ref';
export { evaluateCondition, type ConditionDef } from './evaluate-condition';
export { jsonSchemaToZod } from './json-schema-to-zod';
export { resolveStep, type StepResolverContext } from './resolve-steps';

/**
 * Resolves stored workflow definitions to executable Workflow instances.
 *
 * @example
 * ```typescript
 * const resolver = new WorkflowDefinitionResolver(mastra);
 * const workflow = resolver.resolve(storedDefinition);
 * const run = workflow.createRun();
 * const result = await run.start({ input: { ... } });
 * ```
 */
export class WorkflowDefinitionResolver implements StepResolverContext {
  #mastra: Mastra;
  #resolutionStack: Set<string> = new Set(); // For cycle detection

  constructor(mastra: Mastra) {
    this.#mastra = mastra;
  }

  /**
   * Gets the Mastra instance (required by StepResolverContext).
   */
  getMastra(): Mastra {
    return this.#mastra;
  }

  /**
   * Resolves a nested workflow definition by ID.
   * Used by workflow steps that reference other stored definitions.
   *
   * Note: We use Promise.resolve() wrapping to avoid TypeScript issues
   * with Workflow's `then` method being interpreted as a thenable.
   */
  resolveNestedWorkflow(workflowId: string): Promise<Workflow | null> {
    // First try to get from Mastra's workflow definitions
    const getDefinition = (this.#mastra as any).getWorkflowDefinitionById;
    if (!getDefinition) {
      return Promise.resolve(null);
    }

    return getDefinition
      .call(this.#mastra, workflowId, { raw: true })
      .then((definition: unknown) => {
        if (definition && typeof definition === 'object' && 'stepGraph' in definition) {
          const workflow = this.resolve(definition as StorageWorkflowDefinitionType);
          // Wrap in Promise.resolve to break the thenable chain
          return Promise.resolve<Workflow | null>(workflow);
        }
        return Promise.resolve<Workflow | null>(null);
      })
      .catch(() => {
        // Not found as definition
        return Promise.resolve<Workflow | null>(null);
      });
  }

  /**
   * Resolves a workflow definition to an executable Workflow.
   *
   * @param definition - The stored workflow definition
   * @returns An executable Workflow instance
   * @throws Error if resolution fails or circular dependency detected
   */
  resolve(definition: StorageWorkflowDefinitionType): Workflow {
    // Check for circular dependencies
    if (this.#resolutionStack.has(definition.id)) {
      const cycle = Array.from(this.#resolutionStack).join(' -> ') + ' -> ' + definition.id;
      throw new Error(`Circular workflow definition dependency detected: ${cycle}`);
    }

    this.#resolutionStack.add(definition.id);

    try {
      // 1. Convert JSON schemas to Zod
      const inputSchema = jsonSchemaToZod(definition.inputSchema);
      const outputSchema = jsonSchemaToZod(definition.outputSchema);
      const stateSchema = definition.stateSchema ? jsonSchemaToZod(definition.stateSchema) : undefined;

      // 2. Resolve all step definitions to executable Steps
      const resolvedSteps: Record<string, Step> = {};
      for (const [stepId, stepDef] of Object.entries(definition.steps)) {
        resolvedSteps[stepId] = resolveStep(this.#mastra, stepId, stepDef, this);
      }

      // 3. Create workflow with resolved configuration
      const workflow = new Workflow({
        id: definition.id,
        description: definition.description,
        inputSchema,
        outputSchema,
        stateSchema,
        retryConfig: definition.retryConfig,
        mastra: this.#mastra,
      });

      // 4. Build step graph from stepGraph entries
      this.#buildStepGraph(workflow, definition.stepGraph, resolvedSteps);

      // 5. Commit and return
      workflow.commit();
      return workflow;
    } finally {
      this.#resolutionStack.delete(definition.id);
    }
  }

  /**
   * Converts the declarative step graph to workflow builder method calls.
   */
  #buildStepGraph(
    workflow: Workflow<any, any, any, any, any, any, any>,
    stepGraph: DefinitionStepFlowEntry[],
    resolvedSteps: Record<string, Step>,
  ): void {
    for (const entry of stepGraph) {
      switch (entry.type) {
        case 'step': {
          const step = resolvedSteps[entry.step.id];
          if (!step) {
            throw new Error(`Step "${entry.step.id}" referenced in stepGraph but not found in steps definition`);
          }
          workflow.then(step);
          break;
        }

        case 'parallel': {
          const parallelSteps = entry.steps.map(s => {
            const step = resolvedSteps[s.step.id];
            if (!step) {
              throw new Error(`Parallel step "${s.step.id}" referenced in stepGraph but not found in steps definition`);
            }
            return step;
          });
          if (parallelSteps.length > 0) {
            workflow.parallel(parallelSteps);
          }
          break;
        }

        case 'conditional': {
          const branches = this.#buildConditionalBranches(entry, resolvedSteps);
          if (branches.length > 0) {
            workflow.branch(branches);
          }
          break;
        }

        case 'loop': {
          const step = resolvedSteps[entry.stepId];
          if (!step) {
            throw new Error(`Loop step "${entry.stepId}" referenced in stepGraph but not found in steps definition`);
          }

          const conditionFn = this.#createConditionFunction(entry.condition);

          if (entry.loopType === 'dowhile') {
            workflow.dowhile(step, conditionFn);
          } else {
            workflow.dountil(step, conditionFn);
          }
          break;
        }

        case 'foreach': {
          const step = resolvedSteps[entry.stepId];
          if (!step) {
            throw new Error(`Foreach step "${entry.stepId}" referenced in stepGraph but not found in steps definition`);
          }
          workflow.foreach(step as any, { concurrency: entry.concurrency || 1 });
          break;
        }

        case 'sleep': {
          workflow.sleep(entry.duration);
          break;
        }

        case 'sleepUntil': {
          // sleepUntil with static timestamp
          if ('$literal' in entry.timestamp) {
            const date = new Date(entry.timestamp.$literal as string | number);
            workflow.sleepUntil(date);
          }
          // Dynamic timestamps would need special handling
          break;
        }

        case 'map': {
          // Map entries are handled by transform steps
          // This is just a passthrough for data transformation
          break;
        }

        default:
          console.warn(`Unknown step graph entry type: ${(entry as any).type}`);
      }
    }
  }

  /**
   * Builds condition branches for branch() method.
   */
  #buildConditionalBranches(
    entry: Extract<DefinitionStepFlowEntry, { type: 'conditional' }>,
    resolvedSteps: Record<string, Step>,
  ): Array<[(...args: any[]) => Promise<boolean>, Step]> {
    const branches: Array<[(...args: any[]) => Promise<boolean>, Step]> = [];

    for (const branch of entry.branches) {
      const step = resolvedSteps[branch.stepId];
      if (!step) {
        throw new Error(`Conditional branch step "${branch.stepId}" not found in steps definition`);
      }

      const conditionFn = this.#createConditionFunction(branch.condition);
      branches.push([conditionFn, step]);
    }

    // Add default branch if specified (always true condition)
    if (entry.default) {
      const defaultStep = resolvedSteps[entry.default];
      if (defaultStep) {
        branches.push([async () => true, defaultStep]);
      }
    }

    return branches;
  }

  /**
   * Creates an async condition function from a ConditionDef.
   */
  #createConditionFunction(conditionDef: ConditionDef): (params: any) => Promise<boolean> {
    return async (params: {
      inputData?: any;
      getInitData?: () => any;
      getStepResult?: (step: any) => any;
      state?: any;
    }) => {
      // Build evaluation context from available params
      const context: EvaluationContext = {
        input: params.getInitData?.() || params.inputData || {},
        steps: {}, // Step results would need to be collected
        state: params.state || {},
      };

      return evaluateCondition(conditionDef, context);
    };
  }
}

export default WorkflowDefinitionResolver;
