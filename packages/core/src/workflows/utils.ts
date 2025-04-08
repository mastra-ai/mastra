import { get } from 'radash';
import { z } from 'zod';
import type { Mastra } from '..';
import type { ToolsInput } from '../agent';
import { Agent } from '../agent';
import type { Metric } from '../eval';
import type { Logger } from '../logger';
import type { Step } from './step';
import type { StepAction, StepResult, VariableReference, WorkflowContext, WorkflowRunResult } from './types';
import { Workflow } from './workflow';

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
  const activePaths = getActivePathsAndStatus(state.value);
  const activePathsAndStatus = activePaths.reduce((acc, curr) => {
    const entry: { status: string; suspendPayload?: any; stepPath: string[] } = {
      status: curr.status,
      stepPath: curr.stepPath,
    };
    if (curr.status === 'suspended') {
      // @ts-ignore
      entry.suspendPayload = state.context.steps[curr.stepId].suspendPayload;
      entry.stepPath = curr.stepPath;
    }
    acc.set(curr.stepId, entry);
    return acc;
  }, new Map<string, { status: string; suspendPayload?: any; stepPath: string[] }>());
  return activePathsAndStatus;
}

export function isWorkflow(
  step: Step<any, any, any, any> | Workflow<any, any, any, any> | Agent<any, any, any>,
): step is Workflow<any, any, any, any> {
  // @ts-ignore
  return step instanceof Workflow;
}

export function isAgent(
  step: Step<any, any, any, any> | Agent<any, any, any> | Workflow<any, any, any, any>,
): step is Agent<any, any, any> {
  // @ts-ignore
  return step instanceof Agent;
}

export function resolveVariables({
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

export function agentToStep<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
>(
  agent: Agent<TAgentId, TTools, TMetrics>,
  { mastra }: { mastra?: Mastra } = {},
): StepAction<TAgentId, z.ZodObject<{ prompt: z.ZodString }>, z.ZodObject<{ text: z.ZodString }>, any> {
  return {
    id: agent.name,
    inputSchema: z.object({
      prompt: z.string(),
      resourceId: z.string().optional(),
      threadId: z.string().optional(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ context, runId, mastra: mastraFromExecute }) => {
      const realMastra = mastraFromExecute ?? mastra;
      if (!realMastra) {
        throw new Error('Mastra instance not found');
      }

      agent.__registerMastra(realMastra);
      agent.__registerPrimitives({
        logger: realMastra.getLogger(),
        telemetry: realMastra.getTelemetry(),
      });

      const result = await agent.generate(context.inputData.prompt, {
        runId,
        resourceId: context.inputData.resourceId,
        threadId: context.inputData.threadId,
      });

      return {
        text: result.text,
      };
    },
  };
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
    workflowId: toCamelCaseWithRandomSuffix(workflow.name),
    execute: async ({ context, suspend, emit, mastra: mastraFromExecute }) => {
      const realMastra = mastraFromExecute ?? mastra;
      if (realMastra) {
        workflow.__registerMastra(realMastra);
        workflow.__registerPrimitives({
          logger: realMastra.getLogger(),
          telemetry: realMastra.getTelemetry(),
        });
      }

      const run = context.isResume ? workflow.createRun({ runId: context.isResume.runId }) : workflow.createRun();
      const unwatch = run.watch(state => {
        emit('state-update', workflow.name, state.results, { ...context, ...{ [workflow.name]: state.results } });
      });

      const awaitedResult =
        context.isResume && context.isResume.stepId.includes('.')
          ? await run.resume({
              stepId: context.isResume.stepId.split('.').slice(1).join('.'),
              context: context.inputData,
            })
          : await run.start({
              triggerData: context.inputData,
            });

      unwatch();
      if (!awaitedResult) {
        throw new Error('Workflow run failed');
      }

      if (awaitedResult.activePaths?.size > 0) {
        const suspendedStep = [...awaitedResult.activePaths.entries()].find(([, { status }]) => {
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
/**
 * Converts a string to camelCase and appends a random three-letter string
 * @param {string} str - The input string to convert
 * @returns {string} - The camelCase string with a random three-letter suffix
 */
function toCamelCaseWithRandomSuffix(str: string) {
  // Handle null or empty strings
  if (!str) return '';

  // Replace various delimiters with spaces
  const normalizedStr = str.replace(/[-_]/g, ' ');

  // Split by spaces and filter out empty strings
  const words = normalizedStr.split(' ').filter(word => word.length > 0);

  // Convert to camelCase
  const camelCase = words
    .map((word, index) => {
      // Remove any non-alphanumeric characters
      word = word.replace(/[^a-zA-Z0-9]/g, '');

      if (index === 0) {
        // First word should be lowercase
        return word.toLowerCase();
      }
      // Capitalize first letter of other words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');

  // Generate random three-letter string
  const randomString = generateRandomLetters(3);

  return camelCase + randomString;
}

/**
 * Generates a random string of letters with specified length
 * @param {number} length - The length of the random string
 * @returns {string} - Random string of specified length
 */
function generateRandomLetters(length: number) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

export function isConditionalKey(key: string) {
  /**
   * __step1_else
   * __step1_if
   * ____step1_if_if
   * ____step1_if_else
   * etc...
   */
  return key.startsWith('__') && (key.includes('_if') || key.includes('_else'));
}
