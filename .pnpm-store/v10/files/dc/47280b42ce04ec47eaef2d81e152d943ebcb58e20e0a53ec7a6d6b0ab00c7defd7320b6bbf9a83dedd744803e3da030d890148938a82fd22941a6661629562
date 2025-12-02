import { FunctionReference, OptionalRestArgs } from "../server/api.js";
import { Id } from "../values/value.js";
/**
 * A {@link FunctionReference} that can be scheduled to run in the future.
 *
 * Schedulable functions are mutations and actions that are public or internal.
 *
 * @public
 */
export type SchedulableFunctionReference = FunctionReference<"mutation" | "action", "public" | "internal">;
/**
 * An interface to schedule Convex functions.
 *
 * You can schedule either mutations or actions. Mutations are guaranteed to execute
 * exactly once - they are automatically retried on transient errors and either execute
 * successfully or fail deterministically due to developer error in defining the
 * function. Actions execute at most once - they are not retried and might fail
 * due to transient errors.
 *
 * Consider using an {@link internalMutation} or {@link internalAction} to enforce that
 * these functions cannot be called directly from a Convex client.
 *
 * @public
 */
export interface Scheduler {
    /**
     * Schedule a function to execute after a delay.
     *
     * @param delayMs - Delay in milliseconds. Must be non-negative. If the delay
     * is zero, the scheduled function will be due to execute immediately after the
     * scheduling one completes.
     * @param functionReference - A {@link FunctionReference} for the function
     * to schedule.
     * @param args - Arguments to call the scheduled functions with.
     **/
    runAfter<FuncRef extends SchedulableFunctionReference>(delayMs: number, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): Promise<Id<"_scheduled_functions">>;
    /**
     * Schedule a function to execute at a given timestamp.
     *
     * @param timestamp - A Date or a timestamp (milliseconds since the epoch).
     * If the timestamp is in the past, the scheduled function will be due to
     * execute immediately after the scheduling one completes. The timestamp can't
     * be more than five years in the past or more than five years in the future.
     * @param functionReference - A {@link FunctionReference} for the function
     * to schedule.
     * @param args - arguments to call the scheduled functions with.
     **/
    runAt<FuncRef extends SchedulableFunctionReference>(timestamp: number | Date, functionReference: FuncRef, ...args: OptionalRestArgs<FuncRef>): Promise<Id<"_scheduled_functions">>;
    /**
     * Cancels a previously scheduled function if it has not started yet. If the
     * scheduled function is already in progress, it will continue running but
     * any new functions that it tries to schedule will be canceled.
     *
     * @param id
     */
    cancel(id: Id<"_scheduled_functions">): Promise<void>;
}
//# sourceMappingURL=scheduler.d.ts.map