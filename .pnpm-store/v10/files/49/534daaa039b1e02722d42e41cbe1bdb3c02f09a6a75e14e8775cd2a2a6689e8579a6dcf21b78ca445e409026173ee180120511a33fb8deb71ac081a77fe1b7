"use strict";
import { ConvexError } from "../../values/errors.js";
import { jsonToConvex } from "../../values/value.js";
export function performSyscall(op, arg) {
  if (typeof Convex === "undefined" || Convex.syscall === void 0) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. Did you mean to use `useQuery` or `useMutation` to call a Convex function?"
    );
  }
  const resultStr = Convex.syscall(op, JSON.stringify(arg));
  return JSON.parse(resultStr);
}
export async function performAsyncSyscall(op, arg) {
  if (typeof Convex === "undefined" || Convex.asyncSyscall === void 0) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. Did you mean to use `useQuery` or `useMutation` to call a Convex function?"
    );
  }
  let resultStr;
  try {
    resultStr = await Convex.asyncSyscall(op, JSON.stringify(arg));
  } catch (e) {
    if (e.data !== void 0) {
      const rethrown = new ConvexError(e.message);
      rethrown.data = jsonToConvex(e.data);
      throw rethrown;
    }
    throw new Error(e.message);
  }
  return JSON.parse(resultStr);
}
export function performJsSyscall(op, arg) {
  if (typeof Convex === "undefined" || Convex.jsSyscall === void 0) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. Did you mean to use `useQuery` or `useMutation` to call a Convex function?"
    );
  }
  return Convex.jsSyscall(op, arg);
}
//# sourceMappingURL=syscall.js.map
