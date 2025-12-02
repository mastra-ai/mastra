import { ExecutionVersion } from "../helpers/consts.cjs";
import { MaybePromise } from "../helpers/types.cjs";
import { ServerTiming } from "../helpers/ServerTiming.cjs";
import { ExecutionResult } from "./execution/InngestExecution.cjs";
import { InngestFunction } from "./InngestFunction.cjs";
import { AuthenticatedIntrospection, FunctionConfig, InBandRegisterRequest, LogLevel, RegisterOptions, RegisterRequest, UnauthenticatedIntrospection } from "../types.cjs";
import { Inngest } from "./Inngest.cjs";
import { Env, Mode } from "../helpers/env.cjs";

//#region src/components/InngestCommHandler.d.ts

/**
 * A set of options that can be passed to a serve handler, intended to be used
 * by internal and custom serve handlers to provide a consistent interface.
 *
 * @public
 */
interface ServeHandlerOptions extends RegisterOptions {
  /**
   * The `Inngest` instance used to declare all functions.
   */
  client: Inngest.Like;
  /**
   * An array of the functions to serve and register with Inngest.
   */
  functions: readonly InngestFunction.Like[];
}
interface InngestCommHandlerOptions<Input extends any[] = any[], Output = any, StreamOutput = any> extends RegisterOptions {
  /**
   * The name of the framework this handler is designed for. Should be
   * lowercase, alphanumeric characters inclusive of `-` and `/`.
   *
   * This should never be defined by the user; a {@link ServeHandler} should
   * abstract this.
   */
  frameworkName: string;
  /**
   * The name of this serve handler, e.g. `"My App"`. It's recommended that this
   * value represents the overarching app/service that this set of functions is
   * being served from.
   *
   * This can also be an `Inngest` client, in which case the name given when
   * instantiating the client is used. This is useful if you're sending and
   * receiving events from the same service, as you can reuse a single
   * definition of Inngest.
   */
  client: Inngest.Like;
  /**
   * An array of the functions to serve and register with Inngest.
   */
  functions: readonly InngestFunction.Like[];
  /**
   * The `handler` is the function that will be called with your framework's
   * request arguments and returns a set of functions that the SDK will use to
   * access various parts of the request, such as the body, headers, and query
   * string parameters.
   *
   * It also defines how to transform a response from the SDK into a response
   * that your framework can understand, ensuring headers, status codes, and
   * body are all set correctly.
   *
   * @example
   * ```ts
   * function handler (req: Request, res: Response) {
   *   return {
   *     method: () => req.method,
   *     body: () => req.json(),
   *     headers: (key) => req.headers.get(key),
   *     url: () => req.url,
   *     transformResponse: ({ body, headers, status }) => {
   *       return new Response(body, { status, headers });
   *     },
   *   };
   * };
   * ```
   *
   * See any existing handler for a full example.
   */
  handler: Handler<Input, Output, StreamOutput>;
  skipSignatureValidation?: boolean;
}
/**
 * `InngestCommHandler` is a class for handling incoming requests from Inngest (or
 * Inngest's tooling such as the dev server or CLI) and taking appropriate
 * action for any served functions.
 *
 * All handlers (Next.js, RedwoodJS, Remix, Deno Fresh, etc.) are created using
 * this class; the exposed `serve` function will - most commonly - create an
 * instance of `InngestCommHandler` and then return `instance.createHandler()`.
 *
 * See individual parameter details for more information, or see the
 * source code for an existing handler, e.g.
 * {@link https://github.com/inngest/inngest-js/blob/main/src/next.ts}
 *
 * @example
 * ```
 * // my-custom-handler.ts
 * import {
 *   InngestCommHandler,
 *   type ServeHandlerOptions,
 * } from "./components/InngestCommHandler";
 *
 * export const serve = (options: ServeHandlerOptions) => {
 *   const handler = new InngestCommHandler({
 *     frameworkName: "my-custom-handler",
 *     ...options,
 *     handler: (req: Request) => {
 *       return {
 *         body: () => req.json(),
 *         headers: (key) => req.headers.get(key),
 *         method: () => req.method,
 *         url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
 *         transformResponse: ({ body, status, headers }) => {
 *           return new Response(body, { status, headers });
 *         },
 *       };
 *     },
 *   });
 *
 *   return handler.createHandler();
 * };
 * ```
 *
 * @public
 */
declare class InngestCommHandler<Input extends any[] = any[], Output = any, StreamOutput = any> {
  /**
   * The ID of this serve handler, e.g. `"my-app"`. It's recommended that this
   * value represents the overarching app/service that this set of functions is
   * being served from.
   */
  readonly id: string;
  /**
   * The handler specified during instantiation of the class.
   */
  readonly handler: Handler;
  /**
   * The URL of the Inngest function registration endpoint.
   */
  private readonly inngestRegisterUrl;
  /**
   * The name of the framework this handler is designed for. Should be
   * lowercase, alphanumeric characters inclusive of `-` and `/`.
   */
  protected readonly frameworkName: string;
  /**
   * The signing key used to validate requests from Inngest. This is
   * intentionally mutable so that we can pick up the signing key from the
   * environment during execution if needed.
   */
  protected signingKey: string | undefined;
  /**
   * The same as signingKey, except used as a fallback when auth fails using the
   * primary signing key.
   */
  protected signingKeyFallback: string | undefined;
  /**
   * A property that can be set to indicate whether we believe we are in
   * production mode.
   *
   * Should be set every time a request is received.
   */
  protected _mode: Mode | undefined;
  /**
   * The localized `fetch` implementation used by this handler.
   */
  private readonly fetch;
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
  private readonly _serveHost;
  /**
   * The path to the Inngest serve endpoint. e.g.:
   *
   *     "/some/long/path/to/inngest/endpoint"
   *
   * By default, the library will try to infer this using request details such
   * as the "Host" header and request path, but sometimes this isn't possible
   * (e.g. when running in a more controlled environments such as AWS Lambda or
   * when dealing with proxies/redirects).
   *
   * Provide the custom path (excluding the hostname) here to ensure that the
   * path is reported correctly when registering functions with Inngest.
   *
   * To also provide a custom hostname, use `serveHost`.
   */
  private readonly _servePath;
  /**
   * The minimum level to log from the Inngest serve handler.
   */
  protected readonly logLevel: LogLevel;
  protected readonly streaming: RegisterOptions["streaming"];
  /**
   * A private collection of just Inngest functions, as they have been passed
   * when instantiating the class.
   */
  private readonly rawFns;
  private readonly client;
  /**
   * A private collection of functions that are being served. This map is used
   * to find and register functions when interacting with Inngest Cloud.
   */
  private readonly fns;
  private env;
  private allowExpiredSignatures;
  private readonly _options;
  private readonly skipSignatureValidation;
  constructor(options: InngestCommHandlerOptions<Input, Output, StreamOutput>);
  /**
   * Get the API base URL for the Inngest API.
   *
   * This is a getter to encourage checking the environment for the API base URL
   * each time it's accessed, as it may change during execution.
   */
  protected get apiBaseUrl(): string;
  /**
   * Get the event API base URL for the Inngest API.
   *
   * This is a getter to encourage checking the environment for the event API
   * base URL each time it's accessed, as it may change during execution.
   */
  protected get eventApiBaseUrl(): string;
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
  protected get serveHost(): string | undefined;
  /**
   * The path to the Inngest serve endpoint. e.g.:
   *
   *     "/some/long/path/to/inngest/endpoint"
   *
   * By default, the library will try to infer this using request details such
   * as the "Host" header and request path, but sometimes this isn't possible
   * (e.g. when running in a more controlled environments such as AWS Lambda or
   * when dealing with proxies/redirects).
   *
   * Provide the custom path (excluding the hostname) here to ensure that the
   * path is reported correctly when registering functions with Inngest.
   *
   * To also provide a custom hostname, use `serveHost`.
   *
   * This is a getter to encourage checking the environment for the serve path
   * each time it's accessed, as it may change during execution.
   */
  protected get servePath(): string | undefined;
  private get hashedEventKey();
  private get hashedSigningKey();
  private get hashedSigningKeyFallback();
  /**
   * Returns a `boolean` representing whether this handler will stream responses
   * or not. Takes into account the user's preference and the platform's
   * capabilities.
   */
  private shouldStream;
  /**
   * `createHandler` should be used to return a type-equivalent version of the
   * `handler` specified during instantiation.
   *
   * @example
   * ```
   * // my-custom-handler.ts
   * import {
   *   InngestCommHandler,
   *   type ServeHandlerOptions,
   * } from "./components/InngestCommHandler";
   *
   * export const serve = (options: ServeHandlerOptions) => {
   *   const handler = new InngestCommHandler({
   *     frameworkName: "my-custom-handler",
   *     ...options,
   *     handler: (req: Request) => {
   *       return {
   *         body: () => req.json(),
   *         headers: (key) => req.headers.get(key),
   *         method: () => req.method,
   *         url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
   *         transformResponse: ({ body, status, headers }) => {
   *           return new Response(body, { status, headers });
   *         },
   *       };
   *     },
   *   });
   *
   *   return handler.createHandler();
   * };
   * ```
   */
  createHandler(): (...args: Input) => Promise<Awaited<Output>>;
  private get mode();
  private set mode(value);
  /**
   * Given a set of functions to check if an action is available from the
   * instance's handler, enact any action that is found.
   *
   * This method can fetch varying payloads of data, but ultimately is the place
   * where _decisions_ are made regarding functionality.
   *
   * For example, if we find that we should be viewing the UI, this function
   * will decide whether the UI should be visible based on the payload it has
   * found (e.g. env vars, options, etc).
   */
  private handleAction;
  protected runStep({
    functionId,
    stepId,
    data,
    timer,
    reqArgs,
    headers
  }: {
    functionId: string;
    stepId: string | null;
    data: unknown;
    timer: ServerTiming;
    reqArgs: unknown[];
    headers: Record<string, string>;
  }): {
    version: ExecutionVersion;
    result: Promise<ExecutionResult>;
  };
  protected configs(url: URL): FunctionConfig[];
  /**
   * Return an Inngest serve endpoint URL given a potential `path` and `host`.
   *
   * Will automatically use the `serveHost` and `servePath` if they have been
   * set when registering.
   */
  protected reqUrl(url: URL): URL;
  protected registerBody({
    url,
    deployId
  }: {
    url: URL;
    /**
     * Non-optional to ensure we always consider if we have a deploy ID
     * available to us to use.
     */
    deployId: string | undefined | null;
  }): RegisterRequest;
  protected inBandRegisterBody({
    actions,
    deployId,
    env,
    signatureValidation,
    url
  }: {
    actions: HandlerResponseWithErrors;
    /**
     * Non-optional to ensure we always consider if we have a deploy ID
     * available to us to use.
     */
    deployId: string | undefined | null;
    env: string | null;
    signatureValidation: ReturnType<InngestCommHandler["validateSignature"]>;
    url: URL;
  }): Promise<InBandRegisterRequest>;
  protected introspectionBody({
    actions,
    env,
    signatureValidation,
    url
  }: {
    actions: HandlerResponseWithErrors;
    env: string | null;
    signatureValidation: ReturnType<InngestCommHandler["validateSignature"]>;
    url: URL;
  }): Promise<UnauthenticatedIntrospection | AuthenticatedIntrospection>;
  protected register(url: URL, deployId: string | undefined | null, getHeaders: () => Record<string, string>): Promise<{
    status: number;
    message: string;
    modified: boolean;
  }>;
  /**
   * Given an environment, upsert any missing keys. This is useful in
   * situations where environment variables are passed directly to handlers or
   * are otherwise difficult to access during initialization.
   */
  private upsertKeysFromEnv;
  /**
   * Validate the signature of a request and return the signing key used to
   * validate it.
   */
  protected validateSignature(sig: string | undefined, body: unknown): Promise<{
    success: true;
    keyUsed: string;
  } | {
    success: false;
    err: Error;
  }>;
  protected getResponseSignature(key: string, body: string): string;
  /**
   * Log to stdout/stderr if the log level is set to include the given level.
   * The default log level is `"info"`.
   *
   * This is an abstraction over `console.log` and will try to use the correct
   * method for the given log level.  For example, `log("error", "foo")` will
   * call `console.error("foo")`.
   */
  protected log(level: LogLevel, ...args: unknown[]): void;
}
/**
 * The broad definition of a handler passed when instantiating an
 * {@link InngestCommHandler} instance.
 */
type Handler<Input extends any[] = any[], Output = any, StreamOutput = any> = (...args: Input) => HandlerResponse<Output, StreamOutput>;
type HandlerResponse<Output = any, StreamOutput = any> = {
  body: () => MaybePromise<any>;
  env?: () => MaybePromise<Env | undefined>;
  headers: (key: string) => MaybePromise<string | null | undefined>;
  /**
   * Whether the current environment is production. This is used to determine
   * some functionality like whether to connect to the dev server or whether to
   * show debug logging.
   *
   * If this is not provided--or is provided and returns `undefined`--we'll try
   * to automatically detect whether we're in production by checking various
   * environment variables.
   */
  isProduction?: () => MaybePromise<boolean | undefined>;
  method: () => MaybePromise<string>;
  queryString?: (key: string, url: URL) => MaybePromise<string | null | undefined>;
  url: () => MaybePromise<URL>;
  /**
   * The `transformResponse` function receives the output of the Inngest SDK and
   * can decide how to package up that information to appropriately return the
   * information to Inngest.
   *
   * Mostly, this is taking the given parameters and returning a new `Response`.
   *
   * The function is passed an {@link ActionResponse}, an object containing a
   * `status` code, a `headers` object, and a stringified `body`. This ensures
   * you can appropriately handle the response, including use of any required
   * parameters such as `res` in Express-/Connect-like frameworks.
   */
  transformResponse: (res: ActionResponse<string>) => Output;
  /**
   * The `transformStreamingResponse` function, if defined, declares that this
   * handler supports streaming responses back to Inngest. This is useful for
   * functions that are expected to take a long time, as edge streaming can
   * often circumvent restrictive request timeouts and other limitations.
   *
   * If your handler does not support streaming, do not define this function.
   *
   * It receives the output of the Inngest SDK and can decide how to package
   * up that information to appropriately return the information in a stream
   * to Inngest.
   *
   * Mostly, this is taking the given parameters and returning a new `Response`.
   *
   * The function is passed an {@link ActionResponse}, an object containing a
   * `status` code, a `headers` object, and `body`, a `ReadableStream`. This
   * ensures you can appropriately handle the response, including use of any
   * required parameters such as `res` in Express-/Connect-like frameworks.
   */
  transformStreamingResponse?: (res: ActionResponse<ReadableStream>) => StreamOutput;
};
/**
 * The response from the Inngest SDK before it is transformed in to a
 * framework-compatible response by an {@link InngestCommHandler} instance.
 */
interface ActionResponse<TBody extends string | ReadableStream = string> {
  /**
   * The HTTP status code to return.
   */
  status: number;
  /**
   * The headers to return in the response.
   */
  headers: Record<string, string>;
  /**
   * A stringified body to return.
   */
  body: TBody;
  /**
   * The version of the execution engine that was used to run this action.
   *
   * If the action didn't use the execution engine (for example, a GET request
   * as a health check) or would have but errored before reaching it, this will
   * be `undefined`.
   *
   * If the version should be entirely omitted from the response (for example,
   * when sending preliminary headers when streaming), this will be `null`.
   */
  version: ExecutionVersion | null | undefined;
}
/**
 * A version of {@link HandlerResponse} where each function is safely
 * promisified and requires a reason for each access.
 *
 * This enables us to provide accurate errors for each access without having to
 * wrap every access in a try/catch.
 */
type ActionHandlerResponseWithErrors = { [K in keyof HandlerResponse]: NonNullable<HandlerResponse[K]> extends ((...args: infer Args) => infer R) ? R extends MaybePromise<infer PR> ? (errMessage: string, ...args: Args) => Promise<PR> : (errMessage: string, ...args: Args) => Promise<R> : HandlerResponse[K] };
/**
 * A version of {@link ActionHandlerResponseWithErrors} that includes helper
 * functions that provide sensible defaults on top of the direct access given
 * from the bare response.
 */
interface HandlerResponseWithErrors extends ActionHandlerResponseWithErrors {
  /**
   * Fetch a query string value from the request. If no `querystring` action has
   * been provided by the `serve()` handler, this will fall back to using the
   * provided URL present in the request to parse the query string from instead.
   */
  queryStringWithDefaults: (reason: string, key: string) => Promise<string | undefined>;
}
//#endregion
export { ActionResponse, InngestCommHandler, ServeHandlerOptions };
//# sourceMappingURL=InngestCommHandler.d.cts.map