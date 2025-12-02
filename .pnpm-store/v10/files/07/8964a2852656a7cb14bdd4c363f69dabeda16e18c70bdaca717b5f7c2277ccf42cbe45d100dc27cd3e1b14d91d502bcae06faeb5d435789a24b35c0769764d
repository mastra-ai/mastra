const require_rolldown_runtime = require('../../_virtual/rolldown_runtime.cjs');
const require_NonRetriableError = require('../NonRetriableError.cjs');
const require_errors = require('../../helpers/errors.cjs');
const require_types = require('../../types.cjs');
const require_InngestExecution = require('./InngestExecution.cjs');
const require_functions = require('../../helpers/functions.cjs');
const require_promises = require('../../helpers/promises.cjs');
const require_InngestMiddleware = require('../InngestMiddleware.cjs');
const require_RetryAfterError = require('../RetryAfterError.cjs');
const require_InngestStepTools = require('../InngestStepTools.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);
let hash_js = require("hash.js");
hash_js = require_rolldown_runtime.__toESM(hash_js);
let canonicalize = require("canonicalize");
canonicalize = require_rolldown_runtime.__toESM(canonicalize);

//#region src/components/execution/v0.ts
var v0_exports = /* @__PURE__ */ require_rolldown_runtime.__export({
	V0InngestExecution: () => V0InngestExecution,
	_internals: () => _internals,
	createV0InngestExecution: () => createV0InngestExecution
});
const { sha1 } = hash_js.default;
const createV0InngestExecution = (options) => {
	return new V0InngestExecution(options);
};
var V0InngestExecution = class extends require_InngestExecution.InngestExecution {
	state;
	execution;
	userFnToRun;
	fnArg;
	constructor(options) {
		super(options);
		this.userFnToRun = this.getUserFnToRun();
		this.state = this.createExecutionState();
		this.fnArg = this.createFnArg();
	}
	start() {
		this.debug("starting V0 execution");
		return this.execution ??= this._start().then((result) => {
			this.debug("result:", result);
			return result;
		});
	}
	async _start() {
		this.state.hooks = await this.initializeMiddleware();
		try {
			await this.transformInput();
			await this.state.hooks.beforeMemoization?.();
			if (this.state.opStack.length === 0 && !this.options.requestedRunStep) {
				await this.state.hooks.afterMemoization?.();
				await this.state.hooks.beforeExecution?.();
			}
			const userFnPromise = require_promises.runAsPromise(() => this.userFnToRun(this.fnArg));
			let pos = -1;
			do {
				if (pos >= 0) {
					if (!this.options.requestedRunStep && pos === this.state.opStack.length - 1) {
						await this.state.hooks.afterMemoization?.();
						await this.state.hooks.beforeExecution?.();
					}
					this.state.tickOps = {};
					const incomingOp = this.state.opStack[pos];
					this.state.currentOp = this.state.allFoundOps[incomingOp.id];
					if (!this.state.currentOp)
 /**
					* We're trying to resume the function, but we can't find where to go.
					*
					* This means that either the function has changed or there are async
					* actions in-between steps that we haven't noticed in previous
					* executions.
					*
					* Whichever the case, this is bad and we can't continue in this
					* undefined state.
					*/
					throw new require_NonRetriableError.NonRetriableError(require_errors.prettyError({
						whatHappened: " Your function was stopped from running",
						why: "We couldn't resume your function's state because it may have changed since the run started or there are async actions in-between steps that we haven't noticed in previous executions.",
						consequences: "Continuing to run the function may result in unexpected behaviour, so we've stopped your function to ensure nothing unexpected happened!",
						toFixNow: "Ensure that your function is either entirely step-based or entirely non-step-based, by either wrapping all asynchronous logic in `step.run()` calls or by removing all `step.*()` calls.",
						otherwise: "For more information on why step functions work in this manner, see https://www.inngest.com/docs/functions/multi-step#gotchas",
						stack: true,
						code: require_errors.ErrCode.NON_DETERMINISTIC_FUNCTION
					}));
					this.state.currentOp.fulfilled = true;
					if (typeof incomingOp.data !== "undefined") this.state.currentOp.resolve(incomingOp.data);
					else this.state.currentOp.reject(incomingOp.error);
				}
				await require_promises.resolveAfterPending();
				this.state.reset();
				pos++;
			} while (pos < this.state.opStack.length);
			await this.state.hooks.afterMemoization?.();
			const discoveredOps = Object.values(this.state.tickOps).map(tickOpToOutgoing);
			const runStep = this.options.requestedRunStep || this.getEarlyExecRunStep(discoveredOps);
			if (runStep) {
				const userFnOp = this.state.allFoundOps[runStep];
				const stepToRun = userFnOp?.fn;
				if (!stepToRun) throw new Error(`Bad stack; executor requesting to run unknown step "${runStep}"`);
				const outgoingUserFnOp = {
					...tickOpToOutgoing(userFnOp),
					op: require_types.StepOpCode.Step
				};
				await this.state.hooks.beforeExecution?.();
				this.state.executingStep = true;
				const { type: _type,...rest } = await require_promises.runAsPromise(stepToRun).finally(() => {
					this.state.executingStep = false;
				}).catch(async (error) => {
					return await this.transformOutput({ error }, outgoingUserFnOp);
				}).then(async (data) => {
					await this.state.hooks?.afterExecution?.();
					return await this.transformOutput({ data }, outgoingUserFnOp);
				});
				return {
					type: "step-ran",
					ctx: this.fnArg,
					ops: this.ops,
					step: {
						...outgoingUserFnOp,
						...rest
					}
				};
			}
			if (!discoveredOps.length) {
				const fnRet = await Promise.race([userFnPromise.then((data) => ({
					type: "complete",
					data
				})), require_promises.resolveNextTick().then(() => ({ type: "incomplete" }))]);
				if (fnRet.type === "complete") {
					await this.state.hooks.afterExecution?.();
					if (Object.values(this.state.allFoundOps).every((op) => {
						return op.fulfilled;
					})) return await this.transformOutput({ data: fnRet.data });
				} else if (!this.state.hasUsedTools) {
					this.state.nonStepFnDetected = true;
					const data = await userFnPromise;
					await this.state.hooks.afterExecution?.();
					return await this.transformOutput({ data });
				} else if (!Object.values(this.state.allFoundOps).some((op) => {
					return op.fulfilled === false;
				})) throw new require_NonRetriableError.NonRetriableError(require_errors.functionStoppedRunningErr(require_errors.ErrCode.ASYNC_DETECTED_AFTER_MEMOIZATION));
			}
			await this.state.hooks.afterExecution?.();
			return {
				type: "steps-found",
				ctx: this.fnArg,
				ops: this.ops,
				steps: discoveredOps
			};
		} catch (error) {
			return await this.transformOutput({ error });
		} finally {
			await this.state.hooks.beforeResponse?.();
		}
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
	createExecutionState() {
		const state = {
			allFoundOps: {},
			tickOps: {},
			tickOpHashes: {},
			currentOp: void 0,
			hasUsedTools: false,
			reset: () => {
				state.tickOpHashes = {};
				state.allFoundOps = {
					...state.allFoundOps,
					...state.tickOps
				};
			},
			nonStepFnDetected: false,
			executingStep: false,
			opStack: this.options.stepCompletionOrder.reduce((acc, stepId) => {
				const stepState = this.options.stepState[stepId];
				if (!stepState) return acc;
				return [...acc, stepState];
			}, [])
		};
		return state;
	}
	get ops() {
		return Object.fromEntries(Object.entries(this.state.allFoundOps).map(([id, op]) => [id, {
			id: op.id,
			rawArgs: op.rawArgs,
			data: op.data,
			error: op.error,
			fulfilled: op.fulfilled,
			seen: true
		}]));
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
	createFnArg() {
		this.state.tickOps = this.state.allFoundOps;
		/**
		* Create a unique hash of an operation using only a subset of the operation's
		* properties; will never use `data` and will guarantee the order of the
		* object so we don't rely on individual tools for that.
		*
		* If the operation already contains an ID, the current ID will be used
		* instead, so that users can provide their own IDs.
		*/
		const hashOp = (op) => {
			/**
			* It's difficult for v0 to understand whether or not an op has
			* historically contained a custom ID, as all step usage now require them.
			*
			* For this reason, we make the assumption that steps in v0 do not have a
			* custom ID and generate one for them as we would in all recommendations
			* and examples.
			*/
			const obj = {
				parent: this.state.currentOp?.id ?? null,
				op: op.op,
				name: op.name,
				opts: op.op === require_types.StepOpCode.StepPlanned ? null : op.opts ?? null
			};
			const collisionHash = _internals.hashData(obj);
			const pos = this.state.tickOpHashes[collisionHash] = (this.state.tickOpHashes[collisionHash] ?? -1) + 1;
			return {
				...op,
				id: _internals.hashData({
					pos,
					...obj
				})
			};
		};
		const stepHandler = ({ args, matchOp, opts }) => {
			if (this.state.nonStepFnDetected) throw new require_NonRetriableError.NonRetriableError(require_errors.functionStoppedRunningErr(require_errors.ErrCode.STEP_USED_AFTER_ASYNC));
			if (this.state.executingStep) throw new require_NonRetriableError.NonRetriableError(require_errors.prettyError({
				whatHappened: "Your function was stopped from running",
				why: "We detected that you have nested `step.*` tooling.",
				consequences: "Nesting `step.*` tooling is not supported.",
				stack: true,
				toFixNow: "Make sure you're not using `step.*` tooling inside of other `step.*` tooling. If you need to compose steps together, you can create a new async function and call it from within your step function, or use promise chaining.",
				otherwise: "For more information on step functions with Inngest, see https://www.inngest.com/docs/functions/multi-step",
				code: require_errors.ErrCode.NESTING_STEPS
			}));
			this.state.hasUsedTools = true;
			const stepOptions = require_InngestStepTools.getStepOptions(args[0]);
			const opId = hashOp(matchOp(stepOptions, ...args.slice(1)));
			return new Promise((resolve, reject) => {
				this.state.tickOps[opId.id] = {
					...opId,
					...opts?.fn ? { fn: () => opts.fn?.(...args) } : {},
					rawArgs: args,
					resolve,
					reject,
					fulfilled: false
				};
			});
		};
		const step = require_InngestStepTools.createStepTools(this.options.client, this, stepHandler);
		let fnArg = {
			...this.options.data,
			step
		};
		if (this.options.isFailureHandler) {
			const eventData = zod_v3.z.object({ error: require_types.jsonErrorSchema }).parse(fnArg.event?.data);
			fnArg = {
				...fnArg,
				error: require_errors.deserializeError(eventData.error)
			};
		}
		return this.options.transformCtx?.(fnArg) ?? fnArg;
	}
	/**
	* Using middleware, transform input before running.
	*/
	async transformInput() {
		const inputMutations = await this.state.hooks?.transformInput?.({
			ctx: { ...this.fnArg },
			steps: Object.values(this.options.stepState),
			fn: this.options.fn,
			reqArgs: this.options.reqArgs
		});
		if (inputMutations?.ctx) this.fnArg = inputMutations.ctx;
		if (inputMutations?.steps) this.state.opStack = [...inputMutations.steps];
	}
	getEarlyExecRunStep(ops) {
		if (ops.length !== 1) return;
		const op = ops[0];
		if (op && op.op === require_types.StepOpCode.StepPlanned) return op.id;
	}
	/**
	* Using middleware, transform output before returning.
	*/
	async transformOutput(dataOrError, step) {
		const output = { ...dataOrError };
		if (typeof output.error !== "undefined") output.data = require_errors.serializeError(output.error);
		const transformedOutput = await this.state.hooks?.transformOutput?.({
			result: { ...output },
			step
		});
		const { data, error } = {
			...output,
			...transformedOutput?.result
		};
		if (!step) await this.state.hooks?.finished?.({ result: { ...typeof error !== "undefined" ? { error } : { data } } });
		if (typeof error !== "undefined") {
			/**
			* Ensure we give middleware the chance to decide on retriable behaviour
			* by looking at the error returned from output transformation.
			*/
			let retriable = !(error instanceof require_NonRetriableError.NonRetriableError);
			if (retriable && error instanceof require_RetryAfterError.RetryAfterError) retriable = error.retryAfter;
			const serializedError = require_errors.serializeError(error);
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
};
const tickOpToOutgoing = (op) => {
	return {
		op: op.op,
		id: op.id,
		name: op.name,
		opts: op.opts
	};
};
const hashData = (op) => {
	return sha1().update((0, canonicalize.default)(op)).digest("hex");
};
/**
* Exported for testing.
*/
const _internals = { hashData };

//#endregion
exports.createV0InngestExecution = createV0InngestExecution;
Object.defineProperty(exports, 'v0_exports', {
  enumerable: true,
  get: function () {
    return v0_exports;
  }
});
//# sourceMappingURL=v0.cjs.map