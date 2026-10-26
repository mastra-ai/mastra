import { proxyActivities, log, sleep, executeChild } from '@temporalio/workflow';

class TemporalExecutionEngine {
  startToCloseTimeout;
  activityHandle;
  constructor(params) {
    this.startToCloseTimeout = params?.options?.startToCloseTimeout ?? '1 minute';
    this.activityHandle = proxyActivities({
      startToCloseTimeout: this.startToCloseTimeout,
      ...(params?.options?.retry !== undefined && {
        retry: params.options.retry
      })
    });
  }
  async execute(params) {
    this.initData = params.input;
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
    // Step times let start() build Mastra step records. Only recorded on request so runs that
    // never read them (startAsync, runs started before the field existed) keep their result size.
    this.stepMeta = params.recordStepMeta ? {} : undefined;
    let result = params.input;
    const stepResults = {};
    for (const entry of params.graph.steps) {
      result = await this.executeEntry(entry, result, stepResults);
    }
    return {
      status: 'success',
      input: params.input,
      result,
      state: params.initialState,
      steps: stepResults,
      ...(this.stepMeta && {
        stepMeta: this.stepMeta
      })
    };
  }

  // Date.now() in Workflow code is the Workflow Task time, which replay reads from history.
  recordStep(stepResults, id, startedAt, output) {
    stepResults[id] = output;
    if (this.stepMeta) {
      this.stepMeta[id] = {
        startedAt,
        endedAt: Date.now()
      };
    }
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
          const startedAt = Date.now();
          const out = await this.activityHandle[entry.step.id](this.activityParams(inputData, {
            initData: this.initData
          }));
          this.recordStep(stepResults, entry.step.id, startedAt, out);
          return out;
        }
      case 'childWorkflow':
        {
          log.info('childWorkflow', {
            workflowType: entry.workflowType
          });
          const startedAt = Date.now();
          const childResult = await executeChild(entry.workflowType, {
            args: [{
              inputData,
              ...this.executionContext
            }]
          });
          const out = childResult?.result ?? childResult;
          this.recordStep(stepResults, entry.workflowType, startedAt, out);
          return out;
        }
      case 'mapping':
        {
          log.info('mapping', {
            mappingId: entry.id
          });
          const startedAt = Date.now();
          const out = await this.activityHandle[entry.id](this.activityParams(inputData, {
            initData: this.initData
          }));
          this.recordStep(stepResults, entry.id, startedAt, out);
          return out;
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
              const startedAt = Date.now();
              const res = await this.activityHandle[stepId](this.activityParams(inputData, {
                initData: this.initData
              }));
              out[stepId] = res;
              this.recordStep(stepResults, stepId, startedAt, res);
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
            const startedAt = Date.now();
            current = await this.activityHandle[entry.step.id](this.activityParams(current, {
              initData: this.initData
            }));
            this.recordStep(stepResults, entry.step.id, startedAt, current);
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
          await Promise.all(workers);
          this.recordStep(stepResults, entry.step.id, startedAt, results);
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
      initialState: startArgs?.initialState,
      recordStepMeta: startArgs?.recordStepMeta === true
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