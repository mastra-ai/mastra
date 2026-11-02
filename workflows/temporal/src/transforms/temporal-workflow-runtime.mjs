import {
  ApplicationFailure,
  TemporalFailure,
  executeChild,
  isCancellation,
  proxyActivities,
  log,
  sleep,
} from '@temporalio/workflow';

// The step error an Activity or child Workflow put in its failure details. Failures without them
// (timeouts, Activities from an older Worker) give the innermost cause's type and message.
function readStepFailure(error) {
  let current = error;
  while (current) {
    const details = current.details?.[0];

    if (details?.error) {
      return { error: details.error, ...(details.tripwire && { tripwire: details.tripwire }) };
    }

    if (!current.cause) {
      break;
    }

    current = current.cause;
  }

  return { error: { name: current?.type ?? current?.name ?? 'Error', message: current?.message ?? String(error) } };
}

export class TemporalExecutionEngine {
  startToCloseTimeout;
  activityHandle;

  constructor(params) {
    this.startToCloseTimeout = params?.options?.startToCloseTimeout ?? '1 minute';
    this.activityHandle = proxyActivities({
      startToCloseTimeout: this.startToCloseTimeout,
      ...(params?.options?.retry !== undefined && { retry: params.options.retry }),
    });
  }

  async execute(params) {
    this.initData = params.input;
    this.executionContext = {
      ...(params.requestContext !== undefined && { requestContext: params.requestContext }),
      ...(params.runId !== undefined && { runId: params.runId }),
      ...(params.resourceId !== undefined && { resourceId: params.resourceId }),
      validateInputs: params.validateInputs,
      workflowId: params.workflowId,
    };
    // Step times let start() build Mastra step records. Only recorded on request so runs that
    // never read them (startAsync, runs started before the field existed) keep their result size.
    this.stepMeta = params.recordStepMeta ? {} : undefined;
    this.failedSteps = {};
    let result = params.input;
    const stepResults = {};

    try {
      for (const entry of params.graph.steps) {
        result = await this.executeEntry(entry, result, stepResults);
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
      throw ApplicationFailure.create({
        message: failure.error.message,
        type: failure.error.name,
        cause: error,
        details: [
          {
            ...failure,
            steps: stepResults,
            failedSteps: this.failedSteps,
            ...(this.stepMeta && { stepMeta: this.stepMeta }),
          },
        ],
      });
    }

    return {
      status: 'success',
      input: params.input,
      result,
      state: params.initialState,
      steps: stepResults,
      ...(this.stepMeta && { stepMeta: this.stepMeta }),
    };
  }

  // Runs one timed entry and stores its output under `id`. Date.now() in Workflow code is the
  // Workflow Task time, which replay reads from history.
  async timed(stepResults, id, run) {
    const startedAt = Date.now();
    let out;
    try {
      out = await run();
    } catch (error) {
      this.failedSteps[id] = {
        ...readStepFailure(error),
        ...(this.stepMeta && { startedAt, endedAt: Date.now() }),
      };

      throw error;
    }

    stepResults[id] = out;
    if (this.stepMeta) {
      this.stepMeta[id] = { startedAt, endedAt: Date.now() };
    }
    return out;
  }

  activityParams(inputData, extra = {}) {
    return { inputData, ...extra, ...this.executionContext };
  }

  async executeEntry(entry, inputData, stepResults) {
    switch (entry.type) {
      case 'step': {
        log.info('step', { stepId: entry.step.id });
        return this.timed(stepResults, entry.step.id, () =>
          this.activityHandle[entry.step.id](this.activityParams(inputData, { initData: this.initData })),
        );
      }

      case 'childWorkflow': {
        log.info('childWorkflow', { workflowType: entry.workflowType });
        return this.timed(stepResults, entry.id, async () => {
          const childResult = await executeChild(entry.workflowType, {
            args: [{ inputData, ...this.executionContext }],
          });
          return childResult?.result ?? childResult;
        });
      }

      case 'mapping': {
        log.info('mapping', { mappingId: entry.id });
        return this.timed(stepResults, entry.id, () =>
          this.activityHandle[entry.id](this.activityParams(inputData, { initData: this.initData })),
        );
      }

      case 'sleep': {
        const duration =
          entry.duration ?? (entry.fn ? await this.activityHandle[entry.fn](this.activityParams(inputData)) : 0);
        log.info('sleep', { id: entry.id, duration });
        await sleep(duration);
        return inputData;
      }

      case 'sleepUntil': {
        const date =
          entry.date != null
            ? new Date(entry.date)
            : entry.fn
              ? new Date(await this.activityHandle[entry.fn](this.activityParams(inputData)))
              : new Date();
        log.info('sleepUntil', { id: entry.id, date: date.toISOString() });
        const duration = Math.max(0, date.getTime() - Date.now());
        await sleep(duration);
        return inputData;
      }

      case 'parallel': {
        // The next step keeps reading a nested workflow under its Temporal type name, as before.
        // Only the step records use the Mastra id.
        const entryId = parallelEntry =>
          parallelEntry.type === 'childWorkflow' ? parallelEntry.workflowType : parallelEntry.step.id;
        log.info('parallel', { steps: entry.steps.map(entryId) });
        // Waits for every branch, as a local run does, so a failed run keeps the others' records.
        const settled = await Promise.allSettled(
          entry.steps.map(step => this.executeEntry(step, inputData, stepResults)),
        );
        const rejected = settled.find(outcome => outcome.status === 'rejected');

        if (rejected) {
          throw rejected.reason;
        }

        const out = {};

        entry.steps.forEach((step, i) => {
          out[entryId(step)] = settled[i].value;
        });

        return out;
      }

      case 'conditional': {
        log.info('conditional', {
          conditions: entry.serializedConditions.map(condition => condition.id),
        });
        const condResults = await Promise.all(
          entry.serializedConditions.map(condition =>
            this.activityHandle[condition.id](this.activityParams(inputData)),
          ),
        );
        const out = {};

        for (let i = 0; i < entry.steps.length; i++) {
          if (condResults[i]) {
            const stepId = entry.steps[i].step.id;
            out[stepId] = await this.timed(stepResults, stepId, () =>
              this.activityHandle[stepId](this.activityParams(inputData, { initData: this.initData })),
            );
          }
        }

        return out;
      }

      case 'loop': {
        log.info('loop', { step: entry.step.id, loopType: entry.loopType });
        let current = inputData;

        while (true) {
          const stepInput = current;
          current = await this.timed(stepResults, entry.step.id, () =>
            this.activityHandle[entry.step.id](this.activityParams(stepInput, { initData: this.initData })),
          );
          const shouldContinue = Boolean(
            await this.activityHandle[entry.serializedCondition.id](this.activityParams(current)),
          );

          if (entry.loopType === 'dowhile' ? !shouldContinue : shouldContinue) {
            break;
          }
        }

        return current;
      }

      case 'foreach': {
        const items = Array.isArray(inputData) ? inputData : [];
        // Concurrency may be a resolver function evaluated per run.
        const configured =
          typeof entry.opts.concurrency === 'function'
            ? entry.opts.concurrency({ inputData, getInitData: () => this.initData })
            : (entry.opts.concurrency ?? 1);
        const concurrency = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 1;
        log.info('foreach', { step: entry.step.id, concurrency });
        return this.timed(stepResults, entry.step.id, async () => {
          const results = new Array(items.length);
          let index = 0;
          const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
            while (true) {
              const i = index++;
              if (i >= items.length) {
                break;
              }
              results[i] = await this.activityHandle[entry.step.id](
                this.activityParams(items[i], { initData: this.initData }),
              );
            }
          });

          await Promise.all(workers);
          return results;
        });
      }

      default:
        return inputData;
    }
  }
}

export function createWorkflow(workflowId, options) {
  const stepFlow = [];
  let autoId = 0;
  const nextId = prefix => `${prefix}_${autoId++}`;

  const workflow = async startArgs => {
    const engine = new TemporalExecutionEngine({ options });

    return engine.execute({
      workflowId,
      runId: startArgs?.runId,
      resourceId: startArgs?.resourceId,
      requestContext: startArgs?.requestContext,
      // A child Workflow gets its parent's setting in startArgs, as nested workflows do in Mastra.
      validateInputs: startArgs?.validateInputs ?? options?.validateInputs ?? true,
      graph: {
        id: workflowId,
        steps: stepFlow,
      },
      input: startArgs?.inputData,
      initialState: startArgs?.initialState,
      recordStepMeta: startArgs?.recordStepMeta,
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
    thenWorkflow(workflowType, id) {
      stepFlow.push({
        type: 'childWorkflow',
        workflowType,
        id,
      });
      return workflow;
    },
    map(mappingId) {
      stepFlow.push({
        type: 'mapping',
        id: mappingId,
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
    parallel(entries) {
      stepFlow.push({
        type: 'parallel',
        steps: entries,
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
