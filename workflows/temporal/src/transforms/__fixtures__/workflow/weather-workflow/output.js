import { defineSignal, defineQuery, proxyActivities, setHandler, condition, log, ApplicationFailure, sleep, executeChild } from '@temporalio/workflow';

const resumeSignal = defineSignal('mastra.resume');
const statusQuery = defineQuery('mastra.status');
class TemporalExecutionEngine {
  startToCloseTimeout;
  activityHandle;
  resumePayloads = new Map();
  suspendedSteps = new Set();
  resumeLabels = new Map();
  currentResult;
  initData;
  initialState;
  constructor(params) {
    this.startToCloseTimeout = params?.options?.startToCloseTimeout ?? '1 minute';
    this.activityHandle = proxyActivities({
      startToCloseTimeout: this.startToCloseTimeout,
      ...(params?.options?.retry !== undefined && {
        retry: params.options.retry
      })
    });
    setHandler(resumeSignal, payload => {
      const id = this.resumeTarget(payload);
      if (id !== undefined && !this.resumePayloads.has(id)) {
        this.resumePayloads.set(id, payload);
      }
    });
    setHandler(statusQuery, () => this.currentResult);
  }
  async execute(params) {
    this.initData = params.input;
    this.initialState = params.initialState;
    this.executionContext = {
      ...(params.requestContext !== undefined && {
        requestContext: params.requestContext
      }),
      ...(params.runId !== undefined && {
        runId: params.runId
      }),
      ...(params.resourceId !== undefined && {
        resourceId: params.resourceId
      }),
      workflowId: params.workflowId
    };
    let result = params.input;
    const stepResults = {};
    this.currentResult = {
      status: 'running',
      input: params.input,
      state: params.initialState,
      steps: stepResults
    };
    for (const entry of params.graph.steps) {
      result = await this.executeEntry(entry, result, stepResults);
    }
    this.currentResult = {
      status: 'success',
      input: params.input,
      result,
      state: params.initialState,
      steps: stepResults
    };
    return this.currentResult;
  }
  resumeTarget(payload) {
    if (payload?.step !== undefined) {
      return this.suspendedSteps.has(payload.step) ? payload.step : undefined;
    }
    if (payload?.label !== undefined) {
      const labeledStep = this.resumeLabels.get(payload.label);
      return labeledStep !== undefined && this.suspendedSteps.has(labeledStep) ? labeledStep : undefined;
    }
    return this.suspendedSteps.size === 1 ? [...this.suspendedSteps][0] : undefined;
  }
  updateSuspendedResult(stepResults) {
    const suspended = [...this.suspendedSteps].map(id => [id]);
    this.currentResult = {
      status: 'suspended',
      input: this.initData,
      state: this.initialState,
      steps: stepResults,
      suspended,
      suspendPayload: Object.fromEntries(suspended.map(([id]) => [id, stepResults[id]?.suspendPayload])),
      resumeLabels: Object.fromEntries([...this.resumeLabels].map(([label, stepId]) => [label, {
        stepId
      }]))
    };
  }
  updateRunningResult(stepResults) {
    this.currentResult = {
      status: 'running',
      input: this.initData,
      state: this.initialState,
      steps: stepResults
    };
  }

  // Record steps in the core StepResult shape ({ status, payload, output, startedAt, endedAt }).
  async recordStep(stepResults, id, payload, run) {
    const startedAt = Date.now();
    let output = await run();
    let suspendPayload;
    let resumeData;
    while (output?.__temporalSuspension === true) {
      suspendPayload = output.suspendPayload;
      stepResults[id] = {
        __temporalStepResult: true,
        status: 'suspended',
        payload,
        suspendPayload,
        suspendedAt: Date.now()
      };
      for (const [label, target] of Object.entries(output.resumeLabels ?? {})) {
        if (target?.stepId === id) {
          this.resumeLabels.set(label, id);
        }
      }
      this.suspendedSteps.add(id);
      this.updateSuspendedResult(stepResults);
      try {
        await condition(() => this.resumePayloads.has(id));
        resumeData = this.resumePayloads.get(id)?.resumeData;
        this.resumePayloads.delete(id);
      } finally {
        this.suspendedSteps.delete(id);
        for (const [label, stepId] of this.resumeLabels.entries()) {
          if (stepId === id) {
            this.resumeLabels.delete(label);
          }
        }
      }
      if (this.suspendedSteps.size > 0) {
        this.updateSuspendedResult(stepResults);
      } else {
        this.updateRunningResult(stepResults);
      }
      output = await run(resumeData);
    }
    stepResults[id] = {
      __temporalStepResult: true,
      status: 'success',
      payload,
      output,
      ...(suspendPayload !== undefined && {
        suspendPayload
      }),
      ...(resumeData !== undefined && {
        resumeData
      }),
      startedAt,
      endedAt: Date.now()
    };
    if (this.suspendedSteps.size > 0) {
      this.updateSuspendedResult(stepResults);
    } else {
      this.updateRunningResult(stepResults);
    }
    return output;
  }
  activityParams(inputData, extra = {}) {
    return {
      inputData,
      ...extra,
      ...this.executionContext
    };
  }
  async executeEntry(entry, inputData, stepResults) {
    switch (entry.type) {
      case 'step':
        {
          log.info('step', {
            stepId: entry.step.id
          });
          return this.recordStep(stepResults, entry.step.id, inputData, resumeData => this.activityHandle[entry.step.id](this.activityParams(inputData, {
            initData: this.initData,
            ...(resumeData !== undefined && {
              resumeData
            })
          })));
        }
      case 'childWorkflow':
        {
          log.info('childWorkflow', {
            workflowType: entry.workflowType
          });
          return this.recordStep(stepResults, entry.workflowType, inputData, async () => {
            const childResult = await executeChild(entry.workflowType, {
              args: [{
                inputData,
                ...this.executionContext
              }]
            });
            if (childResult?.status === 'suspended' || childResult?.__temporalSuspension === true) {
              throw ApplicationFailure.nonRetryable('Temporal workflows do not support suspending inside child workflows yet.');
            }
            return childResult?.result ?? childResult;
          });
        }
      case 'mapping':
        {
          log.info('mapping', {
            mappingId: entry.id
          });
          return this.recordStep(stepResults, entry.id, inputData, () => this.activityHandle[entry.id](this.activityParams(inputData, {
            initData: this.initData
          })));
        }
      case 'sleep':
        {
          const duration = entry.duration ?? (entry.fn ? await this.activityHandle[entry.fn](this.activityParams(inputData)) : 0);
          log.info('sleep', {
            id: entry.id,
            duration
          });
          await sleep(duration);
          return inputData;
        }
      case 'sleepUntil':
        {
          const date = entry.date != null ? new Date(entry.date) : entry.fn ? new Date(await this.activityHandle[entry.fn](this.activityParams(inputData))) : new Date();
          log.info('sleepUntil', {
            id: entry.id,
            date: date.toISOString()
          });
          const duration = Math.max(0, date.getTime() - Date.now());
          await sleep(duration);
          return inputData;
        }
      case 'parallel':
        {
          const entryId = parallelEntry => parallelEntry.type === 'childWorkflow' ? parallelEntry.workflowType : parallelEntry.step.id;
          log.info('parallel', {
            steps: entry.steps.map(entryId)
          });
          const results = await Promise.all(entry.steps.map(step => this.executeEntry(step, inputData, stepResults)));
          const out = {};
          entry.steps.forEach((step, i) => {
            out[entryId(step)] = results[i];
          });
          return out;
        }
      case 'conditional':
        {
          log.info('conditional', {
            conditions: entry.serializedConditions.map(condition => condition.id)
          });
          const condResults = await Promise.all(entry.serializedConditions.map(condition => this.activityHandle[condition.id](this.activityParams(inputData))));
          const out = {};
          for (let i = 0; i < entry.steps.length; i++) {
            if (condResults[i]) {
              const stepId = entry.steps[i].step.id;
              out[stepId] = await this.recordStep(stepResults, stepId, inputData, resumeData => this.activityHandle[stepId](this.activityParams(inputData, {
                initData: this.initData,
                ...(resumeData !== undefined && {
                  resumeData
                })
              })));
            }
          }
          return out;
        }
      case 'loop':
        {
          log.info('loop', {
            step: entry.step.id,
            loopType: entry.loopType
          });
          let current = inputData;
          while (true) {
            const payload = current;
            current = await this.recordStep(stepResults, entry.step.id, payload, resumeData => this.activityHandle[entry.step.id](this.activityParams(payload, {
              initData: this.initData,
              ...(resumeData !== undefined && {
                resumeData
              })
            })));
            const shouldContinue = Boolean(await this.activityHandle[entry.serializedCondition.id](this.activityParams(current)));
            if (entry.loopType === 'dowhile' ? !shouldContinue : shouldContinue) {
              break;
            }
          }
          return current;
        }
      case 'foreach':
        {
          const items = Array.isArray(inputData) ? inputData : [];
          // Concurrency may be a resolver function evaluated per run.
          const configured = typeof entry.opts.concurrency === 'function' ? entry.opts.concurrency({
            inputData,
            getInitData: () => this.initData
          }) : entry.opts.concurrency ?? 1;
          const concurrency = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 1;
          log.info('foreach', {
            step: entry.step.id,
            concurrency
          });
          const startedAt = Date.now();
          const results = new Array(items.length);
          let index = 0;
          const workers = Array.from({
            length: Math.min(concurrency, items.length)
          }, async () => {
            while (true) {
              const i = index++;
              if (i >= items.length) {
                break;
              }
              const itemResult = await this.activityHandle[entry.step.id](this.activityParams(items[i], {
                initData: this.initData
              }));
              if (itemResult?.__temporalSuspension === true) {
                throw ApplicationFailure.nonRetryable('Temporal workflows do not support suspending inside foreach steps yet.');
              }
              results[i] = itemResult;
            }
          });
          await Promise.all(workers);
          stepResults[entry.step.id] = {
            __temporalStepResult: true,
            status: 'success',
            payload: inputData,
            output: results,
            startedAt,
            endedAt: Date.now()
          };
          return results;
        }
      default:
        return inputData;
    }
  }
}
function createWorkflow(workflowId, options) {
  const stepFlow = [];
  let autoId = 0;
  const nextId = prefix => `${prefix}_${autoId++}`;
  const workflow = async startArgs => {
    const engine = new TemporalExecutionEngine({
      options
    });
    return engine.execute({
      workflowId,
      runId: startArgs?.runId,
      resourceId: startArgs?.resourceId,
      requestContext: startArgs?.requestContext,
      graph: {
        id: workflowId,
        steps: stepFlow
      },
      input: startArgs?.inputData,
      initialState: startArgs?.initialState
    });
  };
  return Object.assign(workflow, {
    then(stepId) {
      stepFlow.push({
        type: 'step',
        step: {
          id: stepId
        }
      });
      return workflow;
    },
    thenWorkflow(workflowType) {
      stepFlow.push({
        type: 'childWorkflow',
        workflowType
      });
      return workflow;
    },
    map(mappingId) {
      stepFlow.push({
        type: 'mapping',
        id: mappingId
      });
      return workflow;
    },
    sleep(durationOrFnId) {
      if (typeof durationOrFnId === 'number') {
        stepFlow.push({
          type: 'sleep',
          id: nextId('sleep'),
          duration: durationOrFnId
        });
      } else {
        stepFlow.push({
          type: 'sleep',
          id: nextId('sleep'),
          fn: durationOrFnId
        });
      }
      return workflow;
    },
    sleepUntil(dateOrFnId) {
      if (dateOrFnId instanceof Date) {
        stepFlow.push({
          type: 'sleepUntil',
          id: nextId('sleepUntil'),
          date: dateOrFnId.toISOString()
        });
      } else if (typeof dateOrFnId === 'number' || typeof dateOrFnId === 'string' && !isNaN(Date.parse(dateOrFnId))) {
        stepFlow.push({
          type: 'sleepUntil',
          id: nextId('sleepUntil'),
          date: new Date(dateOrFnId).toISOString()
        });
      } else {
        stepFlow.push({
          type: 'sleepUntil',
          id: nextId('sleepUntil'),
          fn: dateOrFnId
        });
      }
      return workflow;
    },
    parallel(entries) {
      stepFlow.push({
        type: 'parallel',
        steps: entries
      });
      return workflow;
    },
    branch(pairs) {
      stepFlow.push({
        type: 'conditional',
        serializedConditions: pairs.map(pair => ({
          id: pair[0]
        })),
        steps: pairs.map(pair => ({
          type: 'step',
          step: {
            id: pair[1]
          }
        }))
      });
      return workflow;
    },
    dowhile(stepId, condId) {
      stepFlow.push({
        type: 'loop',
        step: {
          id: stepId
        },
        serializedCondition: {
          id: condId
        },
        loopType: 'dowhile'
      });
      return workflow;
    },
    dountil(stepId, condId) {
      stepFlow.push({
        type: 'loop',
        step: {
          id: stepId
        },
        serializedCondition: {
          id: condId
        },
        loopType: 'dountil'
      });
      return workflow;
    },
    foreach(stepId, opts) {
      stepFlow.push({
        type: 'foreach',
        step: {
          id: stepId
        },
        opts: {
          concurrency: opts?.concurrency ?? 1
        }
      });
      return workflow;
    },
    commit() {
      return workflow;
    }
  });
}
const weatherWorkflow = args => {
  return createWorkflow('weather-workflow').then("fetch-weather").then("plan-activities").sleep(3000).then("plan-activities")(args);
};

export { weatherWorkflow };