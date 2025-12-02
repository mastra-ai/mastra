"use strict";
import { ConvexHttpClient } from "../browser/index.js";
import { validateDeploymentUrl } from "../common/index.js";
import {
  getFunctionName
} from "../server/index.js";
import { convexToJson, jsonToConvex } from "../values/index.js";
export async function preloadQuery(query, ...args) {
  const value = await fetchQuery(query, ...args);
  const preloaded = {
    _name: getFunctionName(query),
    _argsJSON: convexToJson(args[0] ?? {}),
    _valueJSON: convexToJson(value)
  };
  return preloaded;
}
export function preloadedQueryResult(preloaded) {
  return jsonToConvex(preloaded._valueJSON);
}
export async function fetchQuery(query, ...args) {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.query(query, fnArgs || {});
}
export async function fetchMutation(mutation, ...args) {
  const [fnArgs, options] = args;
  const client = setupClient(options ?? {});
  return client.mutation(mutation, fnArgs || {});
}
export async function fetchAction(action, ...args) {
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
  const client = new ConvexHttpClient(
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
    validateDeploymentUrl(url);
  }
  return url;
}
//# sourceMappingURL=index.js.map
