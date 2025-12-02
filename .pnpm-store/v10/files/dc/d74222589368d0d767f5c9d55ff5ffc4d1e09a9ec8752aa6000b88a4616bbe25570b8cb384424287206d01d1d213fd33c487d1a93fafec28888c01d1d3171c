"use strict";
export function parseArgs(args) {
  if (args === void 0) {
    return {};
  }
  if (!isSimpleObject(args)) {
    throw new Error(
      `The arguments to a Convex function must be an object. Received: ${args}`
    );
  }
  return args;
}
export function validateDeploymentUrl(deploymentUrl) {
  if (typeof deploymentUrl === "undefined") {
    throw new Error(
      `Client created with undefined deployment address. If you used an environment variable, check that it's set.`
    );
  }
  if (typeof deploymentUrl !== "string") {
    throw new Error(
      `Invalid deployment address: found ${deploymentUrl}".`
    );
  }
  if (!(deploymentUrl.startsWith("http:") || deploymentUrl.startsWith("https:"))) {
    throw new Error(
      `Invalid deployment address: Must start with "https://" or "http://". Found "${deploymentUrl}".`
    );
  }
  try {
    new URL(deploymentUrl);
  } catch {
    throw new Error(
      `Invalid deployment address: "${deploymentUrl}" is not a valid URL. If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`
    );
  }
  if (deploymentUrl.endsWith(".convex.site")) {
    throw new Error(
      `Invalid deployment address: "${deploymentUrl}" ends with .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with .convex.cloud? If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`
    );
  }
}
export function isSimpleObject(value) {
  const isObject = typeof value === "object";
  const prototype = Object.getPrototypeOf(value);
  const isSimple = prototype === null || prototype === Object.prototype || // Objects generated from other contexts (e.g. across Node.js `vm` modules) will not satisfy the previous
  // conditions but are still simple objects.
  prototype?.constructor?.name === "Object";
  return isObject && isSimple;
}
//# sourceMappingURL=index.js.map
