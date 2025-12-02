import { MessageStatus } from "../../types";
export declare const isAutoStatus: (status: MessageStatus) => boolean;
export declare const getAutoStatus: (isLast: boolean, isRunning: boolean, hasPendingToolCalls: boolean) => Readonly<{
    type: "running";
}> | Readonly<{
    type: "complete";
    reason: "unknown";
}> | Readonly<{
    type: "requires-action";
    reason: "tool-calls";
}>;
//# sourceMappingURL=auto-status.d.ts.map