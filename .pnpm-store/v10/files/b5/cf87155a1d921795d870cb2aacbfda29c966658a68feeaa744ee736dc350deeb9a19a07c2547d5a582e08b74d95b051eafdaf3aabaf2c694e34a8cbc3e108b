import { ThreadState } from "../../api";
import { ThreadMessage } from "../../types";
import { useExternalMessageConverter } from "./external-message-converter";
export declare const createMessageConverter: <T extends object>(callback: useExternalMessageConverter.Callback<T>) => {
    useThreadMessages: ({ messages, isRunning, joinStrategy, }: {
        messages: T[];
        isRunning: boolean;
        joinStrategy?: "concat-content" | "none" | undefined;
    }) => ThreadMessage[];
    toThreadMessages: (messages: T[]) => ThreadMessage[];
    toOriginalMessages: (input: ThreadState | ThreadMessage | ThreadMessage["content"][number]) => unknown[];
    toOriginalMessage: (input: ThreadState | ThreadMessage | ThreadMessage["content"][number]) => {};
    useOriginalMessage: () => T;
    useOriginalMessages: () => T[];
};
//# sourceMappingURL=createMessageConverter.d.ts.map