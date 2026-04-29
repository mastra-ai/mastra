import { proxyActivities, log, sleep, executeChild } from '@temporalio/workflow';

class TemporalExecutionEngine {
  startToCloseTimeout;
  activityHandle;
  constructor(params) {
    this.startToCloseTimeout = params?.options?.startToCloseTimeout ?? '1 minute';
    this.activityHandle = proxyActivities({
      startToCloseTimeout: this.startToCloseTimeout,
    });
  }
  async execute(params) {
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
    };
  }
  async executeEntry(entry, inputData, stepResults) {
    switch (entry.type) {
      case 'step': {
        log.info('step', {
          stepId: entry.step.id,
        });
        const out = await this.activityHandle[entry.step.id]({
          inputData,
        });
        stepResults[entry.step.id] = out;
        return out;
      }
      case 'childWorkflow': {
        log.info('childWorkflow', {
          workflowType: entry.workflowType,
        });
        const childResult = await executeChild(entry.workflowType, {
          args: [
            {
              inputData,
            },
          ],
        });
        const out = childResult?.result ?? childResult;
        stepResults[entry.workflowType] = out;
        return out;
      }
      case 'sleep': {
        const duration =
          entry.duration ??
          (entry.fn
            ? await this.activityHandle[entry.fn]({
                inputData,
              })
            : 0);
        log.info('sleep', {
          id: entry.id,
          duration,
        });
        await sleep(duration);
        return inputData;
      }
      case 'sleepUntil': {
        const date =
          entry.date != null
            ? new Date(entry.date)
            : entry.fn
              ? new Date(
                  await this.activityHandle[entry.fn]({
                    inputData,
                  }),
                )
              : new Date();
        log.info('sleepUntil', {
          id: entry.id,
          date: date.toISOString(),
        });
        const duration = Math.max(0, date.getTime() - Date.now());
        await sleep(duration);
        return inputData;
      }
      case 'parallel': {
        log.info('parallel', {
          steps: entry.steps.map(s => s.step.id),
        });
        const results = await Promise.all(
          entry.steps.map(s =>
            this.activityHandle[s.step.id]({
              inputData,
            }),
          ),
        );
        const out = {};
        entry.steps.forEach((s, i) => {
          out[s.step.id] = results[i];
          stepResults[s.step.id] = results[i];
        });
        return out;
      }
      case 'conditional': {
        log.info('conditional', {
          conditions: entry.serializedConditions.map(condition => condition.id),
        });
        const condResults = await Promise.all(
          entry.serializedConditions.map(condition =>
            this.activityHandle[condition.id]({
              inputData,
            }),
          ),
        );
        const out = {};
        for (let i = 0; i < entry.steps.length; i++) {
          if (condResults[i]) {
            const stepId = entry.steps[i].step.id;
            const res = await this.activityHandle[stepId]({
              inputData,
            });
            out[stepId] = res;
            stepResults[stepId] = res;
          }
        }
        return out;
      }
      case 'loop': {
        log.info('loop', {
          step: entry.step.id,
          loopType: entry.loopType,
        });
        let current = inputData;
        while (true) {
          current = await this.activityHandle[entry.step.id]({
            inputData: current,
          });
          stepResults[entry.step.id] = current;
          const shouldContinue = Boolean(
            await this.activityHandle[entry.serializedCondition.id]({
              inputData: current,
            }),
          );
          if (entry.loopType === 'dowhile' ? !shouldContinue : shouldContinue) {
            break;
          }
        }
        return current;
      }
      case 'foreach': {
        log.info('foreach', {
          step: entry.step.id,
          concurrency: entry.opts.concurrency,
        });
        const items = Array.isArray(inputData) ? inputData : [];
        const concurrency = Math.max(1, entry.opts.concurrency ?? 1);
        const results = new Array(items.length);
        let index = 0;
        const workers = Array.from(
          {
            length: Math.min(concurrency, items.length),
          },
          async () => {
            while (true) {
              const i = index++;
              if (i >= items.length) {
                break;
              }
              results[i] = await this.activityHandle[entry.step.id]({
                inputData: items[i],
              });
            }
          },
        );
        await Promise.all(workers);
        stepResults[entry.step.id] = results;
        return results;
      }
      default:
        return inputData;
    }
  }
}
function createWorkflow(workflowId) {
  const stepFlow = [];
  let autoId = 0;
  const nextId = prefix => `${prefix}_${autoId++}`;
  const workflow = async startArgs => {
    const engine = new TemporalExecutionEngine({
      options: {
        startToCloseTimeout: '1 minute',
      },
    });
    return engine.execute({
      workflowId,
      runId: startArgs?.runId,
      resourceId: startArgs?.resourceId,
      graph: {
        id: workflowId,
        steps: stepFlow,
      },
      input: startArgs?.inputData,
      initialState: startArgs?.initialState,
    });
  };
  return Object.assign(workflow, {
    then(stepId) {
      stepFlow.push({
        type: 'step',
        step: {
          id: stepId,
        },
      });
      return workflow;
    },
    thenWorkflow(workflowType) {
      stepFlow.push({
        type: 'childWorkflow',
        workflowType,
      });
      return workflow;
    },
    sleep(durationOrFnId) {
      if (typeof durationOrFnId === 'number') {
        stepFlow.push({
          type: 'sleep',
          id: nextId('sleep'),
          duration: durationOrFnId,
        });
      } else {
        stepFlow.push({
          type: 'sleep',
          id: nextId('sleep'),
          fn: durationOrFnId,
        });
      }
      return workflow;
    },
    sleepUntil(dateOrFnId) {
      if (dateOrFnId instanceof Date) {
        stepFlow.push({
          type: 'sleepUntil',
          id: nextId('sleepUntil'),
          date: dateOrFnId.toISOString(),
        });
      } else if (typeof dateOrFnId === 'number' || (typeof dateOrFnId === 'string' && !isNaN(Date.parse(dateOrFnId)))) {
        stepFlow.push({
          type: 'sleepUntil',
          id: nextId('sleepUntil'),
          date: new Date(dateOrFnId).toISOString(),
        });
      } else {
        stepFlow.push({
          type: 'sleepUntil',
          id: nextId('sleepUntil'),
          fn: dateOrFnId,
        });
      }
      return workflow;
    },
    parallel(stepIds) {
      stepFlow.push({
        type: 'parallel',
        steps: stepIds.map(id => ({
          type: 'step',
          step: {
            id,
          },
        })),
      });
      return workflow;
    },
    branch(pairs) {
      stepFlow.push({
        type: 'conditional',
        serializedConditions: pairs.map(pair => ({
          id: pair[0],
        })),
        steps: pairs.map(pair => ({
          type: 'step',
          step: {
            id: pair[1],
          },
        })),
      });
      return workflow;
    },
    dowhile(stepId, condId) {
      stepFlow.push({
        type: 'loop',
        step: {
          id: stepId,
        },
        serializedCondition: {
          id: condId,
        },
        loopType: 'dowhile',
      });
      return workflow;
    },
    dountil(stepId, condId) {
      stepFlow.push({
        type: 'loop',
        step: {
          id: stepId,
        },
        serializedCondition: {
          id: condId,
        },
        loopType: 'dountil',
      });
      return workflow;
    },
    foreach(stepId, opts) {
      stepFlow.push({
        type: 'foreach',
        step: {
          id: stepId,
        },
        opts: {
          concurrency: opts?.concurrency ?? 1,
        },
      });
      return workflow;
    },
    commit() {
      return workflow;
    },
  });
}
const weatherWorkflow = args => {
  return createWorkflow('weather-workflow')
    .then('fetch-weather')
    .then('plan-activities')
    .sleep(3000)
    .then('plan-activities')(args);
};

export { weatherWorkflow };
