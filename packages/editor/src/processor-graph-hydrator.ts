/**
 * Hydrates a StoredProcessorGraph into a ProcessorWorkflow.
 *
 * Resolves each graph step to a PhaseFilteredProcessor via the registered
 * ProcessorProvider, then builds a workflow from the graph structure
 * (sequential, parallel, conditional).
 */
import type {
  Processor,
  ProcessorWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '@mastra/core/processors';
import { ProcessorStepSchema } from '@mastra/core/processors';
import type { ProcessorProvider } from '@mastra/core/processor-provider';
import { PhaseFilteredProcessor } from '@mastra/core/processor-provider';
import type { StoredProcessorGraph, ProcessorGraphEntry, ProcessorGraphStep } from '@mastra/core/storage';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core';

import { evaluateRuleGroup } from './rule-evaluator';

const PASSTHROUGH_STEP_PREFIX = 'passthrough-';

interface HydrationContext {
  providers: Record<string, ProcessorProvider>;
  mastra?: Mastra;
  logger?: IMastraLogger;
}

/**
 * Resolve a single ProcessorGraphStep into a PhaseFilteredProcessor instance.
 */
function resolveStep(step: ProcessorGraphStep, ctx: HydrationContext): Processor | undefined {
  const provider = ctx.providers[step.providerId];
  if (!provider) {
    ctx.logger?.warn(`ProcessorProvider "${step.providerId}" not found for graph step "${step.id}"`);
    return undefined;
  }

  const processor = provider.createProcessor(step.config);

  // Wrap with phase filtering if only a subset of phases are enabled
  const allProviderPhases = provider.availablePhases;
  const enabledSet = new Set(step.enabledPhases);
  const needsFiltering = allProviderPhases.some(p => !enabledSet.has(p));

  if (needsFiltering) {
    const filtered = new PhaseFilteredProcessor(processor, step.enabledPhases);
    // Register Mastra on the filtered wrapper (which delegates to the inner processor)
    if (ctx.mastra) {
      filtered.__registerMastra(ctx.mastra as any);
    }
    return filtered;
  }

  // Register Mastra directly on the processor when no filtering is needed
  if (ctx.mastra && processor.__registerMastra) {
    processor.__registerMastra(ctx.mastra as any);
  }

  return processor;
}

/**
 * Check if a graph is purely sequential (no parallel/conditional entries).
 */
function isSequentialOnly(entries: ProcessorGraphEntry[]): boolean {
  return entries.every(e => e.type === 'step');
}

/**
 * Hydrate a StoredProcessorGraph into a flat array of Processor instances.
 * Only works for simple sequential graphs.
 */
function hydrateSequential(entries: ProcessorGraphEntry[], ctx: HydrationContext): Processor[] {
  const processors: Processor[] = [];
  for (const entry of entries) {
    if (entry.type !== 'step') continue;
    const processor = resolveStep(entry.step, ctx);
    if (processor) {
      processors.push(processor);
    }
  }
  return processors;
}

/**
 * After .parallel() or .branch(), the workflow output is keyed by step ID:
 *   { [stepId]: ProcessorStepOutput, ... }
 *
 * This map function picks the first branch result that has a valid ProcessorStepOutput
 * shape and returns it as a flat object for downstream steps / the processor runner.
 */
async function mergeBranchOutputs({ inputData }: { inputData: Record<string, any> }) {
  // inputData is { [stepId]: { phase, messages, ... }, ... }
  // Find the first branch result with processor-compatible shape.
  // Prefer non-passthrough branches (real processor output) over passthrough fallback.
  const keys = Object.keys(inputData).sort((a, b) => {
    const aPass = a.startsWith(PASSTHROUGH_STEP_PREFIX) ? 1 : 0;
    const bPass = b.startsWith(PASSTHROUGH_STEP_PREFIX) ? 1 : 0;
    return aPass - bPass;
  });
  for (const key of keys) {
    const val = inputData[key];
    if (val && typeof val === 'object' && 'phase' in val) {
      return {
        phase: val.phase,
        messages: val.messages,
        messageList: val.messageList,
        ...(val.systemMessages ? { systemMessages: val.systemMessages } : {}),
        ...(val.part !== undefined ? { part: val.part } : {}),
        ...(val.streamParts ? { streamParts: val.streamParts } : {}),
        ...(val.state ? { state: val.state } : {}),
        ...(val.text !== undefined ? { text: val.text } : {}),
        ...(val.retryCount !== undefined ? { retryCount: val.retryCount } : {}),
      };
    }
  }
  // Fallback: return inputData as-is (shouldn't happen with valid processor graphs)
  return inputData;
}

/**
 * Build a ProcessorWorkflow from graph entries.
 * Handles sequential steps, parallel branches, and conditional branches.
 */
function buildWorkflow(
  entries: ProcessorGraphEntry[],
  workflowId: string,
  ctx: HydrationContext,
): ProcessorWorkflow | undefined {
  // Resolve all steps and convert to workflow steps
  let workflow = createWorkflow({
    id: workflowId,
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
    type: 'processor' as any,
    options: {
      validateInputs: false,
    },
  });

  let hasSteps = false;

  for (const entry of entries) {
    if (entry.type === 'step') {
      const processor = resolveStep(entry.step, ctx);
      if (!processor) continue;
      const step = createStep(processor as Parameters<typeof createStep>[0]);
      workflow = workflow.then(step);
      hasSteps = true;
    } else if (entry.type === 'parallel') {
      // Build parallel branches: each branch is an array of entries
      const branchSteps = entry.branches
        .map((branchEntries, branchIdx) => {
          // Each branch must be a single step (or sub-workflow) for the parallel API
          // For multi-step branches, wrap in a sub-workflow
          if (branchEntries.length === 1 && branchEntries[0]!.type === 'step') {
            const proc = resolveStep(branchEntries[0]!.step, ctx);
            if (!proc) return undefined;
            return createStep(proc as Parameters<typeof createStep>[0]);
          }
          // Multi-step branch: build a sub-workflow
          const subWorkflow = buildWorkflow(branchEntries, `${workflowId}-parallel-branch-${branchIdx}`, ctx);
          return subWorkflow;
        })
        .filter(Boolean);

      if (branchSteps.length > 0) {
        workflow = workflow.parallel(branchSteps);
        // After parallel, outputs are keyed by step ID: { [stepId]: ProcessorStepOutput }
        // Map back to a flat ProcessorStepOutput for downstream steps / processor runner
        workflow = workflow.map(mergeBranchOutputs);
        hasSteps = true;
      }
    } else if (entry.type === 'conditional') {
      // Build conditional branches using .branch()
      // branch() takes Array<[ConditionFunction, Step]> tuples
      const branchTuples: Array<[any, any]> = [];

      for (const [i, condition] of entry.conditions.entries()) {
        // Each condition branch is an array of entries
        let branchStep: any;
        if (condition.steps.length === 1 && condition.steps[0]!.type === 'step') {
          const proc = resolveStep(condition.steps[0]!.step, ctx);
          if (!proc) continue;
          branchStep = createStep(proc as Parameters<typeof createStep>[0]);
        } else {
          branchStep = buildWorkflow(condition.steps, `${workflowId}-cond-branch-${i}`, ctx);
          if (!branchStep) continue;
        }

        if (condition.rules) {
          // Conditional branch with RuleGroup evaluated against the previous step's output
          const rules = condition.rules;
          const conditionFn = async ({ inputData }: { inputData: Record<string, unknown> }) => {
            return evaluateRuleGroup(rules, inputData);
          };
          branchTuples.push([conditionFn, branchStep]);
        } else {
          // Default branch (no rules = always matches, acts as fallback)
          branchTuples.push([async () => true, branchStep]);
        }
      }

      if (branchTuples.length > 0) {
        // Always add a pass-through fallback so the workflow returns input unchanged
        // when no user-defined condition matches (e.g. during inputStep/outputStep phases
        // where conditions only target 'input' or 'outputResult' phase).
        const passthroughStep = createStep({
          id: `${PASSTHROUGH_STEP_PREFIX}${workflowId}`,
          inputSchema: ProcessorStepSchema,
          outputSchema: ProcessorStepSchema,
          execute: async ({ inputData }) => inputData,
        });
        branchTuples.push([async () => true, passthroughStep]);

        workflow = (workflow as any).branch(branchTuples);
        // After branch, outputs are keyed by step ID: { [stepId]: ProcessorStepOutput }
        // Map back to a flat ProcessorStepOutput for downstream steps / processor runner
        workflow = (workflow as any).map(mergeBranchOutputs);
        hasSteps = true;
      }
    }
  }

  if (!hasSteps) return undefined;

  return (workflow as any).commit() as ProcessorWorkflow;
}

/**
 * Hydrate a StoredProcessorGraph into an array of InputProcessorOrWorkflow.
 *
 * For simple sequential graphs, returns individual Processor instances.
 * For complex graphs (with parallel/conditional entries), builds a ProcessorWorkflow.
 */
export function hydrateProcessorGraph(
  graph: StoredProcessorGraph | undefined,
  mode: 'input' | 'output',
  ctx: HydrationContext,
): InputProcessorOrWorkflow[] | OutputProcessorOrWorkflow[] | undefined {
  if (!graph) return undefined;

  // Backward compat: old storage format used string[] of processor IDs.
  // These can't be coerced to the new StoredProcessorGraph format since they
  // reference Mastra.processors by ID, not ProcessorProvider configs.
  if (Array.isArray(graph)) {
    ctx.logger?.warn(
      'Processor graph is in legacy string[] format and cannot be hydrated. Re-save the agent to migrate.',
    );
    return undefined;
  }

  if (!Array.isArray(graph.steps) || graph.steps.length === 0) return undefined;

  // Simple sequential graph: return flat processor array
  if (isSequentialOnly(graph.steps)) {
    const processors = hydrateSequential(graph.steps, ctx);
    if (processors.length === 0) return undefined;

    // Filter by mode: input processors need input methods, output processors need output methods
    if (mode === 'input') {
      const filtered = processors.filter(p => p.processInput || p.processInputStep);
      return filtered.length > 0 ? (filtered as InputProcessorOrWorkflow[]) : undefined;
    } else {
      const filtered = processors.filter(p => p.processOutputStream || p.processOutputResult || p.processOutputStep);
      return filtered.length > 0 ? (filtered as OutputProcessorOrWorkflow[]) : undefined;
    }
  }

  // Complex graph: build a workflow
  const workflowId = `stored-${mode}-processor-graph`;
  const workflow = buildWorkflow(graph.steps, workflowId, ctx);
  if (!workflow) return undefined;

  return [workflow] as InputProcessorOrWorkflow[] | OutputProcessorOrWorkflow[];
}

/**
 * Select the first matching StoredProcessorGraph from a list of conditional variants.
 * Unlike array variants (which accumulate), processor graphs are complete pipelines
 * and the first match wins.
 */
export function selectFirstMatchingGraph(
  variants: Array<{ value: StoredProcessorGraph; rules?: any }>,
  context: Record<string, unknown>,
): StoredProcessorGraph | undefined {
  for (const variant of variants) {
    if (!variant.rules || evaluateRuleGroup(variant.rules, context)) {
      return variant.value;
    }
  }
  return undefined;
}
