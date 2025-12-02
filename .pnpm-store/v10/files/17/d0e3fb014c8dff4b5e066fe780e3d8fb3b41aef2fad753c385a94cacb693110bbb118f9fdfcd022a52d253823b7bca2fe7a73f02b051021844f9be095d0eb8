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
var nextjs_exports = {};
__export(nextjs_exports, {
  fetchAction: () => fetchAction,
  fetchMutation: () => fetchMutation,
  fetchQuery: () => fetchQuery,
  preloadQuery: () => preloadQuery,
  preloadedQueryResult: () => preloadedQueryResult
});
module.exports = __toCommonJS(nextjs_exports);
var import_browser = require("../browser/index.js");
var import_common = require("../common/index.js");
var import_server = require("../server/index.js");
var import_values = require("../values/index.js");
async function preloadQuery(query, ...args) {
  const value = await fetchQuery(query, ...args);
  const preloaded = {
    _name: (0, import_server.getFunctionName)(query),
    _argsJSON: (0, import_values.convexToJson)(args[0] ?? {}),
    _valueJSON: (0, import_values.convexToJson)(value)
  };
  return preloaded;
}
function preloadedQueryResult(preloaded) {
  return (0, import_values.jsonToConvex)(preloaded._valueJSON);
}
async function fetchQuery(query, ...args) {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.query(query, fnArgs || {});
}
async function fetchMutation(mutation, ...args) {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.mutation(mutation, fnArgs || {});
}
async function fetchAction(action, ...args) {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.action(action, fnArgs || {});
}
function setupClient(options) {
  if ("url" in options && options.url === void 0) {
    console.error(
      "deploymentUrl is undefined, are your environment variables set? In the future explicitly passing undefined will cause an error. To explicitly use the default, pass `process.env.NEXT_PUBLIC_CONVEX_URL`."
    );
  }
  const client = new import_browser.ConvexHttpClient(
    getConvexUrl(options.url, options.skipConvexDeploymentUrlCheck ?? false)
  );
  if (options.token !== void 0) {
    client.setAuth(options.token);
  }
  if (options.adminToken !== void 0) {
    client.setAdminAuth(options.adminToken);
  }
  client.setFetchOptions({ cache: "no-store" });
  return client;
}
function getConvexUrl(deploymentUrl, skipConvexDeploymentUrlCheck) {
  const url = deploymentUrl ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const isFromEnv = deploymentUrl === void 0;
  if (typeof url !== "string") {
    throw new Error(
      isFromEnv ? `Environment variable NEXT_PUBLIC_CONVEX_URL is not set.` : `Convex function called with invalid deployment address.`
    );
  }
  if (!skipConvexDeploymentUrlCheck) {
    (0, import_common.validateDeploymentUrl)(url);
  }
  return url;
}
//# sourceMappingURL=index.js.map
