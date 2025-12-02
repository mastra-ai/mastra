"use strict";
import { functionName } from "../functionName.js";
export const toReferencePath = Symbol.for("toReferencePath");
export function setReferencePath(obj, value) {
  obj[toReferencePath] = value;
}
export function extractReferencePath(reference) {
  return reference[toReferencePath] ?? null;
}
export function isFunctionHandle(s) {
  return s.startsWith("function://");
}
export function getFunctionAddress(functionReference) {
  let functionAddress;
  if (typeof functionReference === "string") {
    if (isFunctionHandle(functionReference)) {
      functionAddress = { functionHandle: functionReference };
    } else {
      functionAddress = { name: functionReference };
    }
  } else if (functionReference[functionName]) {
    functionAddress = { name: functionReference[functionName] };
  } else {
    const referencePath = extractReferencePath(functionReference);
    if (!referencePath) {
      throw new Error(`${functionReference} is not a functionReference`);
    }
    functionAddress = { reference: referencePath };
  }
  return functionAddress;
}
//# sourceMappingURL=paths.js.map
