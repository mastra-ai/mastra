import type { Logger } from '@posthog/core';
type PosthogJsLogger = Omit<Logger, 'createLogger'> & {
    _log: (level: 'log' | 'warn' | 'error', ...args: any[]) => void;
    uninitializedWarning: (methodName: string) => void;
    createLogger: (prefix: string) => PosthogJsLogger;
};
export declare const logger: PosthogJsLogger;
export declare const createLogger: (prefix: string) => PosthogJsLogger;
export {};
