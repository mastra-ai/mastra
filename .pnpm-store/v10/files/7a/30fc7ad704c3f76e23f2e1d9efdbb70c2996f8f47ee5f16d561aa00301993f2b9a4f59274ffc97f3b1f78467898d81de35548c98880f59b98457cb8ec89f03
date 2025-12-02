import { ProgressBarInstance, ProgressBarOptions } from "../vendor/progress/index.js";
export declare function logError(message: string): void;
export declare function logWarning(...logged: any): void;
export declare function logMessage(...logged: any): void;
export declare function logOutput(...logged: any): void;
export declare function logVerbose(...logged: any): void;
/**
 * Returns a ProgressBar instance, and also handles clearing the spinner if necessary.
 *
 * The caller is responsible for calling `progressBar.tick()` and terminating the `progressBar`
 * when it's done.
 */
export declare function startLogProgress(format: string, progressBarOptions: ProgressBarOptions): ProgressBarInstance;
export declare function showSpinner(message: string): void;
export declare function changeSpinner(message: string): void;
export declare function failExistingSpinner(): void;
export declare function logFailure(message: string): void;
export declare function logFinishedStep(message: string): void;
export declare function stopSpinner(): void;
export declare function showSpinnerIfSlow(message: string, delayMs: number, fn: () => Promise<any>): Promise<void>;
//# sourceMappingURL=log.d.ts.map