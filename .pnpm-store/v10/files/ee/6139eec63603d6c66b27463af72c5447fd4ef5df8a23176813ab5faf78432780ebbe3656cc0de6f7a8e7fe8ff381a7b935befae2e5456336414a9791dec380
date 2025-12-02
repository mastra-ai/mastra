import { convexToJson, Value } from "../../values/index.js";

export function canonicalizeUdfPath(udfPath: string): string {
  const pieces = udfPath.split(":");
  let moduleName: string;
  let functionName: string;
  if (pieces.length === 1) {
    moduleName = pieces[0];
    functionName = "default";
  } else {
    moduleName = pieces.slice(0, pieces.length - 1).join(":");
    functionName = pieces[pieces.length - 1];
  }
  if (moduleName.endsWith(".js")) {
    moduleName = moduleName.slice(0, -3);
  }
  return `${moduleName}:${functionName}`;
}

/**
 * A string representing the name and arguments of a query.
 *
 * This is used by the {@link BaseConvexClient}.
 *
 * @public
 */
export type QueryToken = string;

export function serializePathAndArgs(
  udfPath: string,
  args: Record<string, Value>,
): QueryToken {
  return JSON.stringify({
    udfPath: canonicalizeUdfPath(udfPath),
    args: convexToJson(args),
  });
}
