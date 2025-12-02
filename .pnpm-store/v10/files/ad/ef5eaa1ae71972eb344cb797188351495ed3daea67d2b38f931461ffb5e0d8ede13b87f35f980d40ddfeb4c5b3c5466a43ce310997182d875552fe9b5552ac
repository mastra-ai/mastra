import { ThreadMessageLike } from "./ThreadMessageLike";
export declare namespace useExternalMessageConverter {
    type Message = (ThreadMessageLike & {
        readonly convertConfig?: {
            readonly joinStrategy?: "concat-content" | "none";
        };
    }) | {
        role: "tool";
        toolCallId: string;
        toolName?: string | undefined;
        result: any;
        artifact?: any;
        isError?: boolean;
    };
    type Callback<T> = (message: T) => Message | Message[];
}
export declare const convertExternalMessages: <T extends WeakKey>(messages: T[], callback: useExternalMessageConverter.Callback<T>, isRunning: boolean) => import("../..").ThreadMessage[];
export declare const useExternalMessageConverter: <T extends WeakKey>({ callback, messages, isRunning, joinStrategy, }: {
    callback: useExternalMessageConverter.Callback<T>;
    messages: T[];
    isRunning: boolean;
    joinStrategy?: "concat-content" | "none" | undefined;
}) => import("../..").ThreadMessage[];
//# sourceMappingURL=external-message-converter.d.ts.map