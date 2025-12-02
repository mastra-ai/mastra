import {
  ConvexError,
  convexToJson,
  GenericValidator,
  jsonToConvex,
  v,
  Validator,
  Value,
} from "../../values/index.js";
import { GenericDataModel } from "../data_model.js";
import {
  ActionBuilder,
  DefaultFunctionArgs,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PublicHttpAction,
  QueryBuilder,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "../registration.js";
import { setupActionCalls } from "./actions_impl.js";
import { setupActionVectorSearch } from "./vector_search_impl.js";
import { setupAuth } from "./authentication_impl.js";
import { setupReader, setupWriter } from "./database_impl.js";
import { QueryImpl, QueryInitializerImpl } from "./query_impl.js";
import {
  setupActionScheduler,
  setupMutationScheduler,
} from "./scheduler_impl.js";
import {
  setupStorageActionWriter,
  setupStorageReader,
  setupStorageWriter,
} from "./storage_impl.js";
import { parseArgs } from "../../common/index.js";
import { performAsyncSyscall } from "./syscall.js";
import { asObjectValidator } from "../../values/validator.js";
import { getFunctionAddress } from "../components/paths.js";

async function invokeMutation<
  F extends (ctx: GenericMutationCtx<GenericDataModel>, ...args: any) => any,
>(func: F, argsStr: string) {
  // TODO(presley): Change the function signature and propagate the requestId from Rust.
  // Ok, to mock it out for now, since queries are only running in V8.
  const requestId = "";
  const args = jsonToConvex(JSON.parse(argsStr));
  const mutationCtx = {
    db: setupWriter(),
    auth: setupAuth(requestId),
    storage: setupStorageWriter(requestId),
    scheduler: setupMutationScheduler(),

    runQuery: (reference: any, args?: any) => runUdf("query", reference, args),
    runMutation: (reference: any, args?: any) =>
      runUdf("mutation", reference, args),
  };
  const result = await invokeFunction(func, mutationCtx, args as any);
  validateReturnValue(result);
  return JSON.stringify(convexToJson(result === undefined ? null : result));
}

export function validateReturnValue(v: any) {
  if (v instanceof QueryInitializerImpl || v instanceof QueryImpl) {
    throw new Error(
      "Return value is a Query. Results must be retrieved with `.collect()`, `.take(n), `.unique()`, or `.first()`.",
    );
  }
}

export async function invokeFunction<
  Ctx,
  Args extends any[],
  F extends (ctx: Ctx, ...args: Args) => any,
>(func: F, ctx: Ctx, args: Args) {
  let result;
  try {
    result = await Promise.resolve(func(ctx, ...args));
  } catch (thrown: unknown) {
    throw serializeConvexErrorData(thrown);
  }
  return result;
}

function dontCallDirectly(
  funcType: string,
  handler: (ctx: any, args: any) => any,
): unknown {
  return (ctx: any, args: any) => {
    globalThis.console.warn(
      "Convex functions should not directly call other Convex functions. Consider calling a helper function instead. " +
        `e.g. \`export const foo = ${funcType}(...); await foo(ctx);\` is not supported. ` +
        "See https://docs.convex.dev/production/best-practices/#use-helper-functions-to-write-shared-code",
    );
    return handler(ctx, args);
  };
}

// Keep in sync with node executor
function serializeConvexErrorData(thrown: unknown) {
  if (
    typeof thrown === "object" &&
    thrown !== null &&
    Symbol.for("ConvexError") in thrown
  ) {
    const error = thrown as ConvexError<any>;
    error.data = JSON.stringify(
      convexToJson(error.data === undefined ? null : error.data),
    );
    (error as any).ConvexErrorSymbol = Symbol.for("ConvexError");
    return error;
  } else {
    return thrown;
  }
}

/**
 * Guard against Convex functions accidentally getting included in a browser bundle.
 * Convex functions may include secret logic or credentials that should not be
 * send to untrusted clients (browsers).
 */
function assertNotBrowser() {
  if (
    typeof window === "undefined" ||
    (window as any).__convexAllowFunctionsInBrowser
  ) {
    return;
  }
  // JSDom doesn't count, developers are allowed to use JSDom in Convex functions.
  const isRealBrowser =
    Object.getOwnPropertyDescriptor(globalThis, "window")
      ?.get?.toString()
      .includes("[native code]") ?? false;
  if (isRealBrowser) {
    // eslint-disable-next-line no-console
    console.error(
      "Convex functions should not be imported in the browser. This will throw an error in future versions of `convex`. If this is a false negative, please report it to Convex support.",
    );
  }
}

type FunctionDefinition =
  | ((ctx: any, args: DefaultFunctionArgs) => any)
  | {
      args?: GenericValidator | Record<string, GenericValidator>;
      returns?: GenericValidator | Record<string, GenericValidator>;
      handler: (ctx: any, args: DefaultFunctionArgs) => any;
    };

function strictReplacer(key: string, value: any) {
  if (value === undefined) {
    throw new Error(
      `Cannot serialize validator value \`undefined\` for ${key}`,
    );
  }
  return value;
}
function exportArgs(functionDefinition: FunctionDefinition) {
  return () => {
    let args: GenericValidator = v.any();
    if (
      typeof functionDefinition === "object" &&
      functionDefinition.args !== undefined
    ) {
      args = asObjectValidator(functionDefinition.args);
    }
    return JSON.stringify(args.json, strictReplacer);
  };
}

function exportReturns(functionDefinition: FunctionDefinition) {
  return () => {
    let returns: Validator<any, any, any> | undefined;
    if (
      typeof functionDefinition === "object" &&
      functionDefinition.returns !== undefined
    ) {
      returns = asObjectValidator(functionDefinition.returns);
    }
    return JSON.stringify(returns ? returns.json : null, strictReplacer);
  };
}

/**
 * Define a mutation in this Convex app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * If you're using code generation, use the `mutation` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The mutation function. It receives a {@link GenericMutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export const mutationGeneric: MutationBuilder<any, "public"> = ((
  functionDefinition: FunctionDefinition,
) => {
  const handler = (
    typeof functionDefinition === "function"
      ? functionDefinition
      : functionDefinition.handler
  ) as (ctx: GenericMutationCtx<any>, args: any) => any;
  const func = dontCallDirectly("mutation", handler) as RegisteredMutation<
    "public",
    any,
    any
  >;

  assertNotBrowser();
  func.isMutation = true;
  func.isPublic = true;
  func.invokeMutation = (argsStr) => invokeMutation(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
}) as MutationBuilder<any, "public">;

/**
 * Define a mutation that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * If you're using code generation, use the `internalMutation` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The mutation function. It receives a {@link GenericMutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export const internalMutationGeneric: MutationBuilder<any, "internal"> = ((
  functionDefinition: FunctionDefinition,
) => {
  const handler = (
    typeof functionDefinition === "function"
      ? functionDefinition
      : functionDefinition.handler
  ) as (ctx: GenericMutationCtx<any>, args: any) => any;
  const func = dontCallDirectly(
    "internalMutation",
    handler,
  ) as RegisteredMutation<"internal", any, any>;

  assertNotBrowser();
  func.isMutation = true;
  func.isInternal = true;
  func.invokeMutation = (argsStr) => invokeMutation(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
}) as MutationBuilder<any, "internal">;

async function invokeQuery<
  F extends (ctx: GenericQueryCtx<GenericDataModel>, ...args: any) => any,
>(func: F, argsStr: string) {
  // TODO(presley): Change the function signature and propagate the requestId from Rust.
  // Ok, to mock it out for now, since queries are only running in V8.
  const requestId = "";
  const args = jsonToConvex(JSON.parse(argsStr));
  const queryCtx = {
    db: setupReader(),
    auth: setupAuth(requestId),
    storage: setupStorageReader(requestId),
    runQuery: (reference: any, args?: any) => runUdf("query", reference, args),
  };
  const result = await invokeFunction(func, queryCtx, args as any);
  validateReturnValue(result);
  return JSON.stringify(convexToJson(result === undefined ? null : result));
}

/**
 * Define a query in this Convex app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * If you're using code generation, use the `query` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The query function. It receives a {@link GenericQueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export const queryGeneric: QueryBuilder<any, "public"> = ((
  functionDefinition: FunctionDefinition,
) => {
  const handler = (
    typeof functionDefinition === "function"
      ? functionDefinition
      : functionDefinition.handler
  ) as (ctx: GenericQueryCtx<any>, args: any) => any;
  const func = dontCallDirectly("query", handler) as RegisteredQuery<
    "public",
    any,
    any
  >;

  assertNotBrowser();
  func.isQuery = true;
  func.isPublic = true;
  func.invokeQuery = (argsStr) => invokeQuery(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
}) as QueryBuilder<any, "public">;

/**
 * Define a query that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * If you're using code generation, use the `internalQuery` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The query function. It receives a {@link GenericQueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export const internalQueryGeneric: QueryBuilder<any, "internal"> = ((
  functionDefinition: FunctionDefinition,
) => {
  const handler = (
    typeof functionDefinition === "function"
      ? functionDefinition
      : functionDefinition.handler
  ) as (ctx: GenericQueryCtx<any>, args: any) => any;
  const func = dontCallDirectly("internalQuery", handler) as RegisteredQuery<
    "internal",
    any,
    any
  >;

  assertNotBrowser();
  func.isQuery = true;
  func.isInternal = true;
  func.invokeQuery = (argsStr) => invokeQuery(handler as any, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
}) as QueryBuilder<any, "internal">;

async function invokeAction<
  F extends (ctx: GenericActionCtx<GenericDataModel>, ...args: any) => any,
>(func: F, requestId: string, argsStr: string) {
  const args = jsonToConvex(JSON.parse(argsStr));
  const calls = setupActionCalls(requestId);
  const ctx = {
    ...calls,
    auth: setupAuth(requestId),
    scheduler: setupActionScheduler(requestId),
    storage: setupStorageActionWriter(requestId),
    vectorSearch: setupActionVectorSearch(requestId) as any,
  };
  const result = await invokeFunction(func, ctx, args as any);
  return JSON.stringify(convexToJson(result === undefined ? null : result));
}

/**
 * Define an action in this Convex app's public API.
 *
 * If you're using code generation, use the `action` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The function. It receives a {@link GenericActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export const actionGeneric: ActionBuilder<any, "public"> = ((
  functionDefinition: FunctionDefinition,
) => {
  const handler = (
    typeof functionDefinition === "function"
      ? functionDefinition
      : functionDefinition.handler
  ) as (ctx: GenericActionCtx<any>, args: any) => any;
  const func = dontCallDirectly("action", handler) as RegisteredAction<
    "public",
    any,
    any
  >;

  assertNotBrowser();
  func.isAction = true;
  func.isPublic = true;
  func.invokeAction = (requestId, argsStr) =>
    invokeAction(handler, requestId, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
}) as ActionBuilder<any, "public">;

/**
 * Define an action that is only accessible from other Convex functions (but not from the client).
 *
 * If you're using code generation, use the `internalAction` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The function. It receives a {@link GenericActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export const internalActionGeneric: ActionBuilder<any, "internal"> = ((
  functionDefinition: FunctionDefinition,
) => {
  const handler = (
    typeof functionDefinition === "function"
      ? functionDefinition
      : functionDefinition.handler
  ) as (ctx: GenericActionCtx<any>, args: any) => any;
  const func = dontCallDirectly("internalAction", handler) as RegisteredAction<
    "internal",
    any,
    any
  >;

  assertNotBrowser();
  func.isAction = true;
  func.isInternal = true;
  func.invokeAction = (requestId, argsStr) =>
    invokeAction(handler, requestId, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
}) as ActionBuilder<any, "internal">;

async function invokeHttpAction<
  F extends (ctx: GenericActionCtx<GenericDataModel>, request: Request) => any,
>(func: F, request: Request) {
  // TODO(presley): Change the function signature and propagate the requestId from Rust.
  // Ok, to mock it out for now, since http endpoints are only running in V8.
  const requestId = "";
  const calls = setupActionCalls(requestId);
  const ctx = {
    ...calls,
    auth: setupAuth(requestId),
    storage: setupStorageActionWriter(requestId),
    scheduler: setupActionScheduler(requestId),
    vectorSearch: setupActionVectorSearch(requestId) as any,
  };
  return await invokeFunction(func, ctx, [request]);
}

/**
 * Define a Convex HTTP action.
 *
 * @param func - The function. It receives an {@link GenericActionCtx} as its first argument, and a `Request` object
 * as its second.
 * @returns The wrapped function. Route a URL path to this function in `convex/http.js`.
 *
 * @public
 */
export const httpActionGeneric = (
  func: (
    ctx: GenericActionCtx<GenericDataModel>,
    request: Request,
  ) => Promise<Response>,
): PublicHttpAction => {
  const q = dontCallDirectly("httpAction", func) as PublicHttpAction;
  assertNotBrowser();
  q.isHttp = true;
  q.invokeHttpAction = (request) => invokeHttpAction(func as any, request);
  q._handler = func;
  return q;
};

async function runUdf(
  udfType: "query" | "mutation",
  f: any,
  args?: Record<string, Value>,
): Promise<any> {
  const queryArgs = parseArgs(args);
  const syscallArgs = {
    udfType,
    args: convexToJson(queryArgs),
    ...getFunctionAddress(f),
  };
  const result = await performAsyncSyscall("1.0/runUdf", syscallArgs);
  return jsonToConvex(result);
}
