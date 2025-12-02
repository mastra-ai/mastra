import { AsArray, IsNever, SendEventPayload, SimplifyDeep, SingleOrArray, WithoutInternal } from "../helpers/types.js";
import { EventSchemas } from "./EventSchemas.js";
import { ExtendWithMiddleware, InngestMiddleware } from "./InngestMiddleware.js";
import { InngestFunction } from "./InngestFunction.js";
import { InngestFunctionReference } from "./InngestFunctionReference.js";
import { Jsonify } from "../helpers/jsonify.js";
import { Logger } from "../middleware/logger.js";
import { ClientOptions, EventNameFromTrigger, EventPayload, FailureEventArgs, Handler, IncomingOp, InvokeTargetFunctionDefinition, OutgoingOp, SendEventOutput, TriggersFromClient } from "../types.js";
import { InngestApi } from "../api/api.js";

//#region src/components/Inngest.d.ts

/**
 * Given a set of client options for Inngest, return the event types that can
 * be sent or received.
 *
 * @public
 */
type EventsFromOpts<TOpts extends ClientOptions> = TOpts["schemas"] extends EventSchemas<infer U> ? U : Record<string, EventPayload>;
/**
 * A client used to interact with the Inngest API by sending or reacting to
 * events.
 *
 * To provide event typing, see {@link EventSchemas}.
 *
 * ```ts
 * const inngest = new Inngest({ id: "my-app" });
 *
 * // or to provide event typing too
 * const inngest = new Inngest({
 *   id: "my-app",
 *   schemas: new EventSchemas().fromRecord<{
 *     "app/user.created": {
 *       data: { userId: string };
 *     };
 *   }>(),
 * });
 * ```
 *
 * @public
 */
declare class Inngest<TClientOpts extends ClientOptions = ClientOptions> implements Inngest.Like {
  get [Symbol.toStringTag](): typeof Inngest.Tag;
  /**
   * The ID of this instance, most commonly a reference to the application it
   * resides in.
   *
   * The ID of your client should remain the same for its lifetime; if you'd
   * like to change the name of your client as it appears in the Inngest UI,
   * change the `name` property instead.
   */
  readonly id: string;
  /**
   * Stores the options so we can remember explicit settings the user has
   * provided.
   */
  private readonly options;
  /**
   * Inngest event key, used to send events to Inngest Cloud.
   */
  private eventKey;
  private _apiBaseUrl;
  private _eventBaseUrl;
  private readonly inngestApi;
  /**
   * The absolute URL of the Inngest Cloud API.
   */
  private sendEventUrl;
  private headers;
  private readonly fetch;
  private readonly logger;
  private localFns;
  /**
   * A promise that resolves when the middleware stack has been initialized and
   * the client is ready to be used.
   */
  private readonly middleware;
  /**
   * Whether the client is running in a production environment. This can
   * sometimes be `undefined` if the client has expressed no preference or
   * perhaps environment variables are only available at a later stage in the
   * runtime, for example when receiving a request.
   *
   * An {@link InngestCommHandler} should prioritize this value over all other
   * settings, but should still check for the presence of an environment
   * variable if it is not set.
   */
  private _mode;
  protected readonly schemas?: NonNullable<TClientOpts["schemas"]>;
  private _appVersion;
  get apiBaseUrl(): string | undefined;
  get eventBaseUrl(): string | undefined;
  get env(): string | null;
  get appVersion(): string | undefined;
  /**
   * A client used to interact with the Inngest API by sending or reacting to
   * events.
   *
   * To provide event typing, see {@link EventSchemas}.
   *
   * ```ts
   * const inngest = new Inngest({ name: "My App" });
   *
   * // or to provide event typing too
   * const inngest = new Inngest({
   *   name: "My App",
   *   schemas: new EventSchemas().fromRecord<{
   *     "app/user.created": {
   *       data: { userId: string };
   *     };
   *   }>(),
   * });
   * ```
   */
  constructor(options: TClientOpts);
  /**
   * Returns a `Promise` that resolves when the app is ready and all middleware
   * has been initialized.
   */
  get ready(): Promise<void>;
  /**
   * Set the environment variables for this client. This is useful if you are
   * passed environment variables at runtime instead of as globals and need to
   * update the client with those values as requests come in.
   */
  setEnvVars(env?: Record<string, string | undefined>): this;
  private loadModeEnvVars;
  /**
   * Initialize all passed middleware, running the `register` function on each
   * in sequence and returning the requested hook registrations.
   */
  private initializeMiddleware;
  private get mode();
  private set mode(value);
  /**
   * Given a response from Inngest, relay the error to the caller.
   */
  private getResponseError;
  /**
   * Set the event key for this instance of Inngest. This is useful if for some
   * reason the key is not available at time of instantiation or present in the
   * `INNGEST_EVENT_KEY` environment variable.
   */
  setEventKey(
  /**
   * Inngest event key, used to send events to Inngest Cloud. Use this is your
   * key is for some reason not available at time of instantiation or present
   * in the `INNGEST_EVENT_KEY` environment variable.
   */
  eventKey: string): void;
  private eventKeySet;
  /**
   * EXPERIMENTAL: This API is not yet stable and may change in the future
   * without a major version bump.
   *
   * Send a Signal to Inngest.
   */
  sendSignal({
    signal,
    data,
    env
  }: {
    /**
     * The signal to send.
     */
    signal: string;
    /**
     * The data to send with the signal.
     */
    data?: unknown;
    /**
     * The Inngest environment to send the signal to. Defaults to whichever
     * environment this client's key is associated with.
     *
     * It's like you never need to change this unless you're trying to sync
     * multiple systems together using branch names.
     */
    env?: string;
  }): Promise<InngestApi.SendSignalResponse>;
  private _sendSignal;
  /**
   * Send one or many events to Inngest. Takes an entire payload (including
   * name) as each input.
   *
   * ```ts
   * await inngest.send({ name: "app/user.created", data: { id: 123 } });
   * ```
   *
   * Returns a promise that will resolve if the event(s) were sent successfully,
   * else throws with an error explaining what went wrong.
   *
   * If you wish to send an event with custom types (i.e. one that hasn't been
   * generated), make sure to add it when creating your Inngest instance, like
   * so:
   *
   * ```ts
   * const inngest = new Inngest({
   *   name: "My App",
   *   schemas: new EventSchemas().fromRecord<{
   *     "my/event": {
   *       name: "my/event";
   *       data: { bar: string };
   *     };
   *   }>(),
   * });
   * ```
   */
  send<Payload extends SendEventPayload<GetEvents<this>>>(payload: Payload, options?: {
    /**
     * The Inngest environment to send events to. Defaults to whichever
     * environment this client's event key is associated with.
     *
     * It's likely you never need to change this unless you're trying to sync
     * multiple systems together using branch names.
     */
    env?: string;
  }): Promise<SendEventOutput<TClientOpts>>;
  /**
   * Internal method for sending an event, used to allow Inngest internals to
   * further customize the request sent to an Inngest Server.
   */
  private _send;
  createFunction: Inngest.CreateFunction<this>;
  get funcs(): InngestFunction.Any[];
  private _createFunction;
  /**
   * Runtime-only validation.
   */
  private sanitizeOptions;
  /**
   * Runtime-only validation.
   */
  private sanitizeTriggers;
}
/**
 * Default middleware that is included in every client, placed after the user's
 * middleware on the client but before function-level middleware.
 *
 * It is defined here to ensure that comments are included in the generated TS
 * definitions. Without this, we infer the stack of built-in middleware without
 * comments, losing a lot of value.
 *
 * If this is moved, please ensure that using this package in another project
 * can correctly access comments on mutated input and output.
 *
 * This return pattern mimics the output of a `satisfies` suffix; it's used as
 * we support versions of TypeScript prior to the introduction of `satisfies`.
 */
declare const builtInMiddleware: [InngestMiddleware<{
  name: string;
  init({
    client
  }: {
    client: Inngest.Any;
    fn?: InngestFunction.Any;
  }): {
    onFunctionRun(arg: Readonly<{
      readonly steps: Readonly<IncomingOp>[];
      readonly fn: InngestFunction.Any;
      readonly reqArgs: Readonly<unknown[]>;
      ctx: Readonly<{
        event: EventPayload;
        runId: string;
      }>;
    }>): {
      transformInput(): {
        ctx: {
          /**
           * The passed in logger from the user.
           * Defaults to a console logger if not provided.
           */
          logger: Logger;
        };
      };
      beforeExecution(): void;
      transformOutput({
        result: {
          error
        }
      }: {
        result: Readonly<Pick<OutgoingOp, "error" | "data">>;
        step?: Readonly<Omit<OutgoingOp, "id">>;
      }): void;
      beforeResponse(): Promise<void>;
    };
  };
}>];
/**
 * A client used to interact with the Inngest API by sending or reacting to
 * events.
 *
 * To provide event typing, see {@link EventSchemas}.
 *
 * ```ts
 * const inngest = new Inngest({ name: "My App" });
 *
 * // or to provide event typing too
 * const inngest = new Inngest({
 *   name: "My App",
 *   schemas: new EventSchemas().fromRecord<{
 *     "app/user.created": {
 *       data: { userId: string };
 *     };
 *   }>(),
 * });
 * ```
 *
 * @public
 */
declare namespace Inngest {
  const Tag: "Inngest.App";
  /**
   * Represents any `Inngest` instance, regardless of generics and inference.
   *
   * Prefer use of `Inngest.Like` where possible to ensure compatibility with
   * multiple versions.
   */
  type Any = Inngest;
  /**
   * References any `Inngest` instance across library versions, useful for use
   * in public APIs to ensure compatibility with multiple versions.
   *
   * Prefer use of `Inngest.Any` internally and `Inngest.Like` for public APIs.
   */
  interface Like {
    readonly [Symbol.toStringTag]: typeof Inngest.Tag;
  }
  type CreateFunction<TClient extends Inngest.Any> = <TMiddleware extends InngestMiddleware.Stack, TTrigger extends SingleOrArray<InngestFunction.Trigger<TriggersFromClient<TClient>>>, THandler extends Handler.Any = Handler<TClient, EventNameFromTrigger<GetEvents<TClient, true>, AsArray<TTrigger>[number]>, ExtendWithMiddleware<[typeof builtInMiddleware, NonNullable<ClientOptionsFromInngest<TClient>["middleware"]>, TMiddleware]>>, TFailureHandler extends Handler.Any = Handler<TClient, EventNameFromTrigger<GetEvents<TClient, true>, AsArray<TTrigger>[number]>, ExtendWithMiddleware<[typeof builtInMiddleware, NonNullable<ClientOptionsFromInngest<TClient>["middleware"]>, TMiddleware], FailureEventArgs<GetEvents<TClient, true>[EventNameFromTrigger<GetEvents<TClient, true>, AsArray<TTrigger>[number]>]>>>>(options: Omit<InngestFunction.Options<TClient, TMiddleware, AsArray<TTrigger>, TFailureHandler>, "triggers">, trigger: TTrigger, handler: THandler) => InngestFunction<Omit<InngestFunction.Options<TClient, TMiddleware, AsArray<TTrigger>, TFailureHandler>, "triggers">, THandler, TFailureHandler, TClient, TMiddleware, AsArray<TTrigger>>;
}
/**
 * A helper type to extract the type of a set of event tooling from a given
 * Inngest instance and optionally a trigger.
 *
 * @example Get generic step tools for an Inngest instance.
 * ```ts
 * type StepTools = GetStepTools<typeof inngest>;
 * ```
 *
 * @example Get step tools with a trigger, ensuring tools like `waitForEvent` are typed.
 * ```ts
 * type StepTools = GetStepTools<typeof Inngest, "github/pull_request">;
 * ```
 *
 * @public
 */
type GetStepTools<TInngest extends Inngest.Any, TTrigger extends keyof GetEvents<TInngest> & string = keyof GetEvents<TInngest> & string> = GetFunctionInput<TInngest, TTrigger> extends {
  step: infer TStep;
} ? TStep : never;
/**
 * A helper type to extract the type of the input to a function from a given
 * Inngest instance and optionally a trigger.
 *
 * @example Get generic function input for an Inngest instance.
 * ```ts
 * type Input = GetFunctionInput<typeof inngest>;
 * ```
 *
 * @example Get function input with a trigger, ensuring tools like `waitForEvent` are typed.
 * ```ts
 * type Input = GetFunctionInput<typeof Inngest, "github/pull_request">;
 * ```
 *
 * @public
 */
type GetFunctionInput<TClient extends Inngest.Any, TTrigger extends TriggersFromClient<TClient> = TriggersFromClient<TClient>> = Parameters<Handler<TClient, TTrigger, ExtendWithMiddleware<[typeof builtInMiddleware, NonNullable<ClientOptionsFromInngest<TClient>["middleware"]>]>>>[0];
/**
 * A helper type to extract the type of the output of an Inngest function.
 *
 * @example Get a function's output
 * ```ts
 * type Output = GetFunctionOutput<typeof myFunction>;
 * ```
 *
 * @public
 */
type GetFunctionOutput<TFunction extends InvokeTargetFunctionDefinition> = TFunction extends InngestFunction.Any ? GetFunctionOutputFromInngestFunction<TFunction> : TFunction extends InngestFunctionReference.Any ? GetFunctionOutputFromReferenceInngestFunction<TFunction> : unknown;
/**
 * A helper type to extract the type of the output of an Inngest function.
 *
 * Used internally for {@link GetFunctionOutput}. Code outside of this package
 * should use {@link GetFunctionOutput} instead.
 *
 * @internal
 */
type GetFunctionOutputFromInngestFunction<TFunction extends InngestFunction.Any> = TFunction extends InngestFunction<any, infer IHandler, any, any, any, any> ? IsNever<SimplifyDeep<Jsonify<Awaited<ReturnType<IHandler>>>>> extends true ? null : SimplifyDeep<Jsonify<Awaited<ReturnType<IHandler>>>> : unknown;
/**
 * A helper type to extract the type of the output of a referenced Inngest
 * function.
 *
 * Used internally for {@link GetFunctionOutput}. Code outside of this package
 * should use {@link GetFunctionOutput} instead.
 *
 * @internal
 */
type GetFunctionOutputFromReferenceInngestFunction<TFunction extends InngestFunctionReference.Any> = TFunction extends InngestFunctionReference<any, infer IOutput> ? IsNever<SimplifyDeep<Jsonify<IOutput>>> extends true ? null : SimplifyDeep<Jsonify<IOutput>> : unknown;
/**
 * When passed an Inngest client, will return all event types for that client.
 *
 * It's recommended to use this instead of directly reusing your event types, as
 * Inngest will add extra properties and internal events such as `ts` and
 * `inngest/function.finished`.
 *
 * @example
 * ```ts
 * import { EventSchemas, Inngest, type GetEvents } from "inngest";
 *
 * export const inngest = new Inngest({
 *   id: "example-app",
 *   schemas: new EventSchemas().fromRecord<{
 *     "app/user.created": { data: { userId: string } };
 *   }>(),
 * });
 *
 * type Events = GetEvents<typeof inngest>;
 * type AppUserCreated = Events["app/user.created"];
 *
 * ```
 *
 * @public
 */
type GetEvents<TInngest extends Inngest.Any, TWithInternal extends boolean = false> = TWithInternal extends true ? EventsFromOpts<ClientOptionsFromInngest<TInngest>> : WithoutInternal<EventsFromOpts<ClientOptionsFromInngest<TInngest>>>;
/**
 * A helper type to extract the inferred options from a given Inngest instance.
 *
 * @example
 * ```ts
 * type Options = ClientOptionsFromInngest<typeof inngest>;
 * ```
 *
 * @public
 */
type ClientOptionsFromInngest<TInngest extends Inngest.Any> = TInngest extends Inngest<infer U> ? U : ClientOptions;
//#endregion
export { ClientOptionsFromInngest, EventsFromOpts, GetEvents, GetFunctionInput, GetFunctionOutput, GetStepTools, Inngest, builtInMiddleware };
//# sourceMappingURL=Inngest.d.ts.map