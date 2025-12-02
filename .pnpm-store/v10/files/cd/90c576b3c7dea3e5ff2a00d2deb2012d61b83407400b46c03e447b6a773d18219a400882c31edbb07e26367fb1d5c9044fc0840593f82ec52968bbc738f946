"use strict";
import {
  convexToJson,
  jsonToConvex,
  v
} from "../../values/index.js";
import { setupActionCalls } from "./actions_impl.js";
import { setupActionVectorSearch } from "./vector_search_impl.js";
import { setupAuth } from "./authentication_impl.js";
import { setupReader, setupWriter } from "./database_impl.js";
import { QueryImpl, QueryInitializerImpl } from "./query_impl.js";
import {
  setupActionScheduler,
  setupMutationScheduler
} from "./scheduler_impl.js";
import {
  setupStorageActionWriter,
  setupStorageReader,
  setupStorageWriter
} from "./storage_impl.js";
import { parseArgs } from "../../common/index.js";
import { performAsyncSyscall } from "./syscall.js";
import { asObjectValidator } from "../../values/validator.js";
import { getFunctionAddress } from "../components/paths.js";
async function invokeMutation(func, argsStr) {
  const requestId = "";
  const args = jsonToConvex(JSON.parse(argsStr));
  const mutationCtx = {
    db: setupWriter(),
    auth: setupAuth(requestId),
    storage: setupStorageWriter(requestId),
    scheduler: setupMutationScheduler(),
    runQuery: (reference, args2) => runUdf("query", reference, args2),
    runMutation: (reference, args2) => runUdf("mutation", reference, args2)
  };
  const result = await invokeFunction(func, mutationCtx, args);
  validateReturnValue(result);
  return JSON.stringify(convexToJson(result === void 0 ? null : result));
}
export function validateReturnValue(v2) {
  if (v2 instanceof QueryInitializerImpl || v2 instanceof QueryImpl) {
    throw new Error(
      "Return value is a Query. Results must be retrieved with `.collect()`, `.take(n), `.unique()`, or `.first()`."
    );
  }
}
export async function invokeFunction(func, ctx, args) {
  let result;
  try {
    result = await Promise.resolve(func(ctx, ...args));
  } catch (thrown) {
    throw serializeConvexErrorData(thrown);
  }
  return result;
}
function dontCallDirectly(funcType, handler) {
  return (ctx, args) => {
    globalThis.console.warn(
      `Convex functions should not directly call other Convex functions. Consider calling a helper function instead. e.g. \`export const foo = ${funcType}(...); await foo(ctx);\` is not supported. See https://docs.convex.dev/production/best-practices/#use-helper-functions-to-write-shared-code`
    );
    return handler(ctx, args);
  };
}
function serializeConvexErrorData(thrown) {
  if (typeof thrown === "object" && thrown !== null && Symbol.for("ConvexError") in thrown) {
    const error = thrown;
    error.data = JSON.stringify(
      convexToJson(error.data === void 0 ? null : error.data)
    );
    error.ConvexErrorSymbol = Symbol.for("ConvexError");
    return error;
  } else {
    return thrown;
  }
}
function assertNotBrowser() {
  if (typeof window === "undefined" || window.__convexAllowFunctionsInBrowser) {
    return;
  }
  const isRealBrowser = Object.getOwnPropertyDescriptor(globalThis, "window")?.get?.toString().includes("[native code]") ?? false;
  if (isRealBrowser) {
    console.error(
      "Convex functions should not be imported in the browser. This will throw an error in future versions of `convex`. If this is a false negative, please report it to Convex support."
    );
  }
}
function strictReplacer(key, value) {
  if (value === void 0) {
    throw new Error(
      `Cannot serialize validator value \`undefined\` for ${key}`
    );
  }
  return value;
}
function exportArgs(functionDefinition) {
  return () => {
    let args = v.any();
    if (typeof functionDefinition === "object" && functionDefinition.args !== void 0) {
      args = asObjectValidator(functionDefinition.args);
    }
    return JSON.stringify(args.json, strictReplacer);
  };
}
function exportReturns(functionDefinition) {
  return () => {
    let returns;
    if (typeof functionDefinition === "object" && functionDefinition.returns !== void 0) {
      returns = asObjectValidator(functionDefinition.returns);
    }
    return JSON.stringify(returns ? returns.json : null, strictReplacer);
  };
}
export const mutationGeneric = (functionDefinition) => {
  const handler = typeof functionDefinition === "function" ? functionDefinition : functionDefinition.handler;
  const func = dontCallDirectly("mutation", handler);
  assertNotBrowser();
  func.isMutation = true;
  func.isPublic = true;
  func.invokeMutation = (argsStr) => invokeMutation(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
};
export const internalMutationGeneric = (functionDefinition) => {
  const handler = typeof functionDefinition === "function" ? functionDefinition : functionDefinition.handler;
  const func = dontCallDirectly(
    "internalMutation",
    handler
  );
  assertNotBrowser();
  func.isMutation = true;
  func.isInternal = true;
  func.invokeMutation = (argsStr) => invokeMutation(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
};
async function invokeQuery(func, argsStr) {
  const requestId = "";
  const args = jsonToConvex(JSON.parse(argsStr));
  const queryCtx = {
    db: setupReader(),
    auth: setupAuth(requestId),
    storage: setupStorageReader(requestId),
    runQuery: (reference, args2) => runUdf("query", reference, args2)
  };
  const result = await invokeFunction(func, queryCtx, args);
  validateReturnValue(result);
  return JSON.stringify(convexToJson(result === void 0 ? null : result));
}
export const queryGeneric = (functionDefinition) => {
  const handler = typeof functionDefinition === "function" ? functionDefinition : functionDefinition.handler;
  const func = dontCallDirectly("query", handler);
  assertNotBrowser();
  func.isQuery = true;
  func.isPublic = true;
  func.invokeQuery = (argsStr) => invokeQuery(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
};
export const internalQueryGeneric = (functionDefinition) => {
  const handler = typeof functionDefinition === "function" ? functionDefinition : functionDefinition.handler;
  const func = dontCallDirectly("internalQuery", handler);
  assertNotBrowser();
  func.isQuery = true;
  func.isInternal = true;
  func.invokeQuery = (argsStr) => invokeQuery(handler, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
};
async function invokeAction(func, requestId, argsStr) {
  const args = jsonToConvex(JSON.parse(argsStr));
  const calls = setupActionCalls(requestId);
  const ctx = {
    ...calls,
    auth: setupAuth(requestId),
    scheduler: setupActionScheduler(requestId),
    storage: setupStorageActionWriter(requestId),
    vectorSearch: setupActionVectorSearch(requestId)
  };
  const result = await invokeFunction(func, ctx, args);
  return JSON.stringify(convexToJson(result === void 0 ? null : result));
}
export const actionGeneric = (functionDefinition) => {
  const handler = typeof functionDefinition === "function" ? functionDefinition : functionDefinition.handler;
  const func = dontCallDirectly("action", handler);
  assertNotBrowser();
  func.isAction = true;
  func.isPublic = true;
  func.invokeAction = (requestId, argsStr) => invokeAction(handler, requestId, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
};
export const internalActionGeneric = (functionDefinition) => {
  const handler = typeof functionDefinition === "function" ? functionDefinition : functionDefinition.handler;
  const func = dontCallDirectly("internalAction", handler);
  assertNotBrowser();
  func.isAction = true;
  func.isInternal = true;
  func.invokeAction = (requestId, argsStr) => invokeAction(handler, requestId, argsStr);
  func.exportArgs = exportArgs(functionDefinition);
  func.exportReturns = exportReturns(functionDefinition);
  func._handler = handler;
  return func;
};
async function invokeHttpAction(func, request) {
  const requestId = "";
  const calls = setupActionCalls(requestId);
  const ctx = {
    ...calls,
    auth: setupAuth(requestId),
    storage: setupStorageActionWriter(requestId),
    scheduler: setupActionScheduler(requestId),
    vectorSearch: setupActionVectorSearch(requestId)
  };
  return await invokeFunction(func, ctx, [request]);
}
export const httpActionGeneric = (func) => {
  const q = dontCallDirectly("httpAction", func);
  assertNotBrowser();
  q.isHttp = true;
  q.invokeHttpAction = (request) => invokeHttpAction(func, request);
  q._handler = func;
  return q;
};
async function runUdf(udfType, f, args) {
  const queryArgs = parseArgs(args);
  const syscallArgs = {
    udfType,
    args: convexToJson(queryArgs),
    ...getFunctionAddress(f)
  };
  const result = await performAsyncSyscall("1.0/runUdf", syscallArgs);
  return jsonToConvex(result);
}
//# sourceMappingURL=registration_impl.js.map
