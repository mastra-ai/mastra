import { defineSignal, defineQuery, proxyActivities, setHandler, ApplicationFailure, isCancellation, TemporalFailure, condition, log, sleep, executeChild } from '@temporalio/workflow';

const resumeSignal = defineSignal('mastra.resume');
const claimExecutionSignal = defineSignal('mastra.claimExecution');
const statusQuery = defineQuery('mastra.status');
const executionClaimQuery = defineQuery('mastra.executionClaim');
const authTokenKey = 'mastra__authToken';
// The step error an Activity or child Workflow put in its failure details. Failures without them
// (timeouts, Activities from an older Worker) give the innermost cause's type and message.
function readStepFailure(error) {
  let current = error;
  while (current) {
    const details = current.details?.[0];
    if (details?.error) {
      return {
        error: details.error,
        ...(details.tripwire && {
          tripwire: details.tripwire
        })
      };
    }
    if (!current.cause) {
      break;
    }
    current = current.cause;
  }
  return {
    error: {
      name: current?.type ?? current?.name ?? 'Error',
      message: current?.message ?? String(error)
    }
  };
}

// Records a step as failed, in the core StepResult shape, before its failure ends the run.
function recordFailure(stepResults, id, payload, startedAt, error) {
  stepResults[id] = {
    __temporalStepResult: true,
    status: 'failed',
    payload,
    ...readStepFailure(error),
    startedAt,
    endedAt: Date.now()
  };
}
class TemporalExecutionEngine {
  startToCloseTimeout;
  activityHandle;
  resumePayloads = new Map();
  suspendedSteps = new Set();
  resumeLabels = new Map();
  currentResult;
  queryRequestContext;
  executionClaim;
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
      const claim = this.executionClaim;
      if (claim?.operation !== 'resume' || claim.token !== payload?.claimToken) return;
      const id = this.resumeTarget(payload);
      if (id !== claim.stepId || this.resumePayloads.has(id)) return;
      this.resumePayloads.set(id, payload);
    });
    const updateExecutionClaim = ({
      action,
      operation,
      token,
      target
    }) => {
      if (action === 'release') {
        if (this.executionClaim?.token !== token) return false;
        this.executionClaim = undefined;
        return true;
      }
      if (this.executionClaim !== undefined) return false;
      if (operation === 'resume') {
        const stepId = this.resumeTarget(target);
        if (stepId === undefined) return false;
        this.executionClaim = {
          operation,
          token,
          stepId
        };
        return true;
      }
      if (operation !== 'timeTravel') return false;
      this.executionClaim = {
        operation,
        token
      };
      return true;
    };
    setHandler(claimExecutionSignal, updateExecutionClaim);
    setHandler(executionClaimQuery, () => this.executionClaim);
    setHandler(statusQuery, () => this.currentResult ? {
      ...this.currentResult,
      ...(this.queryRequestContext !== undefined && {
        requestContext: this.queryRequestContext
      })
    } : this.currentResult);
  }
  async execute(params) {
    const timeTravel = params.timeTravel;
    this.initData = params.input;
    this.initialState = timeTravel?.state ?? params.initialState;
    if (params.requestContext !== undefined) {
      const {
        [authTokenKey]: _authToken,
        ...queryRequestContext
      } = params.requestContext;
      this.queryRequestContext = queryRequestContext;
    }
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
      ...(params.validateInputs !== undefined && {
        validateInputs: params.validateInputs
      }),
      workflowId: params.workflowId
    };
    let startIndex = 0;
    let result = this.initData;
    const stepResults = {};
    if (timeTravel) {
      const [targetIndex, ...innerPath] = timeTravel.executionPath ?? [];
      const targetEntry = params.graph.steps[targetIndex];
      if (!Number.isInteger(targetIndex) || innerPath.length > 0 || targetEntry?.type !== 'step' || timeTravel.steps?.length !== 1 || targetEntry.step.id !== timeTravel.steps[0]) {
        throw ApplicationFailure.nonRetryable('Temporal time travel currently supports only top-level sequential step targets.');
      }
      startIndex = targetIndex;
      for (const [id, stepResult] of Object.entries(timeTravel.stepResults ?? {})) {
        stepResults[id] = id === 'input' || stepResult?.__temporalStepResult === true ? stepResult : {
          __temporalStepResult: true,
          ...stepResult
        };
      }
      result = timeTravel.inputData ?? stepResults[targetEntry.step.id]?.payload ?? this.initData;
    }
    this.currentResult = {
      status: 'running',
      input: this.initData,
      state: this.initialState,
      steps: stepResults
    };
    try {
      for (const [offset, entry] of params.graph.steps.slice(startIndex).entries()) {
        result = await this.executeEntry(entry, result, stepResults, undefined, offset === 0 ? timeTravel?.resumeData : undefined);
      }
    } catch (error) {
      // An error that isn't a Temporal failure comes from Workflow code. It fails only the Workflow
      // Task, which Temporal retries, so a fixed Worker can still finish the run.
      if (isCancellation(error) || !(error instanceof TemporalFailure)) {
        throw error;
      }

      // The run still fails in Temporal. The details let start() return step records and the
      // step's own error, which a thrown ActivityFailure would lose.
      const failure = readStepFailure(error);
      this.currentResult = {
        status: failure.tripwire ? 'tripwire' : 'failed',
        input: this.initData,
        state: this.initialState,
        steps: stepResults,
        ...failure
      };
      throw ApplicationFailure.create({
        message: failure.error.message,
        type: failure.error.name,
        cause: error,
        details: [{
          ...failure,
          steps: stepResults
        }]
      });
    }
    this.currentResult = {
      status: 'success',
      input: this.initData,
      result,
      state: this.initialState,
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

  // Record steps in the core StepResult shape ({ status, payload, output, startedAt, endedAt }).
  async recordStep(stepResults, id, payload, run, group, initialResumeData) {
    const startedAt = Date.now();
    const attempt = async resumeData => {
      try {
        return await run(resumeData);
      } catch (error) {
        recordFailure(stepResults, id, payload, startedAt, error);
        throw error;
      }
    };
    let output = await attempt(initialResumeData);
    let suspendPayload;
    let resumeData = initialResumeData;
    while (output?.__temporalSuspension === true) {
      suspendPayload = output.suspendPayload;
      stepResults[id] = {
        __temporalStepResult: true,
        status: 'suspended',
        payload,
        suspendPayload,
        suspendedAt: Date.now()
      };
      if (output.resumeLabel) {
        this.resumeLabels.set(output.resumeLabel, id);
      }
      for (const [label, target] of Object.entries(output.resumeLabels ?? {})) {
        if (target?.stepId === id) {
          this.resumeLabels.set(label, id);
        }
      }
      this.suspendedSteps.add(id);
      if (this.executionClaim?.operation === 'timeTravel') {
        this.executionClaim = undefined;
      }
      const suspended = [...this.suspendedSteps].map(stepId => [stepId]);
      const suspendedPayloads = Object.fromEntries([...this.suspendedSteps].map(stepId => [stepId, stepResults[stepId]?.suspendPayload]));
      this.currentResult = {
        status: 'suspended',
        input: this.initData,
        state: this.initialState,
        steps: stepResults,
        suspended,
        suspendPayload: suspendedPayloads,
        resumeLabels: Object.fromEntries([...this.resumeLabels].map(([label, stepId]) => [label, {
          stepId
        }]))
      };
      try {
        await condition(() => this.resumePayloads.has(id) || group?.failed === true);
        // A failed sibling branch ends the run, so the step stays suspended in the records.
        if (!this.resumePayloads.has(id)) {
          return output;
        }
        const resumePayload = this.resumePayloads.get(id);
        resumeData = resumePayload?.resumeData;
        this.resumePayloads.delete(id);
        if (this.executionClaim?.operation === 'resume' && this.executionClaim.token === resumePayload?.claimToken) {
          this.executionClaim = undefined;
        }
      } finally {
        this.suspendedSteps.delete(id);
        for (const [label, stepId] of this.resumeLabels.entries()) {
          if (stepId === id) {
            this.resumeLabels.delete(label);
          }
        }
      }
      this.currentResult = this.suspendedSteps.size ? {
        status: 'suspended',
        input: this.initData,
        state: this.initialState,
        steps: stepResults,
        suspended: [...this.suspendedSteps].map(stepId => [stepId]),
        suspendPayload: Object.fromEntries([...this.suspendedSteps].map(stepId => [stepId, stepResults[stepId]?.suspendPayload])),
        resumeLabels: Object.fromEntries([...this.resumeLabels].map(([label, stepId]) => [label, {
          stepId
        }]))
      } : {
        status: 'running',
        input: this.initData,
        state: this.initialState,
        steps: stepResults
      };
      output = await attempt(resumeData);
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
    this.currentResult = this.suspendedSteps.size ? {
      status: 'suspended',
      input: this.initData,
      state: this.initialState,
      steps: stepResults,
      suspended: [...this.suspendedSteps].map(stepId => [stepId]),
      suspendPayload: Object.fromEntries([...this.suspendedSteps].map(stepId => [stepId, stepResults[stepId]?.suspendPayload])),
      resumeLabels: Object.fromEntries([...this.resumeLabels].map(([label, stepId]) => [label, {
        stepId
      }]))
    } : {
      status: 'running',
      input: this.initData,
      state: this.initialState,
      steps: stepResults
    };
    return output;
  }
  activityParams(inputData, extra = {}) {
    return {
      inputData,
      ...extra,
      ...this.executionContext
    };
  }
  async executeEntry(entry, inputData, stepResults, group, initialResumeData) {
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
          })), group, initialResumeData);
        }
      case 'childWorkflow':
        {
          log.info('childWorkflow', {
            workflowType: entry.workflowType
          });
          return this.recordStep(stepResults, entry.id ?? entry.workflowType, inputData, async () => {
            const childResult = await executeChild(entry.workflowType, {
              args: [{
                inputData,
                ...this.executionContext
              }]
            });
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
          // Waits for every branch, as a local run does, so a failed run keeps the others' records.
          // A failed branch also ends the wait of a suspended one, which would otherwise keep the run
          // open until a resume. The flag is per group so a later parallel starts clean.
          const group = {
            failed: false
          };
          const settled = await Promise.allSettled(entry.steps.map(step => this.executeEntry(step, inputData, stepResults, group).catch(error => {
            group.failed = true;
            throw error;
          })));
          const failures = settled.filter(outcome => outcome.status === 'rejected');
          // Same order as in execute(), whatever the branch order: a cancelled run ends Canceled, and
          // an error from Workflow code wins so Temporal retries the Workflow Task.
          const rejected = failures.find(outcome => isCancellation(outcome.reason)) ?? failures.find(outcome => !(outcome.reason instanceof TemporalFailure)) ?? failures[0];
          if (rejected) {
            throw rejected.reason;
          }
          const out = {};
          entry.steps.forEach((step, i) => {
            out[entryId(step)] = settled[i].value;
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
              results[i] = await this.activityHandle[entry.step.id](this.activityParams(items[i], {
                initData: this.initData
              }));
            }
          });
          try {
            await Promise.all(workers);
          } catch (error) {
            recordFailure(stepResults, entry.step.id, inputData, startedAt, error);
            throw error;
          }
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
      // A child Workflow gets its parent's setting in startArgs, as nested workflows do in Mastra.
      validateInputs: startArgs?.validateInputs ?? options?.validateInputs ?? true,
      graph: {
        id: workflowId,
        steps: stepFlow
      },
      input: startArgs?.inputData,
      initialState: startArgs?.initialState,
      timeTravel: startArgs?.timeTravel,
      timeTravelLineage: startArgs?.timeTravelLineage
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
    thenWorkflow(workflowType, id) {
      stepFlow.push({
        type: 'childWorkflow',
        workflowType,
        id
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