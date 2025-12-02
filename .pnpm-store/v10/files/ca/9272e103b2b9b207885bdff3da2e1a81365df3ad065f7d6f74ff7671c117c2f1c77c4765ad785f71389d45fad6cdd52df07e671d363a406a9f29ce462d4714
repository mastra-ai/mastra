import { OutgoingOp } from "../types.cjs";
import { SerializedError } from "serialize-error-cjs";

//#region src/helpers/errors.d.ts
declare namespace errors_d_exports {
  export { ErrCode, OutgoingResultError, PrettyError, SerializedError$1 as SerializedError, deserializeError, fixEventKeyMissingSteps, functionStoppedRunningErr, getErrorMessage, isSerializedError, minifyPrettyError, prettyError, prettyErrorSplitter, rethrowError, serializeError };
}
declare const SERIALIZED_KEY = "__serialized";
declare const SERIALIZED_VALUE = true;
interface SerializedError$1 extends Readonly<SerializedError> {
  readonly [SERIALIZED_KEY]: typeof SERIALIZED_VALUE;
}
/**
 * Serialise an error to a serialized JSON string.
 *
 * Errors do not serialise nicely to JSON, so we use this function to convert
 * them to a serialized JSON string. Doing this is also non-trivial for some
 * errors, so we use the `serialize-error` package to do it for us.
 *
 * See {@link https://www.npmjs.com/package/serialize-error}
 *
 * This function is a small wrapper around that package to also add a `type`
 * property to the serialised error, so that we can distinguish between
 * serialised errors and other objects.
 *
 * Will not reserialise existing serialised errors.
 */
declare const serializeError: <TAllowUnknown extends boolean = false, TOutput extends (TAllowUnknown extends true ? unknown : SerializedError$1) = (TAllowUnknown extends true ? unknown : SerializedError$1)>(
/**
 * The suspected error to serialize.
 */
subject: unknown,
/**
 * If `true` and the error is not serializable, will return the original value
 * as `unknown` instead of coercing it to a serialized error.
 */
allowUnknown?: TAllowUnknown) => TOutput;
/**
 * Check if an object or a string is a serialised error created by
 * {@link serializeError}.
 */
declare const isSerializedError: (value: unknown) => SerializedError$1 | undefined;
/**
 * Deserialise an error created by {@link serializeError}.
 *
 * Ensures we only deserialise errors that meet a minimum level of
 * applicability, inclusive of error handling to ensure that badly serialized
 * errors are still handled.
 */
declare const deserializeError: <TAllowUnknown extends boolean = false, TOutput extends (TAllowUnknown extends true ? unknown : Error) = (TAllowUnknown extends true ? unknown : Error)>(subject: Partial<SerializedError$1>, allowUnknown?: TAllowUnknown) => TOutput;
declare enum ErrCode {
  NESTING_STEPS = "NESTING_STEPS",
  /**
   * Legacy v0 execution error code for when a function has changed and no
   * longer matches its in-progress state.
   *
   * @deprecated Not for use in latest execution method.
   */
  NON_DETERMINISTIC_FUNCTION = "NON_DETERMINISTIC_FUNCTION",
  /**
   * Legacy v0 execution error code for when a function is found to be using
   * async actions after memoziation has occurred, which v0 doesn't support.
   *
   * @deprecated Not for use in latest execution method.
   */
  ASYNC_DETECTED_AFTER_MEMOIZATION = "ASYNC_DETECTED_AFTER_MEMOIZATION",
  /**
   * Legacy v0 execution error code for when a function is found to be using
   * steps after a non-step async action has occurred.
   *
   * @deprecated Not for use in latest execution method.
   */
  STEP_USED_AFTER_ASYNC = "STEP_USED_AFTER_ASYNC",
  AUTOMATIC_PARALLEL_INDEXING = "AUTOMATIC_PARALLEL_INDEXING",
}
interface PrettyError {
  /**
   * The type of message, used to decide on icon and color use.
   */
  type?: "error" | "warn";
  /**
   * A short, succinct description of what happened. Will be used as the error's
   * header, so should be short and to the point with no trailing punctuation.
   */
  whatHappened: string;
  /**
   * If applicable, provide a full sentence to reassure the user about certain
   * details, for example if an error occurred whilst uploading a file, but we
   * can assure the user that uploading succeeded and something internal failed.
   */
  reassurance?: string;
  /**
   * Tell the user why the error happened if we can. This should be a full
   * sentence or paragraph that explains the error in more detail, for example
   * to explain that a file failed to upload because it was too large and that
   * the maximum size is 10MB.
   */
  why?: string;
  /**
   * If applicable, tell the user what the consequences of the error are, for
   * example to tell them that their file was not uploaded and that they will
   * need to try again.
   */
  consequences?: string;
  /**
   * If we can, tell the user what they can do to fix the error now. This should
   * be a full sentence or paragraph that explains what the user can do to fix
   * the error, for example to tell them to try uploading a smaller file or
   * upgrade to a paid plan.
   */
  toFixNow?: string | string[];
  /**
   * If applicable, tell the user what to do if the error persists, they want
   * more information, or the fix we've given them doesn't work.
   *
   * This should be a full sentence or paragraph, and will likely refer users
   * to contact us for support, join our Discord, or read documentation.
   */
  otherwise?: string;
  /**
   * Add a stack trace to the message so that the user knows what line of code
   * the error is in relation to.
   */
  stack?: true;
  /**
   * If applicable, provide a code that the user can use to reference the error
   * when contacting support.
   */
  code?: ErrCode;
}
declare const prettyErrorSplitter = "=================================================";
/**
 * Given an unknown `err`, mutate it to minify any pretty errors that it
 * contains.
 */
declare const minifyPrettyError: <T>(err: T) => T;
/**
 * Given an `unknown` object, retrieve the `message` property from it, or fall
 * back to the `fallback` string if it doesn't exist or is empty.
 */
declare const getErrorMessage: (err: unknown, fallback: string) => string;
/**
 * Given a {@link PrettyError}, return a nicely-formatted string ready to log
 * or throw.
 *
 * Useful for ensuring that errors are logged in a consistent, helpful format
 * across the SDK by prompting for key pieces of information.
 */
declare const prettyError: ({
  type,
  whatHappened,
  otherwise,
  reassurance,
  toFixNow,
  why,
  consequences,
  stack,
  code
}: PrettyError) => string;
declare const fixEventKeyMissingSteps: string[];
/**
 * An error that, when thrown, indicates internally that an outgoing operation
 * contains an error.
 *
 * We use this because serialized `data` sent back to Inngest may differ from
 * the error instance itself due to middleware.
 *
 * @internal
 */
declare class OutgoingResultError extends Error {
  readonly result: Pick<OutgoingOp, "data" | "error">;
  constructor(result: Pick<OutgoingOp, "data" | "error">);
}
/**
 * Create a function that will rethrow an error with a prefix added to the
 * message.
 *
 * Useful for adding context to errors that are rethrown.
 *
 * @example
 * ```ts
 * await doSomeAction().catch(rethrowError("Failed to do some action"));
 * ```
 */
declare const rethrowError: (prefix: string) => ((err: any) => never);
/**
 * Legacy v0 execution error for functions that don't support mixing steps and
 * regular async actions.
 */
declare const functionStoppedRunningErr: (code: ErrCode) => string;
//#endregion
export { errors_d_exports, serializeError };
//# sourceMappingURL=errors.d.cts.map