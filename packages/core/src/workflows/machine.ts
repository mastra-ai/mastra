import EventEmitter from 'node:events';
import type { Span } from '@opentelemetry/api';
import { get } from 'radash';
import sift from 'sift';
import type { MachineContext, Snapshot } from 'xstate';
import { assign, createActor, fromPromise, setup } from 'xstate';
import type { z } from 'zod';

import type { MastraUnion } from '../action';
import type { Logger } from '../logger';

import type { Mastra } from '../mastra';
import { createMastraProxy } from '../utils';
import type { Step } from './step';
import type {
  DependencyCheckOutput,
  ResolverFunctionInput,
  ResolverFunctionOutput,
  RetryConfig,
  StepAction,
  StepCondition,
  StepDef,
  StepGraph,
  StepNode,
  StepResolverOutput,
  StepVariableType,
  WorkflowActionParams,
  WorkflowActions,
  WorkflowActors,
  WorkflowContext,
  WorkflowEvent,
  WorkflowRunResult,
  WorkflowState,
} from './types';
import { WhenConditionReturnValue } from './types';
import {
  getResultActivePaths,
  getStepResult,
  getSuspendedPaths,
  isErrorEvent,
  isTransitionEvent,
  recursivelyCheckForFinalState,
} from './utils';
import type { WorkflowInstance } from './workflow-instance';

export class Machine<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodObject<any> = any,
> extends EventEmitter {
  logger: Logger;
  #mastra?: Mastra;
  #workflowInstance: WorkflowInstance;
  #executionSpan?: Span | undefined;

  #stepGraph: StepGraph;
  #machine!: ReturnType<typeof this.initializeMachine>;
  #runId: string;
  #startStepId: string;
  name: string;

  #actor: ReturnType<typeof createActor<ReturnType<typeof this.initializeMachine>>> | null = null;
  #steps: Record<string, StepAction<any, any, any, any>> = {};
  #retryConfig?: RetryConfig;

  constructor({
    logger,
    mastra,
    workflowInstance,
    executionSpan,
    name,
    runId,
    steps,
    stepGraph,
    retryConfig,
    startStepId,
  }: {
    logger: Logger;
    mastra?: Mastra;
    workflowInstance: WorkflowInstance;
    executionSpan?: Span;
    name: string;
    runId: string;
    steps: Record<string, TSteps[0]>;
    stepGraph: StepGraph;
    retryConfig?: RetryConfig;
    startStepId: string;
  }) {
    super();

    this.#mastra = mastra;
    this.#workflowInstance = workflowInstance;
    this.#executionSpan = executionSpan;
    this.logger = logger;

    this.#runId = runId;
    this.#startStepId = startStepId;
    this.name = name;

    this.#stepGraph = stepGraph;
    this.#steps = steps;
    this.#retryConfig = retryConfig;
    this.initializeMachine();
  }

  get startStepId() {
    return this.#startStepId;
  }

  async execute({
    stepId,
    input,
    snapshot,
  }: {
    stepId?: string;
    input?: any;
    snapshot?: Snapshot<any>;
  } = {}): Promise<Pick<WorkflowRunResult<TTriggerSchema, TSteps>, 'results' | 'activePaths'>> {
    if (snapshot) {
      // First, let's log the incoming snapshot for debugging
      this.logger.debug(`Workflow snapshot received`, { runId: this.#runId, snapshot });
    }

    const origSteps = input.steps;
    const isResumedInitialStep = this.#stepGraph?.initial[0]?.step?.id === stepId;

    if (isResumedInitialStep) {
      // we should not supply a snapshot if we are resuming the first step of a stepGraph, as that will halt execution
      snapshot = undefined;
      input.steps = {};
    }

    this.logger.debug(`Machine input prepared`, { runId: this.#runId, input });

    const actorSnapshot = snapshot
      ? {
          ...snapshot,
          context: input,
        }
      : undefined;

    this.logger.debug(`Creating actor with configuration`, {
      input,
      actorSnapshot,
      runId: this.#runId,
      machineStates: this.#machine.config.states,
    });

    this.#actor = createActor(this.#machine, {
      inspect: (inspectionEvent: any) => {
        this.logger.debug('XState inspection event', {
          type: inspectionEvent.type,
          event: inspectionEvent.event,
          runId: this.#runId,
        });
      },
      input,
      snapshot: actorSnapshot,
    });

    this.#actor.start();

    if (stepId) {
      this.#actor.send({ type: 'RESET_TO_PENDING', stepId });
    }

    this.logger.debug('Actor started', { runId: this.#runId });

    return new Promise((resolve, reject) => {
      if (!this.#actor) {
        this.logger.error('Actor not initialized', { runId: this.#runId });
        const e = new Error('Actor not initialized');
        this.#executionSpan?.recordException(e);
        this.#executionSpan?.end();
        reject(e);
        return;
      }

      const suspendedPaths: Set<string> = new Set();
      this.#actor.subscribe(async state => {
        this.emit('state-update', this.#startStepId, state.value, state.context);

        getSuspendedPaths({
          value: state.value as Record<string, string>,
          path: '',
          suspendedPaths,
        });

        const allStatesValue = state.value as Record<string, string>;

        const allStatesComplete = recursivelyCheckForFinalState({
          value: allStatesValue,
          suspendedPaths,
          path: '',
        });

        this.logger.debug('State completion check', {
          allStatesComplete,
          suspendedPaths: Array.from(suspendedPaths),
          runId: this.#runId,
        });

        // Check if all parallel states are in a final state
        if (!allStatesComplete) {
          this.logger.debug('Not all states complete', {
            allStatesComplete,
            suspendedPaths: Array.from(suspendedPaths),
            runId: this.#runId,
          });
          return;
        }

        try {
          // Then cleanup and resolve
          this.logger.debug('All states complete', { runId: this.#runId });
          await this.#workflowInstance.persistWorkflowSnapshot();
          this.#cleanup();
          this.#executionSpan?.end();
          resolve({
            results: isResumedInitialStep ? { ...origSteps, ...state.context.steps } : state.context.steps,
            activePaths: getResultActivePaths(
              state as unknown as { value: Record<string, string>; context: { steps: Record<string, any> } },
            ),
          });
        } catch (error) {
          // If snapshot persistence fails, we should still resolve
          // but maybe log the error
          this.logger.debug('Failed to persist final snapshot', { error });

          this.#cleanup();
          this.#executionSpan?.end();
          resolve({
            results: isResumedInitialStep ? { ...origSteps, ...state.context.steps } : state.context.steps,
            activePaths: getResultActivePaths(
              state as unknown as { value: Record<string, string>; context: { steps: Record<string, any> } },
            ),
          });
        }
      });
    });
  }

  #cleanup() {
    if (this.#actor) {
      this.#actor.stop();
      this.#actor = null;
    }

    this.removeAllListeners();
  }

  #makeDelayMap() {
    const delayMap: Record<string, number> = {};

    Object.keys(this.#steps).forEach(stepId => {
      delayMap[stepId] = this.#steps[stepId]?.retryConfig?.delay || this.#retryConfig?.delay || 1000;
    });

    return delayMap;
  }

  #getDefaultActions() {
    return {
      updateStepResult: assign({
        steps: ({ context, event }: { context: WorkflowContext; event: any }) => {
          if (!isTransitionEvent(event)) return context.steps;

          const { stepId, result } = event.output as ResolverFunctionOutput;

          return {
            ...context.steps,
            [stepId]: {
              status: 'success' as const,
              output: result,
            },
          };
        },
      }),
      setStepError: assign({
        steps: ({ context, event }: { context: WorkflowContext; event: any }, params: WorkflowActionParams) => {
          if (!isErrorEvent(event)) return context.steps;

          const { stepId } = params;

          if (!stepId) return context.steps;

          return {
            ...context.steps,
            [stepId]: {
              status: 'failed' as const,
              error: event.error.message,
            },
          };
        },
      }),
      notifyStepCompletion: async (_: any, params: WorkflowActionParams) => {
        const { stepId } = params;
        this.logger.debug(`Step ${stepId} completed`);
      },
      snapshotStep: assign({
        _snapshot: ({}, params: WorkflowActionParams) => {
          const { stepId } = params;
          // This will run after the state update
          return { stepId };
        },
      }),
      persistSnapshot: async ({ context }: { context: MachineContext }) => {
        if (context._snapshot) {
          await this.#workflowInstance.persistWorkflowSnapshot();
        }
        return;
      },
      decrementAttemptCount: assign({
        attempts: ({ context, event }: { context: WorkflowContext; event: any }, params: WorkflowActionParams) => {
          if (!isTransitionEvent(event)) return context.attempts;

          const { stepId } = params;
          const attemptCount = context.attempts[stepId];

          if (attemptCount === undefined) return context.attempts;

          return { ...context.attempts, [stepId]: attemptCount - 1 };
        },
      }),
    };
  }

  #getDefaultActors() {
    return {
      resolverFunction: fromPromise(async ({ input }: { input: ResolverFunctionInput }) => {
        const { stepNode, context } = input;
        const attemptCount = context.attempts[stepNode.step.id];

        const resolvedData = this.#resolveVariables({
          stepConfig: stepNode.config,
          context,
          stepId: stepNode.step.id,
        });

        this.logger.debug(`Resolved variables for ${stepNode.step.id}`, {
          resolvedData,
          runId: this.#runId,
        });

        const logger = this.logger;
        let mastraProxy = undefined;

        if (this.#mastra) {
          mastraProxy = createMastraProxy({ mastra: this.#mastra, logger });
        }

        let result = undefined;

        try {
          result = await stepNode.config.handler({
            context: resolvedData,
            emit: (event: string, ...args: any[]) => {
              // console.log(this.#workflowInstance.name, 'emitting', event, ...args);
              this.emit(event, ...args);
            },
            suspend: async (payload?: any) => {
              await this.#workflowInstance.suspend(stepNode.step.id, this);
              if (this.#actor) {
                // Update context with current result
                context.steps[stepNode.step.id] = {
                  status: 'suspended',
                  suspendPayload: payload,
                };
                this.logger.debug(`Sending SUSPENDED event for step ${stepNode.step.id}`);
                this.#actor?.send({ type: 'SUSPENDED', suspendPayload: payload, stepId: stepNode.step.id });
              } else {
                this.logger.debug(`Actor not available for step ${stepNode.step.id}`);
              }
            },
            runId: this.#runId,
            mastra: mastraProxy as MastraUnion | undefined,
          });
        } catch (error) {
          this.logger.debug(`Step ${stepNode.step.id} failed`, {
            stepId: stepNode.step.id,
            error,
            runId: this.#runId,
          });

          this.logger.debug(`Attempt count for step ${stepNode.step.id}`, {
            attemptCount,
            attempts: context.attempts,
            runId: this.#runId,
            stepId: stepNode.step.id,
          });

          if (!attemptCount || attemptCount < 0) {
            return {
              type: 'STEP_FAILED' as const,
              error: error instanceof Error ? error.message : `Step:${stepNode.step.id} failed with error: ${error}`,
              stepId: stepNode.step.id,
            };
          }

          return { type: 'STEP_WAITING' as const, stepId: stepNode.step.id };
        }

        this.logger.debug(`Step ${stepNode.step.id} result`, {
          stepId: stepNode.step.id,
          result,
          runId: this.#runId,
        });

        return {
          type: 'STEP_SUCCESS' as const,
          result,
          stepId: stepNode.step.id,
        };
      }),
      conditionCheck: fromPromise(async ({ input }: { input: { context: WorkflowContext; stepNode: StepNode } }) => {
        const { context, stepNode } = input;
        const stepConfig = stepNode.config;

        this.logger.debug(`Checking conditions for step ${stepNode.step.id}`, {
          stepId: stepNode.step.id,
          runId: this.#runId,
        });

        if (!stepConfig?.when) {
          return { type: 'CONDITIONS_MET' as const };
        }

        this.logger.debug(`Checking conditions for step ${stepNode.step.id}`, {
          stepId: stepNode.step.id,
          runId: this.#runId,
        });

        if (typeof stepConfig?.when === 'function') {
          let conditionMet = await stepConfig.when({
            context: {
              ...context,
              getStepResult: ((stepId: string | Step<any, any, any, any>) => {
                const resolvedStepId = typeof stepId === 'string' ? stepId : stepId.id;

                if (resolvedStepId === 'trigger') {
                  return context.triggerData;
                }
                const result = context.steps[resolvedStepId];
                if (result && result.status === 'success') {
                  return result.output;
                }
                return undefined;
              }) satisfies WorkflowContext<TTriggerSchema>['getStepResult'],
            },
            mastra: this.#mastra,
          });

          if (conditionMet === WhenConditionReturnValue.ABORT) {
            conditionMet = false;
          } else if (conditionMet === WhenConditionReturnValue.CONTINUE_FAILED) {
            // TODO: send another kind of event instead
            return { type: 'CONDITIONS_SKIP_TO_COMPLETED' as const };
          } else if (conditionMet === WhenConditionReturnValue.LIMBO) {
            return { type: 'CONDITIONS_LIMBO' as const };
          } else if (conditionMet) {
            this.logger.debug(`Condition met for step ${stepNode.step.id}`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
            return { type: 'CONDITIONS_MET' as const };
          }
          return this.#workflowInstance.hasSubscribers(stepNode.step.id)
            ? { type: 'CONDITIONS_SKIPPED' as const }
            : { type: 'CONDITIONS_LIMBO' as const };
        } else {
          const conditionMet = this.#evaluateCondition(stepConfig.when, context);
          if (!conditionMet) {
            return {
              type: 'CONDITION_FAILED' as const,
              error: `Step:${stepNode.step.id} condition check failed`,
            };
          }
        }
        return { type: 'CONDITIONS_MET' as const };
      }),
      spawnSubscriberFunction: fromPromise(
        async ({
          input,
        }: {
          input: {
            parentStepId: string;
            context: WorkflowContext;
          };
        }) => {
          const { parentStepId, context } = input;
          const result = await this.#workflowInstance.runMachine(parentStepId, context);
          return Promise.resolve({
            steps: result.reduce((acc, r) => {
              return { ...acc, ...r?.results };
            }, {}),
          });
        },
      ),
    };
  }

  #resolveVariables<
    TStepId extends TSteps[number]['id'],
    TSchemaIn extends z.ZodSchema,
    TSchemaOut extends z.ZodSchema,
  >({
    stepConfig,
    context,
    stepId,
  }: {
    stepConfig: StepDef<TStepId, TSteps, TSchemaIn, TSchemaOut>[TStepId];
    context: WorkflowContext;
    stepId: TStepId;
  }): Record<string, any> {
    this.logger.debug(`Resolving variables for step ${stepId}`, {
      stepId,
      runId: this.#runId,
    });

    const resolvedData: Record<string, any> = {
      ...context,
      getStepResult: ((stepId: string | Step<any, any, any, any>) => {
        const resolvedStepId = typeof stepId === 'string' ? stepId : stepId.id;

        if (resolvedStepId === 'trigger') {
          return context.triggerData;
        }
        const result = context.steps[resolvedStepId];
        if (result && result.status === 'success') {
          return result.output;
        }
        return undefined;
      }) satisfies WorkflowContext<TTriggerSchema>['getStepResult'],
    };

    for (const [key, variable] of Object.entries(stepConfig.data)) {
      // Check if variable comes from trigger data or a previous step's result
      const sourceData =
        variable.step === 'trigger' ? context.triggerData : getStepResult(context.steps[variable.step.id]);

      this.logger.debug(
        `Got source data for ${key} variable from ${variable.step === 'trigger' ? 'trigger' : variable.step.id}`,
        {
          sourceData,
          path: variable.path,
          runId: this.#runId,
        },
      );

      if (!sourceData && variable.step !== 'trigger') {
        resolvedData[key] = undefined;
        continue;
      }

      // If path is empty or '.', return the entire source data
      const value = variable.path === '' || variable.path === '.' ? sourceData : get(sourceData, variable.path);

      this.logger.debug(`Resolved variable ${key}`, {
        value,
        runId: this.#runId,
      });

      resolvedData[key] = value;
    }

    return resolvedData;
  }

  private initializeMachine() {
    const machine = setup({
      types: {} as {
        context: Omit<WorkflowContext, 'getStepResult'>;
        input: Omit<WorkflowContext, 'getStepResult'>;
        events: WorkflowEvent;
        actions: WorkflowActions;
        actors: WorkflowActors;
      },
      delays: this.#makeDelayMap(),
      actions: this.#getDefaultActions() as any,
      actors: this.#getDefaultActors(),
    }).createMachine({
      id: this.name,
      type: 'parallel',
      context: ({ input }) => ({
        ...input,
      }),
      states: this.#buildStateHierarchy(this.#stepGraph) as any,
    });

    this.#machine = machine;
    return machine;
  }

  #buildStateHierarchy(stepGraph: StepGraph): WorkflowState {
    const states: Record<string, any> = {};

    stepGraph.initial.forEach(stepNode => {
      const nextSteps = [...(stepGraph[stepNode.step.id] || [])];
      // TODO: For identical steps, use index to create unique key
      states[stepNode.step.id] = {
        ...this.#buildBaseState(stepNode, nextSteps),
      };
    });

    return states;
  }

  #buildBaseState(stepNode: StepNode, nextSteps: StepNode[] = []): any {
    // NOTE: THIS CLEARS THE STEPGRAPH :: no concequences for now
    const nextStep = nextSteps.shift();

    return {
      initial: 'pending',
      on: {
        RESET_TO_PENDING: {
          target: '.pending', // Note the dot to target child state
        },
      },
      states: {
        pending: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} pending`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished pending`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          invoke: {
            src: 'conditionCheck',
            input: ({ context }: { context: WorkflowContext }) => {
              return {
                context,
                stepNode,
              };
            },
            onDone: [
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'SUSPENDED';
                },
                target: 'suspended',
                actions: [
                  assign({
                    steps: ({ context, event }) => {
                      if (event.output.type !== 'SUSPENDED') return context.steps;
                      return {
                        ...context.steps,
                        [stepNode.step.id]: {
                          status: 'suspended',
                          ...(context.steps?.[stepNode.step.id] || {}),
                        },
                      };
                    },
                    attempts: ({ context, event }) => {
                      if (event.output.type !== 'SUSPENDED') return context.attempts;
                      // if the step is suspended, reset the attempt count
                      return { ...context.attempts, [stepNode.step.id]: stepNode.step.retryConfig?.attempts || 0 };
                    },
                  }),
                ],
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'WAITING';
                },
                target: 'waiting',
                actions: [
                  { type: 'decrementAttemptCount', params: { stepId: stepNode.step.id } },
                  assign({
                    steps: ({ context, event }) => {
                      if (event.output.type !== 'WAITING') return context.steps;
                      return {
                        ...context.steps,
                        [stepNode.step.id]: {
                          status: 'waiting',
                        },
                      };
                    },
                  }),
                ],
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITIONS_MET';
                },
                target: 'executing',
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITIONS_SKIP_TO_COMPLETED';
                },
                target: 'completed',
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITIONS_SKIPPED';
                },
                actions: assign({
                  steps: ({ context }) => {
                    const newStep = {
                      ...context.steps,
                      [stepNode.step.id]: {
                        status: 'skipped',
                      },
                    };

                    this.logger.debug(`Step ${stepNode.step.id} skipped`, {
                      stepId: stepNode.step.id,
                      runId: this.#runId,
                    });

                    return newStep;
                  },
                }),

                target: 'runningSubscribers',
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITIONS_LIMBO';
                },
                target: 'limbo',
                actions: assign({
                  steps: ({ context }) => {
                    const newStep = {
                      ...context.steps,
                      [stepNode.step.id]: {
                        status: 'skipped',
                      },
                    };

                    this.logger.debug(`Step ${stepNode.step.id} skipped`, {
                      stepId: stepNode.step.id,
                      runId: this.#runId,
                    });

                    return newStep;
                  },
                }),
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITION_FAILED';
                },
                target: 'failed',
                actions: assign({
                  steps: ({ context, event }) => {
                    if (event.output.type !== 'CONDITION_FAILED') return context.steps;

                    this.logger.debug(`Workflow condition check failed`, {
                      error: event.output.error,
                      stepId: stepNode.step.id,
                    });

                    return {
                      ...context.steps,
                      [stepNode.step.id]: {
                        status: 'failed',
                        error: event.output.error,
                      },
                    };
                  },
                }),
              },
            ],
          },
        },
        waiting: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} waiting`, {
              stepId: stepNode.step.id,
              timestamp: new Date().toISOString(),
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished waiting`, {
              stepId: stepNode.step.id,
              timestamp: new Date().toISOString(),
              runId: this.#runId,
            });
          },
          after: {
            [stepNode.step.id]: {
              target: 'pending',
            },
          },
        },
        limbo: {
          // no target, will stay in limbo indefinitely
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} limbo`, {
              stepId: stepNode.step.id,
              timestamp: new Date().toISOString(),
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished limbo`, {
              stepId: stepNode.step.id,
              timestamp: new Date().toISOString(),
              runId: this.#runId,
            });
          },
        },
        suspended: {
          type: 'final',
          entry: [
            () => {
              this.logger.debug(`Step ${stepNode.step.id} suspended`, {
                stepId: stepNode.step.id,
                runId: this.#runId,
              });
            },
            assign({
              steps: ({ context, event }: { context: WorkflowContext; event: WorkflowEvent }) => {
                return {
                  ...context.steps,
                  [stepNode.step.id]: {
                    ...(context?.steps?.[stepNode.step.id] || {}),
                    status: 'suspended',
                    suspendPayload: event.type === 'SUSPENDED' ? event.suspendPayload : undefined,
                  },
                };
              },
            }),
          ],
        },
        executing: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} executing`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          on: {
            SUSPENDED: {
              target: 'suspended',
              actions: [
                assign({
                  steps: ({ context, event }: { context: WorkflowContext; event: WorkflowEvent }) => {
                    return {
                      ...context.steps,
                      [stepNode.step.id]: {
                        status: 'suspended',
                        suspendPayload: event.type === 'SUSPENDED' ? event.suspendPayload : undefined,
                      },
                    };
                  },
                }),
              ],
            },
          },
          invoke: {
            src: 'resolverFunction',
            input: ({ context }: { context: WorkflowContext }) => ({
              context,
              stepNode,
            }),
            onDone: [
              {
                guard: ({ event }: { event: { output: StepResolverOutput } }) => {
                  return event.output.type === 'STEP_FAILED';
                },
                target: 'failed',
                actions: assign({
                  steps: ({ context, event }) => {
                    if (event.output.type !== 'STEP_FAILED') return context.steps;

                    const newStep = {
                      ...context.steps,
                      [stepNode.step.id]: {
                        status: 'failed',
                        error: event.output.error,
                      },
                    };

                    this.logger.debug(`Step ${stepNode.step.id} failed`, {
                      error: event.output.error,
                      stepId: stepNode.step.id,
                    });

                    return newStep;
                  },
                }),
              },
              {
                guard: ({ event }: { event: { output: StepResolverOutput } }) => {
                  return event.output.type === 'STEP_SUCCESS';
                },
                actions: [
                  ({ event }: { event: { output: StepResolverOutput } }) => {
                    this.logger.debug(`Step ${stepNode.step.id} finished executing`, {
                      stepId: stepNode.step.id,
                      output: event.output,
                      runId: this.#runId,
                    });
                  },
                  { type: 'updateStepResult', params: { stepId: stepNode.step.id } },
                  { type: 'spawnSubscribers', params: { stepId: stepNode.step.id } },
                ],
                target: 'runningSubscribers',
              },
              {
                guard: ({ event }: { event: { output: StepResolverOutput } }) => {
                  return event.output.type === 'STEP_WAITING';
                },
                target: 'waiting',
                actions: [
                  { type: 'decrementAttemptCount', params: { stepId: stepNode.step.id } },
                  assign({
                    steps: ({ context, event }) => {
                      if (event.output.type !== 'STEP_WAITING') return context.steps;
                      return {
                        ...context.steps,
                        [stepNode.step.id]: {
                          status: 'waiting',
                        },
                      };
                    },
                  }),
                ],
              },
            ],
            onError: {
              target: 'failed',
              actions: [{ type: 'setStepError', params: { stepId: stepNode.step.id } }],
            },
          },
        },
        runningSubscribers: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} running subscribers`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished running subscribers`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          invoke: {
            src: 'spawnSubscriberFunction',
            input: ({ context }: { context: WorkflowContext }) => ({
              parentStepId: stepNode.step.id,
              context,
            }),
            onDone: {
              target: nextStep ? nextStep.step.id : 'completed',
              actions: [
                assign({
                  steps: ({ context, event }: { context: WorkflowContext; event: any }) => ({
                    ...context.steps,
                    ...event.output.steps,
                  }),
                }),
                () => this.logger.debug(`Subscriber execution completed`, { stepId: stepNode.step.id }),
              ],
            },
            onError: {
              target: nextStep ? nextStep.step.id : 'completed',
              actions: ({ event }: { context: WorkflowContext; event: any }) => {
                this.logger.debug(`Subscriber execution failed`, {
                  error: event.error,
                  stepId: stepNode.step.id,
                });
              },
            },
          },
        },
        completed: {
          type: 'final',
          entry: [
            { type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } },
            { type: 'snapshotStep', params: { stepId: stepNode.step.id } },
            { type: 'persistSnapshot' },
          ],
        },
        failed: {
          type: 'final',
          entry: [
            { type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } },
            { type: 'snapshotStep', params: { stepId: stepNode.step.id } },
            { type: 'persistSnapshot' },
          ],
        },
        // build chain of next steps recursively
        ...(nextStep ? { [nextStep.step.id]: { ...this.#buildBaseState(nextStep, nextSteps) } } : {}),
      },
    };
  }

  #evaluateCondition<TStep extends StepVariableType<any, any, any, any>, TTriggerSchema extends z.ZodObject<any>>(
    condition: StepCondition<TStep, TTriggerSchema>,
    context: WorkflowContext,
  ): boolean {
    let andBranchResult = true;
    let baseResult = true;
    let orBranchResult = true;

    // Base condition simplified format
    const simpleCondition = Object.entries(condition).find(([key]) => key.includes('.'));
    if (simpleCondition) {
      const [key, queryValue] = simpleCondition;
      const [stepId, ...pathParts] = key.split('.');
      const path = pathParts.join('.');

      const sourceData = stepId === 'trigger' ? context.triggerData : getStepResult(context.steps[stepId as string]);

      this.logger.debug(`Got condition data from step ${stepId}`, {
        stepId,
        sourceData,
        runId: this.#runId,
      });

      if (!sourceData) {
        return false;
      }

      let value = get(sourceData, path);

      // If path is 'status', check if value is empty and we are not referencing the trigger.
      // Currently only successful step results get to this point, so we can safely assume that the status is 'success'
      if (stepId !== 'trigger' && path === 'status' && !value) {
        value = 'success';
      }

      // Handle different types of queries
      if (typeof queryValue === 'object' && queryValue !== null) {
        // If it's an object, treat it as a query object
        baseResult = sift(queryValue)(value);
      } else {
        // For simple values, do an equality check
        baseResult = value === queryValue;
      }
    }

    // Base condition
    if ('ref' in condition) {
      const { ref, query } = condition;
      const sourceData = ref.step === 'trigger' ? context.triggerData : getStepResult(context.steps[ref.step.id]);

      this.logger.debug(`Got condition data from ${ref.step === 'trigger' ? 'trigger' : ref.step.id}`, {
        sourceData,
        runId: this.#runId,
      });

      if (!sourceData) {
        return false;
      }

      let value = get(sourceData, ref.path);

      // If path is 'status', check if value is empty and we are not referencing the trigger.
      // Currently only successful step results get to this point, so we can safely assume that the status is 'success'
      if (ref.step !== 'trigger' && ref.path === 'status' && !value) {
        value = 'success';
      }

      baseResult = sift(query)(value);
    }

    // AND condition
    if ('and' in condition) {
      andBranchResult = condition.and.every(cond => this.#evaluateCondition(cond, context));
      this.logger.debug(`Evaluated AND condition`, {
        andBranchResult,
        runId: this.#runId,
      });
    }

    // OR condition
    if ('or' in condition) {
      orBranchResult = condition.or.some(cond => this.#evaluateCondition(cond, context));
      this.logger.debug(`Evaluated OR condition`, {
        orBranchResult,
        runId: this.#runId,
      });
    }

    if ('not' in condition) {
      baseResult = !this.#evaluateCondition(condition.not, context);
      this.logger.debug(`Evaluated NOT condition`, {
        baseResult,
        runId: this.#runId,
      });
    }

    const finalResult = baseResult && andBranchResult && orBranchResult;

    this.logger.debug(`Evaluated condition`, {
      finalResult,
      runId: this.#runId,
    });

    return finalResult;
  }

  getSnapshot() {
    const snapshot = this.#actor?.getSnapshot();
    return snapshot;
  }
}
