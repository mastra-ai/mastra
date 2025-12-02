"use strict";
import { convexToJson } from "../../values/index.js";
export function canonicalizeUdfPath(udfPath) {
  const pieces = udfPath.split(":");
  let moduleName;
  let functionName;
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
export function serializePathAndArgs(udfPath, args) {
  return JSON.stringify({
    udfPath: canonicalizeUdfPath(udfPath),
    args: convexToJson(args)
  });
}
//# sourceMappingURL=udf_path_utils.js.map
