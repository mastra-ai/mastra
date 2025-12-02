"use strict";
import { convexToJson } from "../../values/index.js";
import { version } from "../../index.js";
import { performAsyncSyscall } from "./syscall.js";
import { parseArgs } from "../../common/index.js";
import { validateArg } from "./validate.js";
import { getFunctionAddress } from "../components/paths.js";
export function setupMutationScheduler() {
  return {
    runAfter: async (delayMs, functionReference, args) => {
      const syscallArgs = runAfterSyscallArgs(delayMs, functionReference, args);
      return await performAsyncSyscall("1.0/schedule", syscallArgs);
    },
    runAt: async (ms_since_epoch_or_date, functionReference, args) => {
      const syscallArgs = runAtSyscallArgs(
        ms_since_epoch_or_date,
        functionReference,
        args
      );
      return await performAsyncSyscall("1.0/schedule", syscallArgs);
    },
    cancel: async (id) => {
      validateArg(id, 1, "cancel", "id");
      const args = { id: convexToJson(id) };
      await performAsyncSyscall("1.0/cancel_job", args);
    }
  };
}
export function setupActionScheduler(requestId) {
  return {
    runAfter: async (delayMs, functionReference, args) => {
      const syscallArgs = {
        requestId,
        ...runAfterSyscallArgs(delayMs, functionReference, args)
      };
      return await performAsyncSyscall("1.0/actions/schedule", syscallArgs);
    },
    runAt: async (ms_since_epoch_or_date, functionReference, args) => {
      const syscallArgs = {
        requestId,
        ...runAtSyscallArgs(ms_since_epoch_or_date, functionReference, args)
      };
      return await performAsyncSyscall("1.0/actions/schedule", syscallArgs);
    },
    cancel: async (id) => {
      validateArg(id, 1, "cancel", "id");
      const syscallArgs = { id: convexToJson(id) };
      return await performAsyncSyscall("1.0/actions/cancel_job", syscallArgs);
    }
  };
}
function runAfterSyscallArgs(delayMs, functionReference, args) {
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
  const ts = (Date.now() + delayMs) / 1e3;
  return {
    ...address,
    ts,
    args: convexToJson(functionArgs),
    version
  };
}
function runAtSyscallArgs(ms_since_epoch_or_date, functionReference, args) {
  let ts;
  if (ms_since_epoch_or_date instanceof Date) {
    ts = ms_since_epoch_or_date.valueOf() / 1e3;
  } else if (typeof ms_since_epoch_or_date === "number") {
    ts = ms_since_epoch_or_date / 1e3;
  } else {
    throw new Error("The invoke time must a Date or a timestamp");
  }
  const address = getFunctionAddress(functionReference);
  const functionArgs = parseArgs(args);
  return {
    ...address,
    ts,
    args: convexToJson(functionArgs),
    version
  };
}
//# sourceMappingURL=scheduler_impl.js.map
