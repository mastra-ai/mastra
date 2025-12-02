import { ConvexError } from "../../values/errors.js";
import { jsonToConvex } from "../../values/value.js";

declare const Convex: {
  syscall: (op: string, jsonArgs: string) => string;
  asyncSyscall: (op: string, jsonArgs: string) => Promise<string>;
  jsSyscall: (op: string, args: Record<string, any>) => any;
};
/**
 * Perform a syscall, taking in a JSON-encodable object as an argument, serializing with
 * JSON.stringify, calling into Rust, and then parsing the response as a JSON-encodable
 * value. If one of your arguments is a Convex value, you must call `convexToJson` on it
 * before passing it to this function, and if the return value has a Convex value, you're
 * also responsible for calling `jsonToConvex`: This layer only deals in JSON.
 */

export function performSyscall(op: string, arg: Record<string, any>): any {
  if (typeof Convex === "undefined" || Convex.syscall === undefined) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. " +
        "Did you mean to use `useQuery` or `useMutation` to call a Convex function?",
    );
  }
  const resultStr = Convex.syscall(op, JSON.stringify(arg));
  return JSON.parse(resultStr);
}

export async function performAsyncSyscall(
  op: string,
  arg: Record<string, any>,
): Promise<any> {
  if (typeof Convex === "undefined" || Convex.asyncSyscall === undefined) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. " +
        "Did you mean to use `useQuery` or `useMutation` to call a Convex function?",
    );
  }
  let resultStr;
  try {
    resultStr = await Convex.asyncSyscall(op, JSON.stringify(arg));
  } catch (e: any) {
    // Rethrow the exception to attach stack trace starting from here.
    // If the error came from JS it will include its own stack trace in the message.
    // If it came from Rust it won't.

    // This only happens if we're propagating ConvexErrors
    if (e.data !== undefined) {
      const rethrown = new ConvexError(e.message);
      rethrown.data = jsonToConvex(e.data);
      throw rethrown;
    }
    throw new Error(e.message);
  }
  return JSON.parse(resultStr);
}

/**
 * Call into a "JS" syscall. Like `performSyscall`, this calls a dynamically linked
 * function set up in the Convex function execution. Unlike `performSyscall`, the
 * arguments do not need to be JSON-encodable and neither does the return value.
 *
 * @param op
 * @param arg
 * @returns
 */
export function performJsSyscall(op: string, arg: Record<string, any>): any {
  if (typeof Convex === "undefined" || Convex.jsSyscall === undefined) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. " +
        "Did you mean to use `useQuery` or `useMutation` to call a Convex function?",
    );
  }
  return Convex.jsSyscall(op, arg);
}
