import type { Value } from "../values/value.js";

/**
 * Validate that the arguments to a Convex function are an object, defaulting
 * `undefined` to `{}`.
 */
export function parseArgs(
  args: Record<string, Value> | undefined,
): Record<string, Value> {
  if (args === undefined) {
    return {};
  }
  if (!isSimpleObject(args)) {
    throw new Error(
      `The arguments to a Convex function must be an object. Received: ${
        args as any
      }`,
    );
  }
  return args;
}

export function validateDeploymentUrl(deploymentUrl: string) {
  // Don't use things like `new URL(deploymentUrl).hostname` since these aren't
  // supported by React Native's JS environment
  if (typeof deploymentUrl === "undefined") {
    throw new Error(
      `Client created with undefined deployment address. If you used an environment variable, check that it's set.`,
    );
  }
  if (typeof deploymentUrl !== "string") {
    throw new Error(
      `Invalid deployment address: found ${deploymentUrl as any}".`,
    );
  }
  if (
    !(deploymentUrl.startsWith("http:") || deploymentUrl.startsWith("https:"))
  ) {
    throw new Error(
      `Invalid deployment address: Must start with "https://" or "http://". Found "${deploymentUrl}".`,
    );
  }

  // Most clients should connect to ".convex.cloud". But we also support localhost and
  // custom custom. We validate the deployment url is a valid url, which is the most
  // common failure pattern.
  try {
    new URL(deploymentUrl);
  } catch {
    throw new Error(
      `Invalid deployment address: "${deploymentUrl}" is not a valid URL. If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`,
    );
  }

  // If a user uses .convex.site, this is very likely incorrect.
  if (deploymentUrl.endsWith(".convex.site")) {
    throw new Error(
      `Invalid deployment address: "${deploymentUrl}" ends with .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with .convex.cloud? If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`,
    );
  }
}

/**
 * Check whether a value is a plain old JavaScript object.
 */
export function isSimpleObject(value: unknown) {
  const isObject = typeof value === "object";
  const prototype = Object.getPrototypeOf(value);
  const isSimple =
    prototype === null ||
    prototype === Object.prototype ||
    // Objects generated from other contexts (e.g. across Node.js `vm` modules) will not satisfy the previous
    // conditions but are still simple objects.
    prototype?.constructor?.name === "Object";
  return isObject && isSimple;
}
