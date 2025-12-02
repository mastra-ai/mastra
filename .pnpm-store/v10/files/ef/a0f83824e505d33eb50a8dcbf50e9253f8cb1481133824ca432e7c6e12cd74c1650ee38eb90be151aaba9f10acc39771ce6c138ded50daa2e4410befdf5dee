"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var registration_impl_exports = {};
__export(registration_impl_exports, {
  actionGeneric: () => actionGeneric,
  httpActionGeneric: () => httpActionGeneric,
  internalActionGeneric: () => internalActionGeneric,
  internalMutationGeneric: () => internalMutationGeneric,
  internalQueryGeneric: () => internalQueryGeneric,
  invokeFunction: () => invokeFunction,
  mutationGeneric: () => mutationGeneric,
  queryGeneric: () => queryGeneric,
  validateReturnValue: () => validateReturnValue
});
module.exports = __toCommonJS(registration_impl_exports);
var import_values = require("../../values/index.js");
var import_actions_impl = require("./actions_impl.js");
var import_vector_search_impl = require("./vector_search_impl.js");
var import_authentication_impl = require("./authentication_impl.js");
var import_database_impl = require("./database_impl.js");
var import_query_impl = require("./query_impl.js");
var import_scheduler_impl = require("./scheduler_impl.js");
var import_storage_impl = require("./storage_impl.js");
var import_common = require("../../common/index.js");
var import_syscall = require("./syscall.js");
var import_validator = require("../../values/validator.js");
var import_paths = require("../components/paths.js");
async function invokeMutation(func, argsStr) {
  const requestId = "";
  const args = (0, import_values.jsonToConvex)(JSON.parse(argsStr));
  const mutationCtx = {
    db: (0, import_database_impl.setupWriter)(),
    auth: (0, import_authentication_impl.setupAuth)(requestId),
    storage: (0, import_storage_impl.setupStorageWriter)(requestId),
    scheduler: (0, import_scheduler_impl.setupMutationScheduler)(),
    runQuery: (reference, args2) => runUdf("query", reference, args2),
    runMutation: (reference, args2) => runUdf("mutation", reference, args2)
  };
  const result = await invokeFunction(func, mutationCtx, args);
  validateReturnValue(result);
  return JSON.stringify((0, import_values.convexToJson)(result === void 0 ? null : result));
}
function validateReturnValue(v2) {
  if (v2 instanceof import_query_impl.QueryInitializerImpl || v2 instanceof import_query_impl.QueryImpl) {
    throw new Error(
      "Return value is a Query. Results must be retrieved with `.collect()`, `.take(n), `.unique()`, or `.first()`."
    );
  }
}
async function invokeFunction(func, ctx, args) {
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
      (0, import_values.convexToJson)(error.data === void 0 ? null : error.data)
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
    let args = import_values.v.any();
    if (typeof functionDefinition === "object" && functionDefinition.args !== void 0) {
      args = (0, import_validator.asObjectValidator)(functionDefinition.args);
    }
    return JSON.stringify(args.json, strictReplacer);
  };
}
function exportReturns(functionDefinition) {
  return () => {
    let returns;
    if (typeof functionDefinition === "object" && functionDefinition.returns !== void 0) {
      returns = (0, import_validator.asObjectValidator)(functionDefinition.returns);
    }
    return JSON.stringify(returns ? returns.json : null, strictReplacer);
  };
}
const mutationGeneric = (functionDefinition) => {
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
const internalMutationGeneric = (functionDefinition) => {
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
  const args = (0, import_values.jsonToConvex)(JSON.parse(argsStr));
  const queryCtx = {
    db: (0, import_database_impl.setupReader)(),
    auth: (0, import_authentication_impl.setupAuth)(requestId),
    storage: (0, import_storage_impl.setupStorageReader)(requestId),
    runQuery: (reference, args2) => runUdf("query", reference, args2)
  };
  const result = await invokeFunction(func, queryCtx, args);
  validateReturnValue(result);
  return JSON.stringify((0, import_values.convexToJson)(result === void 0 ? null : result));
}
const queryGeneric = (functionDefinition) => {
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
const internalQueryGeneric = (functionDefinition) => {
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
  const args = (0, import_values.jsonToConvex)(JSON.parse(argsStr));
  const calls = (0, import_actions_impl.setupActionCalls)(requestId);
  const ctx = {
    ...calls,
    auth: (0, import_authentication_impl.setupAuth)(requestId),
    scheduler: (0, import_scheduler_impl.setupActionScheduler)(requestId),
    storage: (0, import_storage_impl.setupStorageActionWriter)(requestId),
    vectorSearch: (0, import_vector_search_impl.setupActionVectorSearch)(requestId)
  };
  const result = await invokeFunction(func, ctx, args);
  return JSON.stringify((0, import_values.convexToJson)(result === void 0 ? null : result));
}
const actionGeneric = (functionDefinition) => {
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
const internalActionGeneric = (functionDefinition) => {
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
  const calls = (0, import_actions_impl.setupActionCalls)(requestId);
  const ctx = {
    ...calls,
    auth: (0, import_authentication_impl.setupAuth)(requestId),
    storage: (0, import_storage_impl.setupStorageActionWriter)(requestId),
    scheduler: (0, import_scheduler_impl.setupActionScheduler)(requestId),
    vectorSearch: (0, import_vector_search_impl.setupActionVectorSearch)(requestId)
  };
  return await invokeFunction(func, ctx, [request]);
}
const httpActionGeneric = (func) => {
  const q = dontCallDirectly("httpAction", func);
  assertNotBrowser();
  q.isHttp = true;
  q.invokeHttpAction = (request) => invokeHttpAction(func, request);
  q._handler = func;
  return q;
};
async function runUdf(udfType, f, args) {
  const queryArgs = (0, import_common.parseArgs)(args);
  const syscallArgs = {
    udfType,
    args: (0, import_values.convexToJson)(queryArgs),
    ...(0, import_paths.getFunctionAddress)(f)
  };
  const result = await (0, import_syscall.performAsyncSyscall)("1.0/runUdf", syscallArgs);
  return (0, import_values.jsonToConvex)(result);
}
//# sourceMappingURL=registration_impl.js.map
