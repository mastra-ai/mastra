export declare class DeepgramError extends Error {
    protected __dgError: boolean;
    constructor(message: string);
}
export declare function isDeepgramError(error: unknown): error is DeepgramError;
export declare class DeepgramApiError extends DeepgramError {
    status: number;
    constructor(message: string, status: number);
    toJSON(): {
        name: string;
        message: string;
        status: number;
    };
}
export declare class DeepgramUnknownError extends DeepgramError {
    originalError: unknown;
    constructor(message: string, originalError: unknown);
}
export declare class DeepgramVersionError extends DeepgramError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map