import { convexToJson, Value } from "../../values/index.js";
import { version } from "../../index.js";
import { performAsyncSyscall } from "./syscall.js";
import { parseArgs } from "../../common/index.js";
import { SchedulableFunctionReference, Scheduler } from "../scheduler.js";
import { Id } from "../../values/value.js";
import { validateArg } from "./validate.js";
import { getFunctionAddress } from "../components/paths.js";

export function setupMutationScheduler(): Scheduler {
  return {
    runAfter: async (
      delayMs: number,
      functionReference: SchedulableFunctionReference,
      args?: Record<string, Value>,
    ) => {
      const syscallArgs = runAfterSyscallArgs(delayMs, functionReference, args);
      return await performAsyncSyscall("1.0/schedule", syscallArgs);
    },
    runAt: async (
      ms_since_epoch_or_date: number | Date,
      functionReference: SchedulableFunctionReference,
      args?: Record<string, Value>,
    ) => {
      const syscallArgs = runAtSyscallArgs(
        ms_since_epoch_or_date,
        functionReference,
        args,
      );
      return await performAsyncSyscall("1.0/schedule", syscallArgs);
    },
    cancel: async (id: Id<"_scheduled_functions">) => {
      validateArg(id, 1, "cancel", "id");
      const args = { id: convexToJson(id) };
      await performAsyncSyscall("1.0/cancel_job", args);
    },
  };
}

export function setupActionScheduler(requestId: string): Scheduler {
  return {
    runAfter: async (
      delayMs: number,
      functionReference: SchedulableFunctionReference,
      args?: Record<string, Value>,
    ) => {
      const syscallArgs = {
        requestId,
        ...runAfterSyscallArgs(delayMs, functionReference, args),
      };
      return await performAsyncSyscall("1.0/actions/schedule", syscallArgs);
    },
    runAt: async (
      ms_since_epoch_or_date: number | Date,
      functionReference: SchedulableFunctionReference,
      args?: Record<string, Value>,
    ) => {
      const syscallArgs = {
        requestId,
        ...runAtSyscallArgs(ms_since_epoch_or_date, functionReference, args),
      };
      return await performAsyncSyscall("1.0/actions/schedule", syscallArgs);
    },
    cancel: async (id: Id<"_scheduled_functions">) => {
      validateArg(id, 1, "cancel", "id");
      const syscallArgs = { id: convexToJson(id) };
      return await performAsyncSyscall("1.0/actions/cancel_job", syscallArgs);
    },
  };
}

function runAfterSyscallArgs(
  delayMs: number,
  functionReference: SchedulableFunctionReference,
  args?: Record<string, Value>,
) {
  if (typeof delayMs !== "number") {
    throw new Error("`delayMs` must be a number");
  }
  if (!isFinite(delayMs)) {
    throw new Error("`delayMs` must be a finite number");
  }
  if (delayMs < 0) {
    throw new Error("`delayMs` must be non-negative");
  }
  const functionArgs = parseArgs(args);
  const address = getFunctionAddress(functionReference);
  // Note the syscall expects a unix timestamp, measured in seconds.
  const ts = (Date.now() + delayMs) / 1000.0;
  return {
    ...address,
    ts,
    args: convexToJson(functionArgs),
    version,
  };
}

function runAtSyscallArgs(
  ms_since_epoch_or_date: number | Date,
  functionReference: SchedulableFunctionReference,
  args?: Record<string, Value>,
) {
  let ts;
  if (ms_since_epoch_or_date instanceof Date) {
    ts = ms_since_epoch_or_date.valueOf() / 1000.0;
  } else if (typeof ms_since_epoch_or_date === "number") {
    // The timestamp the developer passes is in milliseconds, while the syscall
    // accepts seconds since the epoch.
    ts = ms_since_epoch_or_date / 1000;
  } else {
    throw new Error("The invoke time must a Date or a timestamp");
  }
  const address = getFunctionAddress(functionReference);
  const functionArgs = parseArgs(args);
  return {
    ...address,
    ts,
    args: convexToJson(functionArgs),
    version,
  };
}
