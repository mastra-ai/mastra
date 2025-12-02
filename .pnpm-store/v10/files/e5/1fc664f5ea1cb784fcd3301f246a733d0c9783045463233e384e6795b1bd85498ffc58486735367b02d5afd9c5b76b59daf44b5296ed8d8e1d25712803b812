import type { FunctionExecutionJson, LogLineJson } from "./generatedFunctionLogsApi.js";
export type FunctionExecution = (Omit<Extract<FunctionExecutionJson, {
    kind: "Completion";
}>, "logLines"> & {
    kind: "Completion";
    logLines: LogLineJson[];
}) | (Omit<Extract<FunctionExecutionJson, {
    kind: "Progress";
}>, "logLines"> & {
    kind: "Progress";
    logLines: LogLineJson[];
});
//# sourceMappingURL=apiTypes.d.ts.map