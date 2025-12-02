import { internalEvents } from "./helpers/consts.js";
import { AsTuple, IsEqual, IsNever, Public, Simplify, SimplifyDeep, WithoutInternal } from "./helpers/types.js";
import { EventSchemas } from "./components/EventSchemas.js";
import { ExtendSendEventWithMiddleware, InngestMiddleware } from "./components/InngestMiddleware.js";
import { InngestFunction } from "./components/InngestFunction.js";
import { InngestFunctionReference } from "./components/InngestFunctionReference.js";
import { Jsonify } from "./helpers/jsonify.js";
import { createStepTools } from "./components/InngestStepTools.js";
import { Logger } from "./middleware/logger.js";
import { GetEvents, Inngest, builtInMiddleware } from "./components/Inngest.js";
import { z } from "zod/v3";

//#region src/types.d.ts
declare namespace types_d_exports {
  export { AuthenticatedIntrospection, BaseContext, Cancellation, CancelledEventPayload, Capabilities, ClientOptions, ConcurrencyOption, Context, DevServerInfo, EventNameFromTrigger, EventPayload, EventsFromFunction, FailureEventArgs, FailureEventPayload, FinishedEventPayload, FunctionConfig, Handler, HashedOp, InBandRegisterRequest, IncomingOp, InvocationResult, InvokeTargetFunctionDefinition, InvokedEventPayload, JsonError, Jsonify, LogLevel, MinimalEventPayload, Op, OpStack, OutgoingOp, PayloadForAnyInngestFunction, RegisterOptions, RegisterRequest, Response, Result, ScheduledTimerEventPayload, SendEventBaseOutput, SendEventOutput, SendEventOutputWithMiddleware, SendEventResponse, SimplifyDeep, Step, StepOpCode, StepOptions, StepOptionsOrId, SubmitOpFn, SupportedFrameworkName, TimeStr, TimeStrBatch, TriggerEventFromFunction, TriggersFromClient, UnauthenticatedIntrospection, WithInvocation, err, functionConfigSchema, inBandSyncRequestBodySchema, incomingOpSchema, jsonErrorSchema, logLevels, ok, sendEventResponseSchema };
}
declare const baseJsonErrorSchema: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>;
  error: z.ZodOptional<z.ZodString>;
  message: z.ZodOptional<z.ZodString>;
  stack: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
  error?: string | undefined;
  name?: string | undefined;
  message?: string | undefined;
  stack?: string | undefined;
}, {
  error?: string | undefined;
  name?: string | undefined;
  message?: string | undefined;
  stack?: string | undefined;
}>;
type JsonError = z.infer<typeof baseJsonErrorSchema> & {
  name: string;
  message: string;
  cause?: unknown;
};
declare const jsonErrorSchema: z.ZodType<JsonError>;
/**
 * The payload for an internal Inngest event that is sent when a function fails.
 *
 * @public
 */
type FailureEventPayload<P extends EventPayload = EventPayload> = {
  name: `${internalEvents.FunctionFailed}`;
  data: {
    function_id: string;
    run_id: string;
    error: z.output<typeof jsonErrorSchema>;
    event: P;
  };
};
/**
 * Context arguments specific to a failure event.
 *
 * @public
 */
type FailureEventArgs<P extends EventPayload = EventPayload> = {
  /**
   * The event data present in the payload.
   */
  event: FailureEventPayload<P>;
  /**
   * The final error that caused this function to exhaust all retries.
   */
  error: Error;
};
/**
 * The payload for an internal Inngest event that is sent when a function
 * finishes, either by completing successfully or failing.
 *
 * @public
 */
type FinishedEventPayload = {
  name: `${internalEvents.FunctionFinished}`;
  data: {
    function_id: string;
    run_id: string;
    correlation_id?: string;
  } & ({
    error: z.output<typeof jsonErrorSchema>;
  } | {
    result: unknown;
  });
};
/**
 * The payload for an internal Inngest event that is sent when a function is
 * cancelled.
 */
type CancelledEventPayload = {
  name: `${internalEvents.FunctionCancelled}`;
  data: {
    function_id: string;
    run_id: string;
    correlation_id?: string;
  };
};
/**
 * The payload for any generic function invocation event. In practice, the event
 * data will be more specific to the function being invoked.
 *
 * @public
 */
type InvokedEventPayload = Simplify<Omit<EventPayload, "name"> & {
  name: `${internalEvents.FunctionInvoked}`;
}>;
/**
 * The payload for the event sent to a function when it is triggered by a cron.
 *
 * @public
 */
type ScheduledTimerEventPayload = Simplify<Omit<EventPayload, "name" | "data" | "id"> & {
  name: `${internalEvents.ScheduledTimer}`;
  data: {
    cron: string;
  };
  id: string;
}>;
/**
 * Unique codes for the different types of operation that can be sent to Inngest
 * from SDK step functions.
 */
declare enum StepOpCode {
  WaitForSignal = "WaitForSignal",
  WaitForEvent = "WaitForEvent",
  /**
   * Legacy equivalent to `"StepRun"`. Has mixed data wrapping (e.g. `data` or
   * `data.data` depending on SDK version), so this is phased out in favour of
   * `"StepRun"`, which never wraps.
   *
   * Note that it is still used for v0 executions for backwards compatibility.
   *
   * @deprecated Only used for v0 executions; use `"StepRun"` instead.
   */
  Step = "Step",
  StepRun = "StepRun",
  StepError = "StepError",
  StepFailed = "StepFailed",
  StepPlanned = "StepPlanned",
  Sleep = "Sleep",
  /**
   * Used to signify that the executor has requested that a step run, but we
   * could not find that step.
   *
   * This is likely indicative that a step was renamed or removed from the
   * function.
   */
  StepNotFound = "StepNotFound",
  InvokeFunction = "InvokeFunction",
  AiGateway = "AIGateway",
  Gateway = "Gateway",
}
/**
 * The shape of a single operation in a step function. Used to communicate
 * desired and received operations to Inngest.
 */
type Op = {
  /**
   * The unique code for this operation.
   */
  op: StepOpCode;
  /**
   * The unhashed step name for this operation. This is a legacy field that is
   * sometimes used for critical data, like the sleep duration for
   * `step.sleep()`.
   *
   * @deprecated For display name, use `displayName` instead.
   */
  name?: string;
  /**
   * An optional name for this step that can be used to display in the Inngest
   * UI.
   */
  displayName?: string;
  /**
   * Any additional data required for this operation to send to Inngest. This
   * is not compared when confirming that the operation was completed; use `id`
   * for this.
   */
  opts?: Record<string, unknown>;
  /**
   * Any data present for this operation. If data is present, this operation is
   * treated as completed.
   */
  data?: unknown;
  /**
   * An error present for this operation. If an error is present, this operation
   * is treated as completed, but failed. When this is read from the op stack,
   * the SDK will throw the error via a promise rejection when it is read.
   *
   * This allows users to handle step failures using common tools such as
   * try/catch or `.catch()`.
   */
  error?: unknown;
};
declare const incomingOpSchema: z.ZodObject<{
  id: z.ZodString;
  data: z.ZodOptional<z.ZodAny>;
  error: z.ZodOptional<z.ZodAny>;
  input: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
  id: string;
  error?: any;
  data?: any;
  input?: any;
}, {
  id: string;
  error?: any;
  data?: any;
  input?: any;
}>;
type IncomingOp = z.output<typeof incomingOpSchema>;
/**
 * The shape of a step operation that is sent to an Inngest Server from an SDK.
 *
 * @public
 */
type OutgoingOp = Pick<HashedOp, "id" | "op" | "name" | "opts" | "data" | "error" | "displayName">;
/**
 * The shape of a hashed operation in a step function. Used to communicate
 * desired and received operations to Inngest.
 */
type HashedOp = Op & {
  /**
   * The hashed identifier for this operation, used to confirm that the
   * operation was completed when it is received from Inngest.
   */
  id: string;
};
/**
 * A helper type to represent a stack of operations that will accumulate
 * throughout a step function's run.  This stack contains an object of
 * op hashes to data.
 */
type OpStack = IncomingOp[];
/**
 * A function that can be used to submit an operation to Inngest internally.
 */
type SubmitOpFn = (op: Op) => void;
/**
 * A sleep-compatible time string such as `"1h30m15s"` that can be sent to
 * Inngest to sleep for a given amount of time.
 *
 * This type includes an empty string too, so make sure to exclude that via
 * `Exclude<TimeStr, "">` if you don't want to allow empty strings.
 *
 * @public
 */
type TimeStr = `${`${number}w` | ""}${`${number}d` | ""}${`${number}h` | ""}${`${number}m` | ""}${`${number}s` | ""}`;
type TimeStrBatch = `${`${number}s`}`;
/**
 * Mutates an {@link EventPayload} `T` to include invocation events.
 */
type WithInvocation<T extends EventPayload> = Simplify<{
  name: T["name"] | `${internalEvents.FunctionInvoked}`;
} & Omit<T, "name">>;
/**
 * Makes sure that all event names are stringified and not enums or other
 * values.
 */
type StringifyAllEvents<T> = { [K in keyof T as `${K & string}`]: Simplify<Omit<T[K], "name"> & {
  name: `${K & string}`;
}> };
/**
 * Given a client and a set of triggers, returns a record of all the events that
 * can be used to trigger a function. This will also include invocation events,
 * which currently could represent any of the triggers.
 */
type GetSelectedEvents<TClient extends Inngest.Any, TTriggers extends TriggersFromClient<TClient>> = Pick<GetEvents<TClient, true>, TTriggers> & StringifyAllEvents<{
  [internalEvents.FunctionInvoked]: Simplify<{
    name: `${internalEvents.FunctionInvoked}`;
  }> & Pick<Pick<GetEvents<TClient, true>, TTriggers>[keyof Pick<GetEvents<TClient, true>, TTriggers>], AssertKeysAreFrom<EventPayload, "id" | "data" | "user" | "v" | "ts">>;
}>;
/**
 * Returns a union of all the events that can be used to trigger a function
 * based on the given `TClient` and `TTriggers`.
 *
 * Can optionally include or exclude internal events with `TExcludeInternal`.
 */
type GetContextEvents<TClient extends Inngest.Any, TTriggers extends TriggersFromClient<TClient>, TExcludeInternal extends boolean = false> = Simplify<TExcludeInternal extends true ? WithoutInternal<GetSelectedEvents<TClient, TTriggers>>[keyof WithoutInternal<GetSelectedEvents<TClient, TTriggers>>] : GetSelectedEvents<TClient, TTriggers>[keyof GetSelectedEvents<TClient, TTriggers>]>;
/**
 * Base context object, omitting any extras that may be added by middleware or
 * function configuration.
 *
 * @public
 */
type BaseContext<TClient extends Inngest.Any, TTriggers extends TriggersFromClient<TClient> = TriggersFromClient<TClient>> = {
  /**
   * The event data present in the payload.
   */
  event: GetContextEvents<TClient, TTriggers>;
  events: AsTuple<GetContextEvents<TClient, TTriggers, true>>;
  /**
   * The run ID for the current function execution
   */
  runId: string;
  step: ReturnType<typeof createStepTools<TClient>>;
  /**
   * The current zero-indexed attempt number for this function execution. The
   * first attempt will be `0`, the second `1`, and so on. The attempt number
   * is incremented every time the function throws an error and is retried.
   */
  attempt: number;
  /**
   * The maximum number of attempts allowed for this function.
   */
  maxAttempts?: number;
};
/**
 * Builds a context object for an Inngest handler, optionally overriding some
 * keys.
 *
 * @internal
 */
type Context<TClient extends Inngest.Any = Inngest.Any, TTriggers extends TriggersFromClient<TClient> = TriggersFromClient<TClient>, TOverrides extends Record<string, unknown> = Record<never, never>> = Omit<BaseContext<TClient, TTriggers>, keyof TOverrides> & TOverrides;
/**
 * Builds a context object for an Inngest handler, optionally overriding some
 * keys.
 *
 * @internal
 */
declare namespace Context {
  /**
   * Represents any `Context` object, regardless of generics and inference.
   */
  type Any = Context;
}
/**
 * The shape of a Inngest function, taking in event, step, ctx, and step
 * tooling.
 *
 * @public
 */
type Handler<TClient extends Inngest.Any, TTriggers extends TriggersFromClient<TClient> = TriggersFromClient<TClient>, TOverrides extends Record<string, unknown> = Record<never, never>> = (
/**
 * The context argument provides access to all data and tooling available to
 * the function.
 */
ctx: Context<TClient, TTriggers, TOverrides>) => unknown;
type TriggersFromClient<TClient extends Inngest.Any = Inngest.Any> = keyof GetEvents<TClient, true> & string;
/**
 * The shape of a Inngest function, taking in event, step, ctx, and step
 * tooling.
 *
 * @public
 */
declare namespace Handler {
  /**
   * Represents any `Handler`, regardless of generics and inference.
   */
  type Any = Handler<Inngest.Any, any, any>;
}
/**
 * Asserts that the given keys `U` are all present in the given object `T`.
 *
 * Used as an internal type guard to ensure that changes to keys are accounted
 * for
 */
type AssertKeysAreFrom<T, K extends keyof T> = K;
/**
 * The shape of a single event's payload without any fields used to identify the
 * actual event being sent.
 *
 * This is used to represent an event payload when invoking a function, as the
 * event name is not known or needed.
 */
interface MinimalEventPayload<TData = any> {
  /**
   * A unique id used to idempotently process a given event payload.
   *
   * Set this when sending events to ensure that the event is only processed
   * once; if an event with the same ID is sent again, it will not invoke
   * functions.
   */
  id?: string;
  /**
   * Any data pertinent to the event
   */
  data?: TData;
  /**
   * Any user data associated with the event
   * All fields ending in "_id" will be used to attribute the event to a particular user
   */
  user?: any;
  /**
   * A specific event schema version
   * (optional)
   */
  v?: string;
}
/**
 * The shape of a single event's payload. It should be extended to enforce
 * adherence to given events and not used as a method of creating them (i.e. as
 * a generic).
 *
 * @public
 */
interface EventPayload<TData = any> extends MinimalEventPayload<TData> {
  /**
   * A unique identifier for the type of event. We recommend using lowercase dot
   * notation for names, prepending `prefixes/` with a slash for organization.
   *
   * e.g. `cloudwatch/alarms/triggered`, `cart/session.created`
   */
  name: string;
  /**
   * An integer representing the milliseconds since the unix epoch at which this
   * event occurred.
   *
   * Defaults to the current time.
   * (optional)
   */
  ts?: number;
}
declare const sendEventResponseSchema: z.ZodObject<{
  /**
   * Event IDs
   */
  ids: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
  /**
   * HTTP Status Code. Will be undefined if no request was sent.
   */
  status: z.ZodDefault<z.ZodNumber>;
  /**
   * Error message. Will be undefined if no error occurred.
   */
  error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
  status: number;
  ids: string[];
  error?: string | undefined;
}, {
  error?: string | undefined;
  status?: number | undefined;
  ids?: string[] | undefined;
}>;
/**
 * The response from the Inngest Event API
 */
type SendEventResponse = z.output<typeof sendEventResponseSchema>;
/**
 * The response in code from sending an event to Inngest.
 *
 * @public
 */
type SendEventBaseOutput = {
  ids: SendEventResponse["ids"];
};
type SendEventOutput<TOpts extends ClientOptions> = Omit<SendEventBaseOutput, keyof SendEventOutputWithMiddleware<TOpts>> & SendEventOutputWithMiddleware<TOpts>;
type SendEventOutputWithMiddleware<TOpts extends ClientOptions> = ExtendSendEventWithMiddleware<[typeof builtInMiddleware, NonNullable<TOpts["middleware"]>], SendEventBaseOutput>;
/**
 * An HTTP-like, standardised response format that allows Inngest to help
 * orchestrate steps and retries.
 *
 * @internal
 */
interface Response {
  /**
   * A step response must contain an HTTP status code.
   *
   * A `2xx` response indicates success; this is not a failure and no retry is
   * necessary.
   *
   * A `4xx` response indicates a bad request; this step will not be retried as
   * it is deemed irrecoverable. Examples of this might be an event with
   * insufficient data or concerning a user that no longer exists.
   *
   * A `5xx` status indicates a temporary internal error; this will be retried
   * according to the step and function's retry policy (3 times, by default).
   *
   * {@link https://www.inngest.com/docs/functions/function-input-and-output#response-format}
   * {@link https://www.inngest.com/docs/functions/retries}
   */
  status: number;
  /**
   * The output of the function - the `body` - can be any arbitrary
   * JSON-compatible data. It is then usable by any future steps.
   *
   * {@link https://www.inngest.com/docs/functions/function-input-and-output#response-format}
   */
  body?: unknown;
}
/**
 * A single step within a function.
 *
 * @internal
 */
type Step<TContext = unknown> = (
/**
 * The context for this step, including the triggering event and any previous
 * step output.
 */
context: TContext) => Promise<Response> | Response;
/**
 * A set of options for configuring the Inngest client.
 *
 * @public
 */
interface ClientOptions {
  /**
   * The ID of this instance, most commonly a reference to the application it
   * resides in.
   *
   * The ID of your client should remain the same for its lifetime; if you'd
   * like to change the name of your client as it appears in the Inngest UI,
   * change the `name` property instead.
   */
  id: string;
  /**
   * Inngest event key, used to send events to Inngest Cloud. If not provided,
   * will search for the `INNGEST_EVENT_KEY` environment variable. If neither
   * can be found, however, a warning will be shown and any attempts to send
   * events will throw an error.
   */
  eventKey?: string;
  /**
   * The base URL to use when contacting Inngest.
   *
   * Defaults to https://inn.gs/ for sending events and https://api.inngest.com
   * for all other communication with Inngest.
   */
  baseUrl?: string;
  /**
   * If provided, will override the used `fetch` implementation. Useful for
   * giving the library a particular implementation if accessing it is not done
   * via globals.
   *
   * By default the library will try to use the native Web API fetch, falling
   * back to a Node implementation if no global fetch can be found.
   *
   * If you wish to specify your own fetch, make sure that you preserve its
   * binding, either by using `.bind` or by wrapping it in an anonymous
   * function.
   */
  fetch?: typeof fetch;
  /**
   * Provide an `EventSchemas` class to type events, providing type safety when
   * sending events and running functions via Inngest.
   *
   * You can provide generated Inngest types, custom types, types using Zod, or
   * a combination of the above. See {@link EventSchemas} for more information.
   *
   * @example
   *
   * ```ts
   * export const inngest = new Inngest({
   *   id: "my-app",
   *   schemas: new EventSchemas().fromZod({
   *     "app/user.created": {
   *       data: z.object({
   *         id: z.string(),
   *         name: z.string(),
   *       }),
   *     },
   *   }),
   * });
   * ```
   */
  schemas?: EventSchemas<Record<string, EventPayload>>;
  /**
   * The Inngest environment to send events to. Defaults to whichever
   * environment this client's event key is associated with.
   *
   * It's likely you never need to change this unless you're trying to sync
   * multiple systems together using branch names.
   */
  env?: string;
  /**
   * The logger provided by the user.
   * The user can passed in their winston, pino, and other loggers for
   * handling log delivery to external services.
   *
   * The provider logger is expected to implement the following API interfaces
   * - .info()
   * - .warn()
   * - .debug()
   * - .error()
   * which most loggers already do.
   *
   * Defaults to a dummy logger that just log things to the console if nothing is provided.
   */
  logger?: Logger;
  middleware?: InngestMiddleware.Stack;
  /**
   * Can be used to explicitly set the client to Development Mode, which will
   * turn off signature verification and default to using a local URL to access
   * a local Dev Server.
   *
   * This is useful for forcing the client to use a local Dev Server while also
   * running in a production-like environment.
   */
  isDev?: boolean;
  /**
   * The application-specific version identifier. This can be an arbitrary value
   * such as a version string, a Git commit SHA, or any other unique identifier.
   */
  appVersion?: string;
  /**
   * If `true`, parallel steps within functions are optimized to reduce traffic
   * during `Promise` resolution, which can hugely reduce the time taken and
   * number of requests for each run.
   *
   * Note that this will be the default behaviour in v4 and in its current form
   * will cause `Promise.*()` to wait for all promises to settle before
   * resolving.
   *
   * @default false
   */
  optimizeParallelism?: boolean;
}
/**
 * A set of log levels that can be used to control the amount of logging output
 * from various parts of the Inngest library.
 *
 * @public
 */
declare const logLevels: readonly ["fatal", "error", "warn", "info", "debug", "silent"];
/**
 * A set of log levels that can be used to control the amount of logging output
 * from various parts of the Inngest library.
 *
 * @public
 */
type LogLevel = (typeof logLevels)[number];
/**
 * A set of options for configuring the registration of Inngest functions.
 *
 * @public
 */
interface RegisterOptions {
  /**
   * A key used to sign requests to and from Inngest in order to prove that the
   * source is legitimate.
   *
   * You must provide a signing key to communicate securely with Inngest. If
   * your key is not provided here, we'll try to retrieve it from the
   * `INNGEST_SIGNING_KEY` environment variable.
   *
   * You can retrieve your signing key from the Inngest UI inside the "Secrets"
   * section at {@link https://app.inngest.com/secrets}. We highly recommend
   * that you add this to your platform's available environment variables as
   * `INNGEST_SIGNING_KEY`.
   *
   * If no key can be found, you will not be able to register your functions or
   * receive events from Inngest.
   */
  signingKey?: string;
  /**
   * The same as signingKey, except used as a fallback when auth fails using the
   * primary signing key.
   */
  signingKeyFallback?: string;
  /**
   * The URL used to register functions with Inngest.
   * Defaults to https://api.inngest.com/fn/register
   */
  baseUrl?: string;
  /**
   * If provided, will override the used `fetch` implementation. Useful for
   * giving the library a particular implementation if accessing it is not done
   * via globals.
   *
   * By default the library will try to use the native Web API fetch, falling
   * back to a Node implementation if no global fetch can be found.
   */
  fetch?: typeof fetch;
  /**
   * The path to the Inngest serve endpoint. e.g.:
   *
   *     "/some/long/path/to/inngest/endpoint"
   *
   * By default, the library will try to infer this using request details such
   * as the "Host" header and request path, but sometimes this isn't possible
   * (e.g. when running in a more controlled environments such as AWS Lambda or
   * when dealing with proxies/rediects).
   *
   * Provide the custom path (excluding the hostname) here to ensure that the
   * path is reported correctly when registering functions with Inngest.
   *
   * To also provide a custom hostname, use `serveHost`.
   */
  servePath?: string;
  /**
   * The host used to access the Inngest serve endpoint, e.g.:
   *
   *     "https://myapp.com"
   *
   * By default, the library will try to infer this using request details such
   * as the "Host" header and request path, but sometimes this isn't possible
   * (e.g. when running in a more controlled environments such as AWS Lambda or
   * when dealing with proxies/redirects).
   *
   * Provide the custom hostname here to ensure that the path is reported
   * correctly when registering functions with Inngest.
   *
   * To also provide a custom path, use `servePath`.
   */
  serveHost?: string;
  /**
   * The minimum level to log from the Inngest serve endpoint.
   *
   * Default level: "info"
   */
  logLevel?: LogLevel;
  /**
   * Some serverless providers (especially those with edge compute) may support
   * streaming responses back to Inngest. This can be used to circumvent
   * restrictive request timeouts and other limitations. It is only available if
   * the serve handler being used supports streaming.
   *
   * If this is `"allow"`, the SDK will attempt to stream responses back to
   * Inngest if it can confidently detect support for it by verifyng that the
   * platform and the serve handler supports streaming.
   *
   * If this is `"force"`, the SDK will always attempt to stream responses back
   * to Inngest regardless of whether we can detect support for it or not. This
   * will override `allowStreaming`, but will still not attempt to stream if
   * the serve handler does not support it.
   *
   * If this is `false`, streaming will never be used.
   *
   * Defaults to `false`.
   */
  streaming?: "allow" | "force" | false;
  /**
   * The ID of this app. This is used to group functions together in the Inngest
   * UI. The ID of the passed client is used by default.
   * @deprecated Will be removed in v4.
   */
  id?: string;
}
interface ConcurrencyOption {
  /**
   * The concurrency limit for this option, adding a limit on how many concurrent
   * steps can execute at once.
   */
  limit: number;
  /**
   * An optional concurrency key, as an expression using the common expression language
   * (CEL).  The result of this expression is used to create new concurrency groups, or
   * sub-queues, for each function run.
   *
   * The event is passed into this expression as "event".
   *
   * Examples:
   * - `event.data.user_id`:  this evaluates to the user_id in the event.data object.
   * - `event.data.user_id + "-" + event.data.account_id`: creates a new group per user/account
   * - `"ai"`:  references a custom string
   */
  key?: string;
  /**
   * An optional scope for the concurrency group.  By default, concurrency limits are
   * scoped to functions - one function's concurrency limits do not impact other functions.
   *
   * Changing this "scope" allows concurrency limits to work across environments (eg. production
   * vs branch environments) or across your account (global).
   */
  scope?: "fn" | "env" | "account";
}
/**
 * Configuration for cancelling a function run based on an incoming event.
 *
 * @public
 */
type Cancellation<Events extends Record<string, EventPayload>> = { [K in keyof Events & string]: {
  /**
   * The name of the event that should cancel the function run.
   */
  event: K;
  /**
   * The expression that must evaluate to true in order to cancel the function run. There
   * are two variables available in this expression:
   * - event, referencing the original function's event trigger
   * - async, referencing the new cancel event.
   *
   * @example
   *
   * Ensures the cancel event's data.user_id field matches the triggering event's data.user_id
   * field:
   *
   * ```ts
   * "async.data.user_id == event.data.user_id"
   * ```
   */
  if?: string;
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
   * An optional timeout that the cancel is valid for.  If this isn't
   * specified, cancellation triggers are valid for up to a year or until the
   * function ends.
   *
   * The time to wait can be specified using a `number` of milliseconds, an
   * `ms`-compatible time string like `"1 hour"`, `"30 mins"`, or `"2.5d"`, or
   * a `Date` object.
   *
   * {@link https://npm.im/ms}
   */
  timeout?: number | string | Date;
} }[keyof Events & string];
/**
 * The response to send to Inngest when pushing function config either directly
 * or when pinged by Inngest Cloud.
 *
 * @internal
 */
interface RegisterRequest {
  /**
   * The API handler's URL to invoke SDK based functions.
   */
  url: string;
  /**
   * Response version, allowing Inngest to change any top-level field.
   */
  v: `${number}.${number}`;
  /**
   * SDK version from `package.json` for our internal metrics and to warn users
   * they need to upgrade.
   */
  sdk: `js:v${number}.${number}.${number}${"" | `-${string}.${number}`}`;
  /**
   * The method used to deploy these functions.
   */
  deployType: "ping";
  /**
   * The name of the framework being used for this instance, e.g. "nextjs",
   * "vercel", "netlify", "lambda", etc. Uses the `framework` specified when
   * creating a new `InngestCommHandler`.
   */
  framework: string;
  /**
   * The name of this particular app, used for grouping and easier viewing in
   * the UI.
   */
  appName: string;
  /**
   * AppVersion represents an optional application version identifier. This should change
   * whenever code within one of your Inngest function or any dependency thereof changes.
   */
  appVersion?: string;
  /**
   * The functions available at this particular handler.
   */
  functions: FunctionConfig[];
  /**
   * The deploy ID used to identify this particular deployment.
   */
  deployId?: string;
  /**
   * Capabilities of the SDK.
   */
  capabilities: Capabilities;
}
interface Capabilities {
  trust_probe: "v1";
  connect: "v1";
}
interface InBandRegisterRequest extends Pick<RegisterRequest, "capabilities" | "framework" | "functions" | "sdk" | "url" | "appVersion">, Pick<AuthenticatedIntrospection, "sdk_language" | "sdk_version" | "env"> {
  /**
   * The ID of the app that this handler is associated with.
   */
  app_id: string;
  /**
   * The result of the introspection request.
   */
  inspection: AuthenticatedIntrospection | UnauthenticatedIntrospection;
  /**
   * ?
   */
  platform?: string;
  /**
   * The person or organization that authored this SDK. Ideally this is
   * synonymous with a GitHub username or organization name.
   */
  sdk_author: "inngest";
}
/**
 * The response to send to the local SDK UI when an introspection request is
 * made.
 *
 * @internal
 */
interface UnauthenticatedIntrospection {
  authentication_succeeded: false | null;
  extra: {
    is_mode_explicit: boolean;
  };
  function_count: number;
  has_event_key: boolean;
  has_signing_key: boolean;
  mode: "cloud" | "dev";
  schema_version: "2024-05-24";
}
interface AuthenticatedIntrospection extends Omit<UnauthenticatedIntrospection, "authentication_succeeded"> {
  api_origin: string;
  app_id: string;
  authentication_succeeded: true;
  capabilities: Capabilities;
  env: string | null;
  event_api_origin: string;
  event_key_hash: string | null;
  extra: UnauthenticatedIntrospection["extra"] & {
    is_streaming: boolean;
  };
  framework: string;
  sdk_language: string;
  sdk_version: string;
  serve_origin: string | null;
  serve_path: string | null;
  signing_key_fallback_hash: string | null;
  signing_key_hash: string | null;
}
/**
 * The schema used to represent an individual function being synced with
 * Inngest.
 *
 * Note that this should only be used to validate the shape of a config object
 * and not used for feature compatibility, such as feature X being exclusive
 * with feature Y; these should be handled on the Inngest side.
 */
declare const functionConfigSchema: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>;
  id: z.ZodString;
  triggers: z.ZodArray<z.ZodUnion<[z.ZodObject<{
    event: z.ZodString;
    expression: z.ZodOptional<z.ZodString>;
  }, "strict", z.ZodTypeAny, {
    event: string;
    expression?: string | undefined;
  }, {
    event: string;
    expression?: string | undefined;
  }>, z.ZodObject<{
    cron: z.ZodString;
  }, "strict", z.ZodTypeAny, {
    cron: string;
  }, {
    cron: string;
  }>]>, "many">;
  steps: z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    runtime: z.ZodObject<{
      type: z.ZodUnion<[z.ZodLiteral<"http">, z.ZodLiteral<"ws">]>;
      url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
      type: "http" | "ws";
      url: string;
    }, {
      type: "http" | "ws";
      url: string;
    }>;
    retries: z.ZodOptional<z.ZodObject<{
      attempts: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
      attempts?: number | undefined;
    }, {
      attempts?: number | undefined;
    }>>;
  }, "strict", z.ZodTypeAny, {
    name: string;
    id: string;
    runtime: {
      type: "http" | "ws";
      url: string;
    };
    retries?: {
      attempts?: number | undefined;
    } | undefined;
  }, {
    name: string;
    id: string;
    runtime: {
      type: "http" | "ws";
      url: string;
    };
    retries?: {
      attempts?: number | undefined;
    } | undefined;
  }>>;
  idempotency: z.ZodOptional<z.ZodString>;
  batchEvents: z.ZodOptional<z.ZodObject<{
    maxSize: z.ZodNumber;
    timeout: z.ZodString;
    key: z.ZodOptional<z.ZodString>;
    if: z.ZodOptional<z.ZodString>;
  }, "strict", z.ZodTypeAny, {
    maxSize: number;
    timeout: string;
    key?: string | undefined;
    if?: string | undefined;
  }, {
    maxSize: number;
    timeout: string;
    key?: string | undefined;
    if?: string | undefined;
  }>>;
  rateLimit: z.ZodOptional<z.ZodObject<{
    key: z.ZodOptional<z.ZodString>;
    limit: z.ZodNumber;
    period: z.ZodEffects<z.ZodString, "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`, string>;
  }, "strict", z.ZodTypeAny, {
    limit: number;
    period: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`;
    key?: string | undefined;
  }, {
    limit: number;
    period: string;
    key?: string | undefined;
  }>>;
  throttle: z.ZodOptional<z.ZodObject<{
    key: z.ZodOptional<z.ZodString>;
    limit: z.ZodNumber;
    period: z.ZodEffects<z.ZodString, "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`, string>;
    burst: z.ZodOptional<z.ZodNumber>;
  }, "strict", z.ZodTypeAny, {
    limit: number;
    period: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`;
    key?: string | undefined;
    burst?: number | undefined;
  }, {
    limit: number;
    period: string;
    key?: string | undefined;
    burst?: number | undefined;
  }>>;
  singleton: z.ZodOptional<z.ZodObject<{
    key: z.ZodOptional<z.ZodString>;
    mode: z.ZodEnum<["skip", "cancel"]>;
  }, "strict", z.ZodTypeAny, {
    mode: "skip" | "cancel";
    key?: string | undefined;
  }, {
    mode: "skip" | "cancel";
    key?: string | undefined;
  }>>;
  cancel: z.ZodOptional<z.ZodArray<z.ZodObject<{
    event: z.ZodString;
    if: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodString>;
  }, "strict", z.ZodTypeAny, {
    event: string;
    timeout?: string | undefined;
    if?: string | undefined;
  }, {
    event: string;
    timeout?: string | undefined;
    if?: string | undefined;
  }>, "many">>;
  debounce: z.ZodOptional<z.ZodObject<{
    key: z.ZodOptional<z.ZodString>;
    period: z.ZodEffects<z.ZodString, "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`, string>;
    timeout: z.ZodOptional<z.ZodEffects<z.ZodString, "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`, string>>;
  }, "strict", z.ZodTypeAny, {
    period: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`;
    timeout?: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s` | undefined;
    key?: string | undefined;
  }, {
    period: string;
    timeout?: string | undefined;
    key?: string | undefined;
  }>>;
  timeouts: z.ZodOptional<z.ZodObject<{
    start: z.ZodOptional<z.ZodEffects<z.ZodString, "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`, string>>;
    finish: z.ZodOptional<z.ZodEffects<z.ZodString, "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`, string>>;
  }, "strict", z.ZodTypeAny, {
    finish?: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s` | undefined;
    start?: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s` | undefined;
  }, {
    finish?: string | undefined;
    start?: string | undefined;
  }>>;
  priority: z.ZodOptional<z.ZodObject<{
    run: z.ZodOptional<z.ZodString>;
  }, "strict", z.ZodTypeAny, {
    run?: string | undefined;
  }, {
    run?: string | undefined;
  }>>;
  concurrency: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodEffects<z.ZodObject<{
    limit: z.ZodNumber;
    key: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodEnum<["fn", "env", "account"]>>;
  }, "strict", z.ZodTypeAny, {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }, {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }>, ConcurrencyOption, {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }>, z.ZodArray<z.ZodEffects<z.ZodObject<{
    limit: z.ZodNumber;
    key: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodEnum<["fn", "env", "account"]>>;
  }, "strict", z.ZodTypeAny, {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }, {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }>, ConcurrencyOption, {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }>, "many">]>>;
}, "strict", z.ZodTypeAny, {
  id: string;
  triggers: ({
    event: string;
    expression?: string | undefined;
  } | {
    cron: string;
  })[];
  steps: Record<string, {
    name: string;
    id: string;
    runtime: {
      type: "http" | "ws";
      url: string;
    };
    retries?: {
      attempts?: number | undefined;
    } | undefined;
  }>;
  name?: string | undefined;
  idempotency?: string | undefined;
  batchEvents?: {
    maxSize: number;
    timeout: string;
    key?: string | undefined;
    if?: string | undefined;
  } | undefined;
  rateLimit?: {
    limit: number;
    period: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`;
    key?: string | undefined;
  } | undefined;
  throttle?: {
    limit: number;
    period: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`;
    key?: string | undefined;
    burst?: number | undefined;
  } | undefined;
  cancel?: {
    event: string;
    timeout?: string | undefined;
    if?: string | undefined;
  }[] | undefined;
  singleton?: {
    mode: "skip" | "cancel";
    key?: string | undefined;
  } | undefined;
  debounce?: {
    period: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s`;
    timeout?: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s` | undefined;
    key?: string | undefined;
  } | undefined;
  timeouts?: {
    finish?: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s` | undefined;
    start?: "" | `${number}w` | `${number}d` | `${number}h` | `${number}m` | `${number}s` | `${number}m${number}s` | `${number}h${number}s` | `${number}h${number}m` | `${number}h${number}m${number}s` | `${number}d${number}s` | `${number}d${number}m` | `${number}d${number}m${number}s` | `${number}d${number}h` | `${number}d${number}h${number}s` | `${number}d${number}h${number}m` | `${number}d${number}h${number}m${number}s` | `${number}w${number}s` | `${number}w${number}m` | `${number}w${number}m${number}s` | `${number}w${number}h` | `${number}w${number}h${number}s` | `${number}w${number}h${number}m` | `${number}w${number}h${number}m${number}s` | `${number}w${number}d` | `${number}w${number}d${number}s` | `${number}w${number}d${number}m` | `${number}w${number}d${number}m${number}s` | `${number}w${number}d${number}h` | `${number}w${number}d${number}h${number}s` | `${number}w${number}d${number}h${number}m` | `${number}w${number}d${number}h${number}m${number}s` | undefined;
  } | undefined;
  priority?: {
    run?: string | undefined;
  } | undefined;
  concurrency?: number | ConcurrencyOption | ConcurrencyOption[] | undefined;
}, {
  id: string;
  triggers: ({
    event: string;
    expression?: string | undefined;
  } | {
    cron: string;
  })[];
  steps: Record<string, {
    name: string;
    id: string;
    runtime: {
      type: "http" | "ws";
      url: string;
    };
    retries?: {
      attempts?: number | undefined;
    } | undefined;
  }>;
  name?: string | undefined;
  idempotency?: string | undefined;
  batchEvents?: {
    maxSize: number;
    timeout: string;
    key?: string | undefined;
    if?: string | undefined;
  } | undefined;
  rateLimit?: {
    limit: number;
    period: string;
    key?: string | undefined;
  } | undefined;
  throttle?: {
    limit: number;
    period: string;
    key?: string | undefined;
    burst?: number | undefined;
  } | undefined;
  cancel?: {
    event: string;
    timeout?: string | undefined;
    if?: string | undefined;
  }[] | undefined;
  singleton?: {
    mode: "skip" | "cancel";
    key?: string | undefined;
  } | undefined;
  debounce?: {
    period: string;
    timeout?: string | undefined;
    key?: string | undefined;
  } | undefined;
  timeouts?: {
    finish?: string | undefined;
    start?: string | undefined;
  } | undefined;
  priority?: {
    run?: string | undefined;
  } | undefined;
  concurrency?: number | {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  } | {
    limit: number;
    key?: string | undefined;
    scope?: "fn" | "env" | "account" | undefined;
  }[] | undefined;
}>;
/**
 * The shape of an individual function being synced with Inngest.
 *
 * @internal
 */
type FunctionConfig = z.output<typeof functionConfigSchema>;
interface DevServerInfo {
  /**
   * The version of the dev server.
   */
  version: string;
  authed: boolean;
  startOpts: {
    dir?: string;
    autodiscover: boolean;
    urls: string[];
  };
  functions: FunctionConfig[];
  handlers: RegisterRequest[];
}
/**
 * Given a set of events and a user-friendly trigger paramter, returns the name
 * of the event that the user intends to listen to.
 *
 * @public
 */
type EventNameFromTrigger<Events extends Record<string, EventPayload>, T extends InngestFunction.Trigger<keyof Events & string>> = IsNever<T> extends true ? `${internalEvents.FunctionInvoked}` : T extends string ? T : T extends {
  event: infer IEvent;
} ? IEvent : T extends {
  cron: string;
} ? `${internalEvents.ScheduledTimer}` : never;
/**
 * A union to represent known names of supported frameworks that we can use
 * internally to assess functionality based on a mix of framework and platform.
 */
type SupportedFrameworkName = "astro" | "bun" | "cloudflare-pages" | "digitalocean" | "edge" | "express" | "aws-lambda" | "nextjs" | "nodejs" | "nuxt" | "h3" | "redwoodjs" | "remix" | "deno/fresh" | "sveltekit" | "fastify" | "koa" | "hono" | "nitro";
/**
 * A set of options that can be passed to any step to configure it.
 *
 * @public
 */
interface StepOptions {
  /**
   * The ID to use to memoize the result of this step, ensuring it is run only
   * once. Changing this ID in an existing function will cause the step to be
   * run again for in-progress runs; it is recommended to use a stable ID.
   */
  id: string;
  /**
   * The display name to use for this step in the Inngest UI. This can be
   * changed at any time without affecting the step's behaviour.
   */
  name?: string;
}
/**
 * Either a step ID or a set of step options.
 *
 * @public
 */
type StepOptionsOrId = StepOptions["id"] | StepOptions;
type EventsFromFunction<T extends InngestFunction.Any> = T extends InngestFunction<any, any, any, infer IClient, any, any> ? GetEvents<IClient, true> : never;
/**
 * A function that can be invoked by Inngest.
 *
 * @public
 */
type InvokeTargetFunctionDefinition = Public<InngestFunctionReference.Any> | Public<InngestFunction.Any> | string;
/**
 * Given an invocation target, extract the payload that will be used to trigger
 * it.
 *
 * If we could not find a payload, will return `never`.
 */
type TriggerEventFromFunction<TFunction extends InvokeTargetFunctionDefinition> = TFunction extends InngestFunction.Any ? PayloadForAnyInngestFunction<TFunction> : TFunction extends InngestFunctionReference<infer IInput extends MinimalEventPayload, any> ? IInput : MinimalEventPayload;
/**
 * Given an {@link InngestFunction} instance, extract the {@link MinimalPayload}
 * that will be used to trigger it.
 *
 * This is intended to see what **input** a developer is expected to give to
 * invoke a function; it should not be used for evaluating the payload received
 * inside an invoked function.
 *
 * If we could not find a payload or the function does not require a payload
 * (e.g. a cron), then will return `{}`, as this is intended to be used to
 * spread into other arguments.
 *
 * @internal
 */
type PayloadForAnyInngestFunction<TFunction extends InngestFunction.Any, TEvents extends Record<string, EventPayload> = (TFunction extends InngestFunction.Any ? EventsFromFunction<TFunction> : never)> = TFunction extends InngestFunction<any, any, any, any, any, infer ITriggers extends InngestFunction.Trigger<keyof TEvents & string>[]> ? IsEqual<TEvents[EventNameFromTrigger<TEvents, ITriggers[number]>]["name"], `${internalEvents.ScheduledTimer}`> extends true ? object : Simplify<Omit<TEvents[EventNameFromTrigger<TEvents, ITriggers[number]>], "name" | "ts">> : never;
type InvocationResult<TReturn> = Promise<TReturn>;
/**
 * Simplified version of Rust style `Result`
 *
 * Make it easier to wrap functions with some kind of result.
 * e.g. API calls
 */
type Result<T, E = undefined> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: E | undefined;
};
declare const ok: <T>(data: T) => Result<T, never>;
declare const err: <E>(error?: E) => Result<never, E>;
declare const inBandSyncRequestBodySchema: z.ZodObject<{
  url: z.ZodString;
}, "strict", z.ZodTypeAny, {
  url: string;
}, {
  url: string;
}>;
//#endregion
export { AuthenticatedIntrospection, BaseContext, Cancellation, CancelledEventPayload, Capabilities, ClientOptions, ConcurrencyOption, Context, DevServerInfo, EventNameFromTrigger, EventPayload, EventsFromFunction, FailureEventArgs, FailureEventPayload, FinishedEventPayload, FunctionConfig, Handler, HashedOp, InBandRegisterRequest, IncomingOp, InvocationResult, InvokeTargetFunctionDefinition, InvokedEventPayload, JsonError, type Jsonify, LogLevel, MinimalEventPayload, Op, OpStack, OutgoingOp, PayloadForAnyInngestFunction, RegisterOptions, RegisterRequest, Response, Result, ScheduledTimerEventPayload, SendEventBaseOutput, SendEventOutput, SendEventOutputWithMiddleware, SendEventResponse, type SimplifyDeep, Step, StepOpCode, StepOptions, StepOptionsOrId, SubmitOpFn, SupportedFrameworkName, TimeStr, TimeStrBatch, TriggerEventFromFunction, TriggersFromClient, UnauthenticatedIntrospection, WithInvocation, err, functionConfigSchema, inBandSyncRequestBodySchema, incomingOpSchema, jsonErrorSchema, logLevels, ok, sendEventResponseSchema, types_d_exports };
//# sourceMappingURL=types.d.ts.map