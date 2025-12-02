const require_rolldown_runtime = require('../../_virtual/rolldown_runtime.cjs');
const require_consts = require('../../helpers/consts.cjs');
const require_version = require('../../version.cjs');
const require_NonRetriableError = require('../NonRetriableError.cjs');
const require_errors = require('../../helpers/errors.cjs');
const require_types = require('../../types.cjs');
const require_InngestExecution = require('./InngestExecution.cjs');
const require_functions = require('../../helpers/functions.cjs');
const require_promises = require('../../helpers/promises.cjs');
const require_als = require('./als.cjs');
const require_InngestMiddleware = require('../InngestMiddleware.cjs');
const require_access = require('./otel/access.cjs');
const require_RetryAfterError = require('../RetryAfterError.cjs');
const require_StepError = require('../StepError.cjs');
const require_InngestStepTools = require('../InngestStepTools.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);
let hash_js = require("hash.js");
hash_js = require_rolldown_runtime.__toESM(hash_js);
let __opentelemetry_api = require("@opentelemetry/api");
__opentelemetry_api = require_rolldown_runtime.__toESM(__opentelemetry_api);

//#region src/components/execution/v2.ts
var v2_exports = /* @__PURE__ */ require_rolldown_runtime.__export({
	_internals: () => _internals,
	createV2InngestExecution: () => createV2InngestExecution
});
const { sha1 } = hash_js.default;
const createV2InngestExecution = (options) => {
	return new V2InngestExecution(options);
};
var V2InngestExecution = class extends require_InngestExecution.InngestExecution {
	state;
	fnArg;
	checkpointHandlers;
	timeoutDuration = 1e3 * 10;
	execution;
	userFnToRun;
	/**
	* If we're supposed to run a particular step via `requestedRunStep`, this
	* will be a `Promise` that resolves after no steps have been found for
	* `timeoutDuration` milliseconds.
	*
	* If we're not supposed to run a particular step, this will be `undefined`.
	*/
	timeout;
	constructor(options) {
		super(options);
		this.userFnToRun = this.getUserFnToRun();
		this.state = this.createExecutionState();
		this.fnArg = this.createFnArg();
		this.checkpointHandlers = this.createCheckpointHandlers();
		this.initializeTimer(this.state);
		this.debug("created new V2 execution for run;", this.options.requestedRunStep ? `wanting to run step "${this.options.requestedRunStep}"` : "discovering steps");
		this.debug("existing state keys:", Object.keys(this.state.stepState));
	}
	/**
	* Idempotently start the execution of the user's function.
	*/
	start() {
		if (!this.execution) {
			this.debug("starting V2 execution");
			const tracer = __opentelemetry_api.trace.getTracer("inngest", require_version.version);
			this.execution = require_als.getAsyncLocalStorage().then((als) => {
				return als.run({
					app: this.options.client,
					ctx: this.fnArg
				}, async () => {
					return tracer.startActiveSpan("inngest.execution", (span) => {
						require_access.clientProcessorMap.get(this.options.client)?.declareStartingSpan({
							span,
							runId: this.options.runId,
							traceparent: this.options.headers[require_consts.headerKeys.TraceParent],
							tracestate: this.options.headers[require_consts.headerKeys.TraceState]
						});
						return this._start().then((result) => {
							this.debug("result:", result);
							return result;
						}).finally(() => {
							span.end();
						});
					});
				});
			});
		}
		return this.execution;
	}
	/**
	* Starts execution of the user's function and the core loop.
	*/
	async _start() {
		try {
			const allCheckpointHandler = this.getCheckpointHandler("");
			this.state.hooks = await this.initializeMiddleware();
			await this.startExecution();
			for await (const checkpoint of this.state.loop) {
				await allCheckpointHandler(checkpoint);
				const result = await this.getCheckpointHandler(checkpoint.type)(checkpoint);
				if (result) return result;
			}
		} catch (error) {
			return await this.transformOutput({ error });
		} finally {
			this.state.loop.return();
			await this.state.hooks?.beforeResponse?.();
		}
		/**
		* If we're here, the generator somehow finished without returning a value.
		* This should never happen.
		*/
		throw new Error("Core loop finished without returning a value");
	}
	/**
	* Creates a handler for every checkpoint type, defining what to do when we
	* reach that checkpoint in the core loop.
	*/
	createCheckpointHandlers() {
		return {
			"": (checkpoint) => {
				this.debug("checkpoint:", checkpoint);
			},
			"function-resolved": async (checkpoint) => {
				return await this.transformOutput({ data: checkpoint.data });
			},
			"function-rejected": async (checkpoint) => {
				return await this.transformOutput({ error: checkpoint.error });
			},
			"steps-found": async ({ steps }) => {
				const stepResult = await this.tryExecuteStep(steps);
				if (stepResult) {
					const transformResult = await this.transformOutput(stepResult);
					/**
					* Transforming output will always return either function rejection or
					* resolution. In most cases, this can be immediately returned, but in
					* this particular case we want to handle it differently.
					*/
					if (transformResult.type === "function-resolved") return {
						type: "step-ran",
						ctx: transformResult.ctx,
						ops: transformResult.ops,
						step: _internals.hashOp({
							...stepResult,
							data: transformResult.data
						})
					};
					else if (transformResult.type === "function-rejected") {
						const stepForResponse = _internals.hashOp({
							...stepResult,
							error: transformResult.error
						});
						if (stepResult.op === require_types.StepOpCode.StepFailed) {
							const ser = require_errors.serializeError(transformResult.error);
							stepForResponse.data = {
								__serialized: true,
								name: ser.name,
								message: ser.message,
								stack: ""
							};
						}
						return {
							type: "step-ran",
							ctx: transformResult.ctx,
							ops: transformResult.ops,
							retriable: transformResult.retriable,
							step: stepForResponse
						};
					}
					return transformResult;
				}
				const newSteps = await this.filterNewSteps(Array.from(this.state.steps.values()));
				if (newSteps) return {
					type: "steps-found",
					ctx: this.fnArg,
					ops: this.ops,
					steps: newSteps
				};
			},
			"step-not-found": ({ step }) => {
				return {
					type: "step-not-found",
					ctx: this.fnArg,
					ops: this.ops,
					step
				};
			}
		};
	}
	getCheckpointHandler(type) {
		return this.checkpointHandlers[type];
	}
	async tryExecuteStep(steps) {
		const hashedStepIdToRun = this.options.requestedRunStep || this.getEarlyExecRunStep(steps);
		if (!hashedStepIdToRun) return;
		const step = steps.find((step$1) => step$1.hashedId === hashedStepIdToRun && step$1.fn);
		if (step) return await this.executeStep(step);
		this.timeout?.reset();
	}
	/**
	* Given a list of outgoing ops, decide if we can execute an op early and
	* return the ID of the step to execute if we can.
	*/
	getEarlyExecRunStep(steps) {
		/**
		* We may have been disabled due to parallelism, in which case we can't
		* immediately execute unless explicitly requested.
		*/
		if (this.options.disableImmediateExecution) return;
		const unfulfilledSteps = steps.filter((step) => !step.fulfilled);
		if (unfulfilledSteps.length !== 1) return;
		const op = unfulfilledSteps[0];
		if (op && op.op === require_types.StepOpCode.StepPlanned) return op.hashedId;
	}
	async filterNewSteps(foundSteps) {
		if (this.options.requestedRunStep) return;
		/**
		* Gather any steps that aren't memoized and report them.
		*/
		const newSteps = foundSteps.filter((step) => !step.fulfilled);
		if (!newSteps.length) return;
		/**
		* Warn if we've found new steps but haven't yet seen all previous
		* steps. This may indicate that step presence isn't determinate.
		*/
		let knownSteps = 0;
		for (const step of foundSteps) if (step.fulfilled) knownSteps++;
		if (!(this.state.stepsToFulfill === knownSteps)) console.warn(require_errors.prettyError({
			type: "warn",
			whatHappened: "Function may be indeterminate",
			why: "We found new steps before seeing all previous steps, which may indicate that the function is non-deterministic.",
			consequences: "This may cause unexpected behaviour as Inngest executes your function.",
			reassurance: "This is expected if a function is updated in the middle of a run, but may indicate a bug if not."
		}));
		/**
		* We're finishing up; let's trigger the last of the hooks.
		*/
		await this.state.hooks?.afterMemoization?.();
		await this.state.hooks?.beforeExecution?.();
		await this.state.hooks?.afterExecution?.();
		const stepList = newSteps.map((step) => ({
			displayName: step.displayName,
			op: step.op,
			id: step.hashedId,
			name: step.name,
			opts: step.opts
		}));
		/**
		* We also run `onSendEvent` middleware hooks against `step.invoke()` steps
		* to ensure that their `data` is transformed correctly.
		*/
		return await this.transformNewSteps(stepList);
	}
	/**
	* Using middleware, transform any newly-found steps before returning them to
	* an Inngest Server.
	*/
	async transformNewSteps(steps) {
		return Promise.all(steps.map(async (step) => {
			if (step.op !== require_types.StepOpCode.InvokeFunction) return step;
			/**
			* For each event being sent, create a new `onSendEvent` hook stack to
			* process it. We do this as middleware hooks are intended to run once
			* during each lifecycle (onFunctionRun or onSendEvent) and here, a hook
			* is run for every single event.
			*
			* This is done because a developer can use this hook to filter out
			* events entirely; if we batch all of the events together, we can't
			* tell which ones were filtered out if we're processing >1 invocation
			* here.
			*/
			const transformedPayload = await (await require_InngestMiddleware.getHookStack(this.options.fn["middleware"], "onSendEvent", void 0, {
				transformInput: (prev, output) => {
					return {
						...prev,
						...output
					};
				},
				transformOutput: (prev, output) => {
					return { result: {
						...prev.result,
						...output?.result
					} };
				}
			})).transformInput?.({ payloads: [{
				...step.opts?.payload ?? {},
				name: require_consts.internalEvents.FunctionInvoked
			}] });
			const newPayload = require_InngestStepTools.invokePayloadSchema.parse(transformedPayload?.payloads?.[0] ?? {});
			return {
				...step,
				opts: {
					...step.opts,
					payload: {
						...step.opts?.payload ?? {},
						...newPayload
					}
				}
			};
		}));
	}
	async executeStep({ id, name, opts, fn, displayName }) {
		this.timeout?.clear();
		await this.state.hooks?.afterMemoization?.();
		await this.state.hooks?.beforeExecution?.();
		const outgoingOp = {
			id,
			op: require_types.StepOpCode.StepRun,
			name,
			opts,
			displayName
		};
		this.state.executingStep = outgoingOp;
		const store = await require_als.getAsyncCtx();
		if (store) store.executingStep = {
			id,
			name: displayName
		};
		this.debug(`executing step "${id}"`);
		return require_promises.runAsPromise(fn).finally(async () => {
			if (store) delete store.executingStep;
			await this.state.hooks?.afterExecution?.();
		}).then((data) => {
			return {
				...outgoingOp,
				data
			};
		}).catch((error) => {
			let errorIsRetriable = true;
			if (error instanceof require_NonRetriableError.NonRetriableError) errorIsRetriable = false;
			else if (this.fnArg.maxAttempts && this.fnArg?.maxAttempts - 1 === this.fnArg.attempt) errorIsRetriable = false;
			if (errorIsRetriable) return {
				...outgoingOp,
				op: require_types.StepOpCode.StepError,
				error
			};
			else return {
				...outgoingOp,
				op: require_types.StepOpCode.StepFailed,
				error
			};
		});
	}
	/**
	* Starts execution of the user's function, including triggering checkpoints
	* and middleware hooks where appropriate.
	*/
	async startExecution() {
		/**
		* Mutate input as neccessary based on middleware.
		*/
		await this.transformInput();
		/**
		* Start the timer to time out the run if needed.
		*/
		this.timeout?.start();
		await this.state.hooks?.beforeMemoization?.();
		/**
		* If we had no state to begin with, immediately end the memoization phase.
		*/
		if (this.state.allStateUsed()) {
			await this.state.hooks?.afterMemoization?.();
			await this.state.hooks?.beforeExecution?.();
		}
		/**
		* Trigger the user's function.
		*/
		require_promises.runAsPromise(() => this.userFnToRun(this.fnArg)).finally(async () => {
			await this.state.hooks?.afterMemoization?.();
			await this.state.hooks?.beforeExecution?.();
			await this.state.hooks?.afterExecution?.();
		}).then((data) => {
			this.state.setCheckpoint({
				type: "function-resolved",
				data
			});
		}).catch((error) => {
			this.state.setCheckpoint({
				type: "function-rejected",
				error
			});
		});
	}
	/**
	* Using middleware, transform input before running.
	*/
	async transformInput() {
		const inputMutations = await this.state.hooks?.transformInput?.({
			ctx: { ...this.fnArg },
			steps: Object.values(this.state.stepState),
			fn: this.options.fn,
			reqArgs: this.options.reqArgs
		});
		if (inputMutations?.ctx) this.fnArg = inputMutations.ctx;
		if (inputMutations?.steps) this.state.stepState = Object.fromEntries(inputMutations.steps.map((step) => [step.id, step]));
	}
	/**
	* Using middleware, transform output before returning.
	*/
	async transformOutput(dataOrError) {
		const output = { ...dataOrError };
		const isStepExecution = Boolean(this.state.executingStep);
		const transformedOutput = await this.state.hooks?.transformOutput?.({
			result: { ...output },
			step: this.state.executingStep
		});
		const { data, error } = {
			...output,
			...transformedOutput?.result
		};
		if (!isStepExecution) await this.state.hooks?.finished?.({ result: { ...typeof error !== "undefined" ? { error } : { data } } });
		if (typeof error !== "undefined") {
			/**
			* Ensure we give middleware the chance to decide on retriable behaviour
			* by looking at the error returned from output transformation.
			*/
			let retriable = !(error instanceof require_NonRetriableError.NonRetriableError || error instanceof require_StepError.StepError && error === this.state.recentlyRejectedStepError);
			if (retriable && error instanceof require_RetryAfterError.RetryAfterError) retriable = error.retryAfter;
			const serializedError = require_errors.minifyPrettyError(require_errors.serializeError(error));
			return {
				type: "function-rejected",
				ctx: this.fnArg,
				ops: this.ops,
				error: serializedError,
				retriable
			};
		}
		return {
			type: "function-resolved",
			ctx: this.fnArg,
			ops: this.ops,
			data: require_functions.undefinedToNull(data)
		};
	}
	createExecutionState() {
		const d = require_promises.createDeferredPromiseWithStack();
		let checkpointResolve = d.deferred.resolve;
		const checkpointResults = d.results;
		const loop = (async function* (cleanUp) {
			try {
				while (true) {
					const res = (await checkpointResults.next()).value;
					if (res) yield res;
				}
			} finally {
				cleanUp?.();
			}
		})(() => {
			this.timeout?.clear();
			checkpointResults.return();
		});
		const stepsToFulfill = Object.keys(this.options.stepState).length;
		return {
			stepState: this.options.stepState,
			stepsToFulfill,
			steps: /* @__PURE__ */ new Map(),
			loop,
			hasSteps: Boolean(stepsToFulfill),
			stepCompletionOrder: [...this.options.stepCompletionOrder],
			remainingStepsToBeSeen: new Set(this.options.stepCompletionOrder),
			setCheckpoint: (checkpoint) => {
				({resolve: checkpointResolve} = checkpointResolve(checkpoint));
			},
			allStateUsed: () => {
				return this.state.remainingStepsToBeSeen.size === 0;
			}
		};
	}
	get ops() {
		return Object.fromEntries(this.state.steps);
	}
	createFnArg() {
		const step = this.createStepTools();
		let fnArg = {
			...this.options.data,
			step
		};
		/**
		* Handle use of the `onFailure` option by deserializing the error.
		*/
		if (this.options.isFailureHandler) {
			const eventData = zod_v3.z.object({ error: require_types.jsonErrorSchema }).parse(fnArg.event?.data);
			fnArg = {
				...fnArg,
				error: require_errors.deserializeError(eventData.error)
			};
		}
		return this.options.transformCtx?.(fnArg) ?? fnArg;
	}
	createStepTools() {
		/**
		* A list of steps that have been found and are being rolled up before being
		* reported to the core loop.
		*/
		const foundStepsToReport = /* @__PURE__ */ new Map();
		/**
		* A map of the subset of found steps to report that have not yet been
		* handled. Used for fast access to steps that need to be handled in order.
		*/
		const unhandledFoundStepsToReport = /* @__PURE__ */ new Map();
		/**
		* A map of the latest sequential step indexes found for each step ID. Used
		* to ensure that we don't index steps in parallel.
		*
		* Note that these must be sequential; if we've seen or assigned `a:1`,
		* `a:2` and `a:4`, the latest sequential step index is `2`.
		*
		*/
		const expectedNextStepIndexes = /* @__PURE__ */ new Map();
		/**
		* A promise that's used to ensure that step reporting cannot be run more than
		* once in a given asynchronous time span.
		*/
		let foundStepsReportPromise;
		/**
		* A promise that's used to represent middleware hooks running before
		* execution.
		*/
		let beforeExecHooksPromise;
		/**
		* A helper used to report steps to the core loop. Used after adding an item
		* to `foundStepsToReport`.
		*/
		const reportNextTick = () => {
			if (foundStepsReportPromise) return;
			foundStepsReportPromise = new Promise((resolve) => setImmediate(resolve)).then(() => beforeExecHooksPromise).then(() => {
				foundStepsReportPromise = void 0;
				for (const [hashedId, step] of unhandledFoundStepsToReport) if (step.handle()) {
					unhandledFoundStepsToReport.delete(hashedId);
					if (step.fulfilled) foundStepsToReport.delete(step.id);
				}
				if (foundStepsToReport.size) {
					const steps = [...foundStepsToReport.values()];
					foundStepsToReport.clear();
					this.state.setCheckpoint({
						type: "steps-found",
						steps
					});
					return;
				}
			});
		};
		/**
		* A helper used to push a step to the list of steps to report.
		*/
		const pushStepToReport = (step) => {
			foundStepsToReport.set(step.id, step);
			unhandledFoundStepsToReport.set(step.hashedId, step);
			reportNextTick();
		};
		const stepHandler = async ({ args, matchOp, opts }) => {
			await beforeExecHooksPromise;
			const stepOptions = require_InngestStepTools.getStepOptions(args[0]);
			const opId = matchOp(stepOptions, ...args.slice(1));
			if (this.state.executingStep)
 /**
			* If a step is found after asynchronous actions during another step's
			* execution, everything is fine. The problem here is if we've found
			* that a step nested inside another a step, which is something we don't
			* support at the time of writing.
			*
			* In this case, we could use something like Async Hooks to understand
			* how the step is being triggered, though this isn't available in all
			* environments.
			*
			* Therefore, we'll only show a warning here to indicate that this is
			* potentially an issue.
			*/
			console.warn(require_errors.prettyError({
				whatHappened: `We detected that you have nested \`step.*\` tooling in \`${opId.displayName ?? opId.id}\``,
				consequences: "Nesting `step.*` tooling is not supported.",
				type: "warn",
				reassurance: "It's possible to see this warning if steps are separated by regular asynchronous calls, which is fine.",
				stack: true,
				toFixNow: "Make sure you're not using `step.*` tooling inside of other `step.*` tooling. If you need to compose steps together, you can create a new async function and call it from within your step function, or use promise chaining.",
				code: require_errors.ErrCode.NESTING_STEPS
			}));
			if (this.state.steps.has(opId.id)) {
				const originalId = opId.id;
				const expectedNextIndex = expectedNextStepIndexes.get(originalId) ?? 1;
				for (let i = expectedNextIndex;; i++) {
					const newId = originalId + require_InngestStepTools.STEP_INDEXING_SUFFIX + i;
					if (!this.state.steps.has(newId)) {
						expectedNextStepIndexes.set(originalId, i + 1);
						opId.id = newId;
						break;
					}
				}
			}
			const { promise, resolve, reject } = require_promises.createDeferredPromise();
			const hashedId = _internals.hashId(opId.id);
			const stepState = this.state.stepState[hashedId];
			let isFulfilled = false;
			if (stepState) {
				stepState.seen = true;
				this.state.remainingStepsToBeSeen.delete(hashedId);
				if (typeof stepState.input === "undefined") isFulfilled = true;
			}
			let extraOpts;
			let fnArgs = [...args];
			if (typeof stepState?.input !== "undefined" && Array.isArray(stepState.input)) switch (opId.op) {
				case require_types.StepOpCode.StepPlanned:
					fnArgs = [...args.slice(0, 2), ...stepState.input];
					extraOpts = { input: [...stepState.input] };
					break;
				case require_types.StepOpCode.AiGateway:
					extraOpts = { body: {
						...typeof opId.opts?.body === "object" ? { ...opId.opts.body } : {},
						...stepState.input[0]
					} };
					break;
			}
			const step = {
				...opId,
				opts: {
					...opId.opts,
					...extraOpts
				},
				rawArgs: fnArgs,
				hashedId,
				input: stepState?.input,
				fn: opts?.fn ? () => opts.fn?.(...fnArgs) : void 0,
				promise,
				fulfilled: isFulfilled,
				hasStepState: Boolean(stepState),
				displayName: opId.displayName ?? opId.id,
				handled: false,
				handle: () => {
					if (step.handled) return false;
					step.handled = true;
					if (isFulfilled && stepState) {
						stepState.fulfilled = true;
						Promise.all([
							stepState.data,
							stepState.error,
							stepState.input
						]).then(() => {
							if (typeof stepState.data !== "undefined") resolve(stepState.data);
							else {
								this.state.recentlyRejectedStepError = new require_StepError.StepError(opId.id, stepState.error);
								reject(this.state.recentlyRejectedStepError);
							}
						});
					}
					return true;
				}
			};
			this.state.steps.set(opId.id, step);
			this.state.hasSteps = true;
			pushStepToReport(step);
			/**
			* If this is the last piece of state we had, we've now finished
			* memoizing.
			*/
			if (!beforeExecHooksPromise && this.state.allStateUsed()) await (beforeExecHooksPromise = (async () => {
				await this.state.hooks?.afterMemoization?.();
				await this.state.hooks?.beforeExecution?.();
			})());
			return promise;
		};
		return require_InngestStepTools.createStepTools(this.options.client, this, stepHandler);
	}
	getUserFnToRun() {
		if (!this.options.isFailureHandler) return this.options.fn["fn"];
		if (!this.options.fn["onFailureFn"])
 /**
		* Somehow, we've ended up detecting that this is a failure handler but
		* doesn't have an `onFailure` function. This should never happen.
		*/
		throw new Error("Cannot find function `onFailure` handler");
		return this.options.fn["onFailureFn"];
	}
	initializeTimer(state) {
		if (!this.options.requestedRunStep) return;
		this.timeout = require_promises.createTimeoutPromise(this.timeoutDuration);
		this.timeout.then(async () => {
			await this.state.hooks?.afterMemoization?.();
			await this.state.hooks?.beforeExecution?.();
			await this.state.hooks?.afterExecution?.();
			state.setCheckpoint({
				type: "step-not-found",
				step: {
					id: this.options.requestedRunStep,
					op: require_types.StepOpCode.StepNotFound
				}
			});
		});
	}
	async initializeMiddleware() {
		const ctx = this.options.data;
		return await require_InngestMiddleware.getHookStack(this.options.fn["middleware"], "onFunctionRun", {
			ctx,
			fn: this.options.fn,
			steps: Object.values(this.options.stepState),
			reqArgs: this.options.reqArgs
		}, {
			transformInput: (prev, output) => {
				return {
					ctx: {
						...prev.ctx,
						...output?.ctx
					},
					fn: this.options.fn,
					steps: prev.steps.map((step, i) => ({
						...step,
						...output?.steps?.[i]
					})),
					reqArgs: prev.reqArgs
				};
			},
			transformOutput: (prev, output) => {
				return {
					result: {
						...prev.result,
						...output?.result
					},
					step: prev.step
				};
			}
		});
	}
};
const hashId = (id) => {
	return sha1().update(id).digest("hex");
};
const hashOp = (op) => {
	return {
		...op,
		id: hashId(op.id)
	};
};
/**
* Exported for testing.
*/
const _internals = {
	hashOp,
	hashId
};

//#endregion
exports.createV2InngestExecution = createV2InngestExecution;
Object.defineProperty(exports, 'v2_exports', {
  enumerable: true,
  get: function () {
    return v2_exports;
  }
});
//# sourceMappingURL=v2.cjs.map