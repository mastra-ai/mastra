import { ExclusiveKeys, ParametersExceptFirst, SendEventPayload, SimplifyDeep, WithoutInternalStr } from "../helpers/types.js";
import { InngestExecution } from "./execution/InngestExecution.js";
import { StepFetch } from "./Fetch.js";
import { Jsonify } from "../helpers/jsonify.js";
import { DurationLike, InstantLike, ZonedDateTimeLike } from "../helpers/temporal.js";
import { EventPayload, HashedOp, InvocationResult, InvokeTargetFunctionDefinition, SendEventOutput, StepOptions, StepOptionsOrId, TriggerEventFromFunction, TriggersFromClient } from "../types.js";
import { ClientOptionsFromInngest, GetEvents, GetFunctionOutput, Inngest } from "./Inngest.js";
import { z } from "zod/v3";
import { AiAdapter, models } from "@inngest/ai";

//#region src/components/InngestStepTools.d.ts
interface FoundStep extends HashedOp {
  hashedId: string;
  fn?: (...args: unknown[]) => unknown;
  rawArgs: unknown[];
  /**
   * A boolean representing whether the step has been fulfilled, either
   * resolving or rejecting the `Promise` returned to userland code.
   *
   * Note that this is distinct from {@link hasStepState}, which instead tracks
   * whether the step has been given some state from the Executor. State from
   * the Executor could be data other than a resolution or rejection, such as
   * inputs.
   */
  fulfilled: boolean;
  /**
   * A boolean representing whether the step has been given some state from the
   * Executor. State from the Executor could be data other than a resolution or
   * rejection, such as inputs.
   *
   * This is distinct from {@link fulfilled}, which instead tracks whether the
   * step has been fulfilled, either resolving or rejecting the `Promise`
   * returned to userland code.
   */
  hasStepState: boolean;
  handled: boolean;
  /**
   * The promise that has been returned to userland code for this step.
   */
  promise: Promise<unknown>;
  /**
   * Returns a boolean representing whether or not the step was handled on this
   * invocation.
   */
  handle: () => boolean;
  input?: unknown;
}
type MatchOpFn<T extends (...args: unknown[]) => Promise<unknown> = (...args: unknown[]) => Promise<unknown>> = (stepOptions: StepOptions,
/**
 * Arguments passed by the user.
 */
...args: ParametersExceptFirst<T>) => Omit<HashedOp, "data" | "error">;
type StepHandler = (info: {
  matchOp: MatchOpFn;
  opts?: StepToolOptions;
  args: [StepOptionsOrId, ...unknown[]];
}) => Promise<unknown>;
interface StepToolOptions<T extends (...args: unknown[]) => Promise<unknown> = (...args: unknown[]) => Promise<unknown>> {
  /**
   * Optionally, we can also provide a function that will be called when
   * Inngest tells us to run this operation.
   *
   * If this function is defined, the first time the tool is used it will
   * report the desired operation (including options) to the Inngest. Inngest
   * will then call back to the function to tell it to run the step and then
   * retrieve data.
   *
   * We do this in order to allow functionality such as per-step retries; this
   * gives the SDK the opportunity to tell Inngest what it wants to do before
   * it does it.
   *
   * This function is passed the arguments passed by the user. It will be run
   * when we receive an operation matching this one that does not contain a
   * `data` property.
   */
  fn?: (...args: Parameters<T>) => unknown;
}
/**
 * Create a new set of step function tools ready to be used in a step function.
 * This function should be run and a fresh set of tools provided every time a
 * function is run.
 *
 * An op stack (function state) is passed in as well as some mutable properties
 * that the tools can use to submit a new op.
 */
declare const createStepTools: <TClient extends Inngest.Any>(client: TClient, execution: InngestExecution, stepHandler: StepHandler) => {
  /**
   * Send one or many events to Inngest. Should always be used in place of
   * `inngest.send()` to ensure that the event send is successfully retried
   * and not sent multiple times due to memoisation.
   *
   * @example
   * ```ts
   * await step.sendEvent("emit-user-creation", {
   *   name: "app/user.created",
   *   data: { id: 123 },
   * });
   *
   * await step.sendEvent("emit-user-updates", [
   *   {
   *     name: "app/user.created",
   *     data: { id: 123 },
   *   },
   *   {
   *     name: "app/user.feed.created",
   *     data: { id: 123 },
   *   },
   * ]);
   * ```
   *
   * Returns a promise that will resolve once the event has been sent.
   */
  sendEvent: <Payload extends SendEventPayload<GetEvents<TClient>>>(idOrOptions: StepOptionsOrId, payload: Payload) => Promise<SendEventOutput<ClientOptionsFromInngest<TClient>>>;
  /**
   * EXPERIMENTAL: This API is not yet stable and may change in the future
   * without a major version bump.
   *
   * Wait for a particular signal to be received before continuing. When the
   * signal is received, its data will be returned.
   */
  waitForSignal: <TData>(idOrOptions: StepOptionsOrId, opts: WaitForSignalOpts) => Promise<{
    signal: string;
    data: Jsonify<TData>;
  } | null>;
  /**
   * Send a Signal to Inngest.
   */
  sendSignal: (idOrOptions: StepOptionsOrId, opts: SendSignalOpts) => Promise<null>;
  /**
   * Wait for a particular event to be received before continuing. When the
   * event is received, it will be returned.
   *
   * You can also provide options to control the particular event that is
   * received, for example to ensure that a user ID matches between two
   * events, or to only wait a maximum amount of time before giving up and
   * returning `null` instead of any event data.
   */
  waitForEvent: <IncomingEvent extends WithoutInternalStr<TriggersFromClient<TClient>>>(idOrOptions: StepOptionsOrId, opts: WaitForEventOpts<GetEvents<TClient, true>, IncomingEvent>) => Promise<IncomingEvent extends WithoutInternalStr<TriggersFromClient<TClient>> ? GetEvents<TClient, false>[IncomingEvent] | null : IncomingEvent | null>;
  /**
   * Use this tool to run business logic. Each call to `run` will be retried
   * individually, meaning you can compose complex workflows that safely
   * retry dependent asynchronous actions.
   *
   * The function you pass to `run` will be called only when this "step" is to
   * be executed and can be synchronous or asynchronous.
   *
   * In either case, the return value of the function will be the return value
   * of the `run` tool, meaning you can return and reason about return data
   * for next steps.
   */
  run: <TFn extends (...args: any[]) => unknown>(idOrOptions: StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<
  /**
   * TODO Middleware can affect this. If run input middleware has returned
   * new step data, do not Jsonify.
   */
  SimplifyDeep<Jsonify<TFn extends ((...args: Parameters<TFn>) => Promise<infer U>) ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>>;
  /**
   * AI tooling for running AI models and other AI-related tasks.
   */
  ai: {
    /**
     * Use this tool to have Inngest make your AI calls. Useful for agentic workflows.
     *
     * Input is also tracked for this tool, meaning you can pass input to the
     * function and it will be displayed and editable in the UI.
     */
    infer: <TAdapter extends AiAdapter>(idOrOptions: StepOptionsOrId, options: AiInferOpts<TAdapter>) => Promise<AiAdapter.Output<TAdapter>>;
    /**
     * Use this tool to wrap AI models and other AI-related tasks. Each call
     * to `wrap` will be retried individually, meaning you can compose complex
     * workflows that safely retry dependent asynchronous actions.
     *
     * Input is also tracked for this tool, meaning you can pass input to the
     * function and it will be displayed and editable in the UI.
     */
    wrap: <TFn extends (...args: any[]) => unknown>(idOrOptions: StepOptionsOrId, fn: TFn, ...input: Parameters<TFn>) => Promise<
    /**
     * TODO Middleware can affect this. If run input middleware has returned
     * new step data, do not Jsonify.
     */
    SimplifyDeep<Jsonify<TFn extends ((...args: Parameters<TFn>) => Promise<infer U>) ? Awaited<U extends void ? null : U> : ReturnType<TFn> extends void ? null : ReturnType<TFn>>>>;
    /**
     * Models for AI inference and other AI-related tasks.
     */
    models: {
      anthropic: AiAdapter.ModelCreator<[options: models.Anthropic.AiModelOptions], models.Anthropic.AiModel>;
      gemini: AiAdapter.ModelCreator<[options: models.Gemini.AiModelOptions], models.Gemini.AiModel>;
      openai: AiAdapter.ModelCreator<[options: models.OpenAi.AiModelOptions], models.OpenAi.AiModel>;
      deepseek: AiAdapter.ModelCreator<[options: models.DeepSeek.AiModelOptions], models.DeepSeek.AiModel>;
      grok: AiAdapter.ModelCreator<[options: models.Grok.AiModelOptions], models.Grok.AiModel>;
    };
  };
  /**
   * Wait a specified amount of time before continuing.
   *
   * The time to wait can be specified using a `number` of milliseconds or an
   * `ms`-compatible time string like `"1 hour"`, `"30 mins"`, or `"2.5d"`.
   *
   * {@link https://npm.im/ms}
   *
   * To wait until a particular date, use `sleepUntil` instead.
   */
  sleep: (idOrOptions: StepOptionsOrId, time: number | string | DurationLike) => Promise<void>;
  /**
   * Wait until a particular date before continuing by passing a `Date`.
   *
   * To wait for a particular amount of time from now, always use `sleep`
   * instead.
   */
  sleepUntil: (idOrOptions: StepOptionsOrId, time: Date | string | InstantLike | ZonedDateTimeLike) => Promise<void>;
  /**
   * Invoke a passed Inngest `function` with the given `data`. Returns the
   * result of the returned value of the function or `null` if the function
   * does not return a value.
   *
   * A string ID can also be passed to reference functions outside of the
   * current app.
   */
  invoke: <TFunction extends InvokeTargetFunctionDefinition>(idOrOptions: StepOptionsOrId, opts: InvocationOpts<TFunction>) => InvocationResult<GetFunctionOutput<TFunction>>;
  /**
   * `step.fetch` is a Fetch-API-compatible function that can be used to make
   * any HTTP code durable if it's called within an Inngest function.
   *
   * It will gracefully fall back to the global `fetch` if called outside of
   * this context, and a custom fallback can be set using the `config` method.
   */
  fetch: StepFetch;
};
type InvocationTargetOpts<TFunction extends InvokeTargetFunctionDefinition> = {
  function: TFunction;
};
type InvocationOpts<TFunction extends InvokeTargetFunctionDefinition> = InvocationTargetOpts<TFunction> & Omit<TriggerEventFromFunction<TFunction>, "id"> & {
  /**
   * The step function will wait for the invocation to finish for a maximum
   * of this time, at which point the retured promise will be rejected
   * instead of resolved with the output of the invoked function.
   *
   * Note that the invoked function will continue to run even if this step
   * times out.
   *
   * The time to wait can be specified using a `number` of milliseconds, an
   * `ms`-compatible time string like `"1 hour"`, `"30 mins"`, or `"2.5d"`,
   * or a `Date` object.
   *
   * {@link https://npm.im/ms}
   */
  timeout?: number | string | Date;
};
/**
 * A set of parameters given to a `sendSignal` call.
 */
type SendSignalOpts = {
  /**
   * The signal to send.
   */
  signal: string;
  /**
   * The data to send with the signal.
   */
  data?: unknown;
};
/**
 * A set of parameters given to a `waitForSignal` call.
 */
type WaitForSignalOpts = {
  /**
   * The signal to wait for.
   */
  signal: string;
  /**
   * The step function will wait for the signal for a maximum of this time, at
   * which point the signal will be returned as `null` instead of any signal
   * data.
   *
   * The time to wait can be specified using a `number` of milliseconds, an
   * `ms`-compatible time string like `"1 hour"`, `"30 mins"`, or `"2.5d"`, or
   * a `Date` object.
   *
   * {@link https://npm.im/ms}
   */
  timeout: number | string | Date;
  /**
   * When this `step.waitForSignal()` call is made, choose whether an existing
   * wait for the same signal should be replaced, or whether this run should
   * fail.
   *
   * `"replace"` will replace any existing wait with this one, and the existing
   * wait will remain pending until it reaches its timeout.
   *
   * `"fail"` will cause this run to fail if there is already a wait for the
   * same signal.
   */
  onConflict: "replace" | "fail";
};
/**
 * A set of optional parameters given to a `waitForEvent` call to control how
 * the event is handled.
 */
type WaitForEventOpts<Events extends Record<string, EventPayload>, IncomingEvent extends keyof Events> = {
  event: IncomingEvent;
  /**
   * The step function will wait for the event for a maximum of this time, at
   * which point the event will be returned as `null` instead of any event data.
   *
   * The time to wait can be specified using a `number` of milliseconds, an
   * `ms`-compatible time string like `"1 hour"`, `"30 mins"`, or `"2.5d"`, or
   * a `Date` object.
   *
   * {@link https://npm.im/ms}
   */
  timeout: number | string | Date;
} & ExclusiveKeys<{
  /**
   * If provided, the step function will wait for the incoming event to match
   * particular criteria. If the event does not match, it will be ignored and
   * the step function will wait for another event.
   *
   * It must be a string of a dot-notation field name within both events to
   * compare, e.g. `"data.id"` or `"user.email"`.
   *
   * ```
   * // Wait for an event where the `user.email` field matches
   * match: "user.email"
   * ```
   *
   * All of these are helpers for the `if` option, which allows you to specify
   * a custom condition to check. This can be useful if you need to compare
   * multiple fields or use a more complex condition.
   *
   * See the Inngest expressions docs for more information.
   *
   * {@link https://www.inngest.com/docs/functions/expressions}
   *
   * @deprecated Use `if` instead.
   */
  match?: string;
  /**
   * If provided, the step function will wait for the incoming event to match
   * the given condition. If the event does not match, it will be ignored and
   * the step function will wait for another event.
   *
   * The condition is a string of Google's Common Expression Language. For most
   * simple cases, you might prefer to use `match` instead.
   *
   * See the Inngest expressions docs for more information.
   *
   * {@link https://www.inngest.com/docs/functions/expressions}
   */
  if?: string;
}, "match", "if">;
/**
 * Options for `step.ai.infer()`.
 */
type AiInferOpts<TModel extends AiAdapter> = {
  /**
   * The model to use for the inference. Create a model by importing from
   * `"inngest"` or by using `step.ai.models.*`.
   *
   * @example Import `openai()`
   * ```ts
   * import { openai } from "inngest";
   *
   * const model = openai({ model: "gpt-4" });
   * ```
   *
   * @example Use a model from `step.ai.models`
   * ```ts
   * async ({ step }) => {
   *            const model = step.ai.models.openai({ model: "gpt-4" });
   * }
   * ```
   */
  model: TModel;
  /**
   * The input to pass to the model.
   */
  body: AiAdapter.Input<TModel>;
};
//#endregion
export { FoundStep, createStepTools };
//# sourceMappingURL=InngestStepTools.d.ts.map