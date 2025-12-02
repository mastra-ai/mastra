import { functionName } from "../functionName.js";

export const toReferencePath = Symbol.for("toReferencePath");

// Multiple instances of the same Symbol.for() are equal at runtime but not
// at type-time, so `[toReferencePath]` properties aren't used in types.
// Use this function to set the property invisibly.
export function setReferencePath<T>(obj: T, value: string) {
  (obj as any)[toReferencePath] = value;
}

export function extractReferencePath(reference: any): string | null {
  return reference[toReferencePath] ?? null;
}

export function isFunctionHandle(s: string): boolean {
  return s.startsWith("function://");
}

export function getFunctionAddress(functionReference: any) {
  // The `run*` syscalls expect either a UDF path at "name" or a serialized
  // reference at "reference". Dispatch on `functionReference` to coerce
  // it to one or the other.
  let functionAddress;

  // Legacy path for passing in UDF paths directly as function references.
  if (typeof functionReference === "string") {
    if (isFunctionHandle(functionReference)) {
      functionAddress = { functionHandle: functionReference };
    } else {
      functionAddress = { name: functionReference };
    }
  }
  // Path for passing in a `FunctionReference`, either from `api` or directly
  // created from a UDF path with `makeFunctionReference`.
  else if (functionReference[functionName]) {
    functionAddress = { name: functionReference[functionName] };
  }
  // Reference to a component's function derived from `app` or `component`.
  else {
    const referencePath = extractReferencePath(functionReference);
    if (!referencePath) {
      throw new Error(`${functionReference} is not a functionReference`);
    }
    functionAddress = { reference: referencePath };
  }
  return functionAddress;
}
