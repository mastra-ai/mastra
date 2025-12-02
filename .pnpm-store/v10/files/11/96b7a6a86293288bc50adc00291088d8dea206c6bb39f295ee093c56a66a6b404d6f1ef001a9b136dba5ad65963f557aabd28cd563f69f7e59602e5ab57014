"use strict";
import { convexToJson, jsonToConvex } from "../../values/index.js";
import { version } from "../../index.js";
import { performAsyncSyscall } from "./syscall.js";
import { parseArgs } from "../../common/index.js";
import { getFunctionAddress } from "../components/paths.js";
function syscallArgs(requestId, functionReference, args) {
  const address = getFunctionAddress(functionReference);
  return {
    ...address,
    args: convexToJson(parseArgs(args)),
    version,
    requestId
  };
}
export function setupActionCalls(requestId) {
  return {
    runQuery: async (query, args) => {
      const result = await performAsyncSyscall(
        "1.0/actions/query",
        syscallArgs(requestId, query, args)
      );
      return jsonToConvex(result);
    },
    runMutation: async (mutation, args) => {
      const result = await performAsyncSyscall(
        "1.0/actions/mutation",
        syscallArgs(requestId, mutation, args)
      );
      return jsonToConvex(result);
    },
    runAction: async (action, args) => {
      const result = await performAsyncSyscall(
        "1.0/actions/action",
        syscallArgs(requestId, action, args)
      );
      return jsonToConvex(result);
    }
  };
}
//# sourceMappingURL=actions_impl.js.map
