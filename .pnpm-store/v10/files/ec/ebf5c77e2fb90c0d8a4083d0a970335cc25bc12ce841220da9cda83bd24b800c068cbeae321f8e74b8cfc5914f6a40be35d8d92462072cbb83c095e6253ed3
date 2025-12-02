import { ReverificationConfig } from '@clerk/types';

type ClerkError<T> = {
    clerk_error: T;
};
declare const REVERIFICATION_REASON = "reverification-error";
type ReverificationError<M extends {
    metadata?: any;
} = {
    metadata: unknown;
}> = ClerkError<{
    type: 'forbidden';
    reason: typeof REVERIFICATION_REASON;
} & M>;
declare const reverificationError: <MC extends ReverificationConfig>(missingConfig?: MC) => ReverificationError<{
    metadata?: {
        reverification?: MC;
    };
}>;
declare const reverificationErrorResponse: (...args: Parameters<typeof reverificationError>) => Response;
declare const isReverificationHint: (result: any) => result is ReturnType<typeof reverificationError>;

export { isReverificationHint, reverificationError, reverificationErrorResponse };
