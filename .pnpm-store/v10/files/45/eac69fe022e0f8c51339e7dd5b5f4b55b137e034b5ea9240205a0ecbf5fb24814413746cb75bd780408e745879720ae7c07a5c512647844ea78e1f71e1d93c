/**
 * Perform a syscall, taking in a JSON-encodable object as an argument, serializing with
 * JSON.stringify, calling into Rust, and then parsing the response as a JSON-encodable
 * value. If one of your arguments is a Convex value, you must call `convexToJson` on it
 * before passing it to this function, and if the return value has a Convex value, you're
 * also responsible for calling `jsonToConvex`: This layer only deals in JSON.
 */
export declare function performSyscall(op: string, arg: Record<string, any>): any;
export declare function performAsyncSyscall(op: string, arg: Record<string, any>): Promise<any>;
/**
 * Call into a "JS" syscall. Like `performSyscall`, this calls a dynamically linked
 * function set up in the Convex function execution. Unlike `performSyscall`, the
 * arguments do not need to be JSON-encodable and neither does the return value.
 *
 * @param op
 * @param arg
 * @returns
 */
export declare function performJsSyscall(op: string, arg: Record<string, any>): any;
//# sourceMappingURL=syscall.d.ts.map