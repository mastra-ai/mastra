import { convexToJson, jsonToConvex, Value } from "../../values/index.js";
import { version } from "../../index.js";
import { performAsyncSyscall } from "./syscall.js";
import { parseArgs } from "../../common/index.js";
import { FunctionReference } from "../../server/api.js";
import { getFunctionAddress } from "../components/paths.js";

function syscallArgs(
  requestId: string,
  functionReference: any,
  args?: Record<string, Value>,
) {
  const address = getFunctionAddress(functionReference);
  return {
    ...address,
    args: convexToJson(parseArgs(args)),
    version,
    requestId,
  };
}

export function setupActionCalls(requestId: string) {
  return {
    runQuery: async (
      query: FunctionReference<"query", "public" | "internal">,
      args?: Record<string, Value>,
    ): Promise<any> => {
      const result = await performAsyncSyscall(
        "1.0/actions/query",
        syscallArgs(requestId, query, args),
      );
      return jsonToConvex(result);
    },
    runMutation: async (
      mutation: FunctionReference<"mutation", "public" | "internal">,
      args?: Record<string, Value>,
    ): Promise<any> => {
      const result = await performAsyncSyscall(
        "1.0/actions/mutation",
        syscallArgs(requestId, mutation, args),
      );
      return jsonToConvex(result);
    },
    runAction: async (
      action: FunctionReference<"action", "public" | "internal">,
      args?: Record<string, Value>,
    ): Promise<any> => {
      const result = await performAsyncSyscall(
        "1.0/actions/action",
        syscallArgs(requestId, action, args),
      );
      return jsonToConvex(result);
    },
  };
}
