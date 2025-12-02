"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var scheduler_impl_exports = {};
__export(scheduler_impl_exports, {
  setupActionScheduler: () => setupActionScheduler,
  setupMutationScheduler: () => setupMutationScheduler
});
module.exports = __toCommonJS(scheduler_impl_exports);
var import_values = require("../../values/index.js");
var import__ = require("../../index.js");
var import_syscall = require("./syscall.js");
var import_common = require("../../common/index.js");
var import_validate = require("./validate.js");
var import_paths = require("../components/paths.js");
function setupMutationScheduler() {
  return {
    runAfter: async (delayMs, functionReference, args) => {
      const syscallArgs = runAfterSyscallArgs(delayMs, functionReference, args);
      return await (0, import_syscall.performAsyncSyscall)("1.0/schedule", syscallArgs);
    },
    runAt: async (ms_since_epoch_or_date, functionReference, args) => {
      const syscallArgs = runAtSyscallArgs(
        ms_since_epoch_or_date,
        functionReference,
        args
      );
      return await (0, import_syscall.performAsyncSyscall)("1.0/schedule", syscallArgs);
    },
    cancel: async (id) => {
      (0, import_validate.validateArg)(id, 1, "cancel", "id");
      const args = { id: (0, import_values.convexToJson)(id) };
      await (0, import_syscall.performAsyncSyscall)("1.0/cancel_job", args);
    }
  };
}
function setupActionScheduler(requestId) {
  return {
    runAfter: async (delayMs, functionReference, args) => {
      const syscallArgs = {
        requestId,
        ...runAfterSyscallArgs(delayMs, functionReference, args)
      };
      return await (0, import_syscall.performAsyncSyscall)("1.0/actions/schedule", syscallArgs);
    },
    runAt: async (ms_since_epoch_or_date, functionReference, args) => {
      const syscallArgs = {
        requestId,
        ...runAtSyscallArgs(ms_since_epoch_or_date, functionReference, args)
      };
      return await (0, import_syscall.performAsyncSyscall)("1.0/actions/schedule", syscallArgs);
    },
    cancel: async (id) => {
      (0, import_validate.validateArg)(id, 1, "cancel", "id");
      const syscallArgs = { id: (0, import_values.convexToJson)(id) };
      return await (0, import_syscall.performAsyncSyscall)("1.0/actions/cancel_job", syscallArgs);
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
  const functionArgs = (0, import_common.parseArgs)(args);
  const address = (0, import_paths.getFunctionAddress)(functionReference);
  const ts = (Date.now() + delayMs) / 1e3;
  return {
    ...address,
    ts,
    args: (0, import_values.convexToJson)(functionArgs),
    version: import__.version
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
  const address = (0, import_paths.getFunctionAddress)(functionReference);
  const functionArgs = (0, import_common.parseArgs)(args);
  return {
    ...address,
    ts,
    args: (0, import_values.convexToJson)(functionArgs),
    version: import__.version
  };
}
//# sourceMappingURL=scheduler_impl.js.map
