// The generated type is not specific enough:
// some clients receive strings, but the CLI
// receives structured log lines.
import type {
  FunctionExecutionJson,
  LogLineJson,
} from "./generatedFunctionLogsApi.js";
export type FunctionExecution =
  | (Omit<
      Extract<FunctionExecutionJson, { kind: "Completion" }>,
      "logLines"
    > & {
      kind: "Completion";
      logLines: LogLineJson[];
    })
  | (Omit<Extract<FunctionExecutionJson, { kind: "Progress" }>, "logLines"> & {
      kind: "Progress";
      logLines: LogLineJson[];
    });
