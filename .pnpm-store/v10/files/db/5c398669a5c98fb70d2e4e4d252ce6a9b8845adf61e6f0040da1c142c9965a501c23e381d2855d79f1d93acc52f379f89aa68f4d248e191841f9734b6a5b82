import { ClerkAPIError as ClerkAPIError$1, ClerkAPIErrorJSON, ClerkAPIResponseError as ClerkAPIResponseError$1 } from '@clerk/types';

type ClerkApiErrorMeta = Record<string, unknown>;
/**
 * This error contains the specific error message, code, and any additional metadata that was returned by the Clerk API.
 */
declare class ClerkAPIError<Meta extends ClerkApiErrorMeta = any> implements ClerkAPIError$1 {
    static kind: string;
    readonly code: string;
    readonly message: string;
    readonly longMessage: string | undefined;
    readonly meta: Meta;
    constructor(json: ClerkAPIErrorJSON);
    private parseJsonError;
}

interface ClerkErrorParams {
    /**
     * A message that describes the error. This is typically intented to be showed to the developers.
     * It should not be shown to the user or parsed directly as the message contents are not guaranteed
     * to be stable - use the `code` property instead.
     */
    message: string;
    /**
     * A machine-stable code that identifies the error.
     */
    code: string;
    /**
     * A user-friendly message that describes the error and can be displayed to the user.
     * This message defaults to English but can be usually translated to the user's language
     * by matching the `code` property to a localized message.
     */
    longMessage?: string;
    /**
     * The cause of the error, typically an `Error` instance that was caught and wrapped by the Clerk error handler.
     */
    cause?: Error;
    /**
     * A URL to the documentation for the error.
     */
    docsUrl?: string;
}
declare class ClerkError extends Error {
    static kind: string;
    readonly clerkError: true;
    readonly code: string;
    readonly longMessage: string | undefined;
    readonly docsUrl: string | undefined;
    readonly cause: Error | undefined;
    get name(): string;
    constructor(opts: ClerkErrorParams);
    toString(): string;
    protected static formatMessage(name: string, msg: string, code: string, docsUrl: string | undefined): string;
}

interface ClerkAPIResponseOptions extends Omit<ClerkErrorParams, 'message' | 'code'> {
    data: ClerkAPIErrorJSON[];
    status: number;
    clerkTraceId?: string;
    retryAfter?: number;
}
declare class ClerkAPIResponseError extends ClerkError implements ClerkAPIResponseError$1 {
    static kind: string;
    status: number;
    clerkTraceId?: string;
    retryAfter?: number;
    errors: ClerkAPIError[];
    constructor(message: string, options: ClerkAPIResponseOptions);
    toString(): string;
    protected static formatMessage(name: string, msg: string, _: string, __: string | undefined): string;
}

export { ClerkAPIError as C, ClerkAPIResponseError as a, ClerkError as b, type ClerkErrorParams as c };
