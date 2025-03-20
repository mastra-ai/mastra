import type { z } from 'zod';
import type { Logger } from '../logger';
import type { Step } from './step';
import type { StepAction, StepDef, StepResult, VariableReference, WorkflowContext, WorkflowRunResult } from './types';
import type { Workflow } from './workflow';
import { get } from 'radash';
import type { WorkflowResultReturn } from './workflow-instance';
import type { Mastra } from '..';

export function isErrorEvent(stateEvent: any): stateEvent is {
  type: `xstate.error.actor.${string}`;
  error: Error;
} {
  return stateEvent.type.startsWith('xstate.error.actor.');
}

export function isTransitionEvent(stateEvent: any): stateEvent is {
  type: `xstate.done.actor.${string}`;
  output?: unknown;
} {
  return stateEvent.type.startsWith('xstate.done.actor.');
}

export function isVariableReference(value: any): value is VariableReference<any, any> {
  return typeof value === 'object' && 'step' in value && 'path' in value;
}

export function getStepResult(result?: StepResult<any>) {
  if (result?.status === 'success') return result.output;
  return undefined;
}

export function getSuspendedPaths({
  value,
  path,
  suspendedPaths,
}: {
  value: string | Record<string, string>;
  path: string;
  suspendedPaths: Set<string>;
}) {
  if (typeof value === 'string') {
    if (value === 'suspended') {
      suspendedPaths.add(path);
    }
  } else {
    Object.keys(value).forEach(key =>
      getSuspendedPaths({ value: value[key]!, path: path ? `${path}.${key}` : key, suspendedPaths }),
    );
  }
}

export function isFinalState(status: string): boolean {
  return ['completed', 'failed'].includes(status);
}

export function isLimboState(status: string): boolean {
  return status === 'limbo';
}

export function recursivelyCheckForFinalState({
  value,
  suspendedPaths,
  path,
}: {
  value: string | Record<string, string>;
  suspendedPaths: Set<string>;
  path: string;
}): boolean {
  if (typeof value === 'string') {
    // if the value is a final state or limbo state or it has previously reached a suspended state, return true
    return isFinalState(value) || isLimboState(value) || suspendedPaths.has(path);
  }
  return Object.keys(value).every(key =>
    recursivelyCheckForFinalState({ value: value[key]!, suspendedPaths, path: path ? `${path}.${key}` : key }),
  );
}

export function getActivePathsAndStatus(value: Record<string, any>): Array<{
  stepPath: string[];
  stepId: string;
  status: string;
}> {
  const paths: Array<{
    stepPath: string[];
    stepId: string;
    status: string;
  }> = [];

  const traverse = (current: Record<string, any>, path: string[] = []) => {
    for (const [key, value] of Object.entries(current)) {
      const currentPath = [...path, key];

      if (typeof value === 'string') {
        // Found a leaf state
        paths.push({
          stepPath: currentPath,
          stepId: key,
          status: value,
        });
      } else if (typeof value === 'object' && value !== null) {
        // Continue traversing
        traverse(value, currentPath);
      }
    }
  };

  traverse(value);
  return paths;
}

export function mergeChildValue(
  startStepId: string,
  parent: Record<string, any>,
  child: Record<string, any>,
): Record<string, any> {
  const traverse = (current: Record<string, any>) => {
    const obj: Record<string, any> = {};
    for (const [key, value] of Object.entries(current)) {
      if (key === startStepId) {
        // Found child state
        obj[key] = { ...child };
      } else if (typeof value === 'string') {
        // Found leaf state
        obj[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        // Continue traversing
        obj[key] = traverse(value);
      }
    }

    return obj;
  };

  return traverse(parent);
}

export const updateStepInHierarchy = (value: Record<string, any>, targetStepId: string): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const key of Object.keys(value)) {
    const currentValue = value[key];

    if (key === targetStepId) {
      // Found our target step, set it to pending
      result[key] = 'pending';
    } else if (typeof currentValue === 'object' && currentValue !== null) {
      // Recurse into nested states
      result[key] = updateStepInHierarchy(currentValue, targetStepId);
    } else {
      // Keep other states as is
      result[key] = currentValue;
    }
  }

  return result;
};

export function getResultActivePaths(state: {
  value: Record<string, string>;
  context: { steps: Record<string, any> };
}) {
  return getActivePathsAndStatus(state.value).reduce((acc, curr) => {
    const entry: { status: string; suspendPayload?: any } = { status: curr.status };
    if (curr.status === 'suspended') {
      // @ts-ignore
      entry.suspendPayload = state.context.steps[curr.stepId].suspendPayload;
    }
    acc.set(curr.stepId, entry);
    return acc;
  }, new Map<string, { status: string; suspendPayload?: any }>());
}

export function isWorkflow(
  step: Step<any, any, any, any> | Workflow<any, any, any, any>,
): step is Workflow<any, any, any, any> {
  // @ts-ignore
  return !!step?.name;
}

export function resolveVariables<TSteps extends Step<any, any, any>[]>({
  runId,
  logger,
  variables,
  context,
}: {
  runId: string;
  logger: Logger;
  variables: Record<string, VariableReference<any, any>>;
  context: WorkflowContext;
}): Record<string, any> {
  const resolvedData: Record<string, any> = {};

  for (const [key, variable] of Object.entries(variables)) {
    // Check if variable comes from trigger data or a previous step's result
    const sourceData =
      variable.step === 'trigger'
        ? context.triggerData
        : getStepResult(context.steps[variable.step.id ?? variable.step.name]);

    logger.debug(
      `Got source data for ${key} variable from ${variable.step === 'trigger' ? 'trigger' : (variable.step.id ?? variable.step.name)}`,
      {
        sourceData,
        path: variable.path,
        runId: runId,
      },
    );

    if (!sourceData && variable.step !== 'trigger') {
      resolvedData[key] = undefined;
      continue;
    }

    // If path is empty or '.', return the entire source data
    const value = variable.path === '' || variable.path === '.' ? sourceData : get(sourceData, variable.path);

    logger.debug(`Resolved variable ${key}`, {
      value,
      runId: runId,
    });

    resolvedData[key] = value;
  }

  return resolvedData;
}

export function workflowToStep<
  TSteps extends Step<any, any, any, any>[],
  TStepId extends string = any,
  TTriggerSchema extends z.ZodObject<any> = any,
  TResultSchema extends z.ZodObject<any> = any,
>(
  workflow: Workflow<TSteps, TStepId, TTriggerSchema, TResultSchema>,
  { mastra }: { mastra?: Mastra },
): StepAction<TStepId, TTriggerSchema, z.ZodType<WorkflowRunResult<TTriggerSchema, TSteps, TResultSchema>>, any> {
  workflow.setNested(true);

  return {
    id: workflow.name,
    workflow,
    execute: async ({ context, suspend, emit, runId, mastra }) => {
      if (mastra) {
        workflow.__registerMastra(mastra);
        workflow.__registerPrimitives({
          logger: mastra.getLogger(),
          telemetry: mastra.getTelemetry(),
        });
      }
      const run = context.isResume
        ? workflow.createRun({ runId: `${workflow.name}.${context.isResume.runId}` })
        : // FIXME: if we run multiple copies at the same time of the same workflow this won't work
          workflow.createRun({ runId: `${workflow.name}.${runId}` });
      const unwatch = run.watch(state => {
        emit('state-update', workflow.name, state.value, { ...context, ...{ [workflow.name]: state.context } });
      });

      const awaitedResult =
        context.isResume && context.isResume.stepId.includes('.')
          ? await run.resume({
              stepId: context.isResume.stepId.split('.').slice(1).join('.'),
              context: context.inputData,
            })
          : await run.start();

      unwatch();
      if (!awaitedResult) {
        throw new Error('Workflow run failed');
      }

      if (awaitedResult.activePaths?.size > 0) {
        const suspendedStep = [...awaitedResult.activePaths.entries()].find(([stepId, { status }]) => {
          return status === 'suspended';
        });

        if (suspendedStep) {
          await suspend(suspendedStep[1].suspendPayload, { ...awaitedResult, runId: run.runId });
          // await suspend({
          //   ...suspendedStep[1].suspendPayload,
          //   __meta: { nestedRunId: run.runId, nestedRunPaths: awaitedResult.activePaths },
          // });
        }
      }

      return { ...awaitedResult, runId: run.runId };
    },
  };
}
