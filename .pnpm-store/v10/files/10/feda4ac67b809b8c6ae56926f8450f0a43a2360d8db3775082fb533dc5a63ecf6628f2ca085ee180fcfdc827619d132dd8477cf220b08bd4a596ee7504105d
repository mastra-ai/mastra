import { LogLevel } from "./LogLevel.js";
declare type LogCallback = (s: string) => void;
/**
 * Defines diagnostics API for managing console output
 * Added in version 1.21.0
 */
export declare class Diagnostics {
    private static privListener;
    static SetLoggingLevel(logLevel: LogLevel): void;
    static StartConsoleOutput(): void;
    static StopConsoleOutput(): void;
    static SetLogOutputPath(path: string): void;
    static set onLogOutput(callback: LogCallback);
}
export {};
