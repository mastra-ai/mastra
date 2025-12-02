import { Context } from "../../bundler/context.js";
import { FunctionExecution } from "./apiTypes.js";
export type LogMode = "always" | "pause-on-deploy" | "disable";
export declare class LogManager {
    private mode;
    private paused;
    constructor(mode: LogMode);
    waitForUnpaused(): Promise<void>;
    beginDeploy(): void;
    endDeploy(): void;
}
type LogDestination = "stdout" | "stderr";
export declare function logsForDeployment(ctx: Context, credentials: {
    url: string;
    adminKey: string;
}, options: {
    success: boolean;
    history: number;
    jsonl: boolean;
    deploymentNotice: string;
}): Promise<void>;
export declare function watchLogs(ctx: Context, url: string, adminKey: string, dest: LogDestination, options?: {
    success: boolean;
    history?: number | boolean;
    jsonl?: boolean;
    logManager?: LogManager;
}): Promise<void>;
type UdfType = "Query" | "Mutation" | "Action" | "HttpAction";
type StructuredLogLine = {
    messages: string[];
    level: "LOG" | "DEBUG" | "INFO" | "WARN" | "ERROR";
    timestamp: number;
    isTruncated: boolean;
};
type LogLine = string | StructuredLogLine;
export declare function formatFunctionExecutionMessage(timestampMs: number, udfType: UdfType, udfPath: string, executionTimeMs: number): string;
export declare function formatLogLineMessage(type: "info" | "error", timestampMs: number, udfType: UdfType, udfPath: string, message: LogLine): string;
export declare function formatLogsAsText(rawLogs: FunctionExecution[], shouldShowSuccessLogs?: boolean): string;
export {};
//# sourceMappingURL=logs.d.ts.map