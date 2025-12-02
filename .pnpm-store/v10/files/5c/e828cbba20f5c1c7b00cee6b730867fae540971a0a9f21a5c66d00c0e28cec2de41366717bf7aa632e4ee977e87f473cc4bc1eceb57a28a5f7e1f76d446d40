import { AbortError, Decoder, FetchInit, TimeoutError } from "./core";
import { SimpleSession } from "./simple-session";
import { RawHeaders } from "./headers";
import { Request } from "./request";
import { Response } from "./response";
export interface FetchExtra {
    redirected: Array<string>;
    timeoutAt?: number;
}
export interface TimeoutInfo {
    promise: Promise<Response>;
    clear: () => void;
}
export declare function setupFetch(session: SimpleSession, request: Request, init: Partial<FetchInit> | undefined, extra: FetchExtra): Promise<{
    cleanup: () => void;
    contentDecoders: readonly Decoder[];
    endStream: boolean;
    headersToSend: RawHeaders;
    integrity: string;
    method: import("./core").Method;
    onTrailers: import("./core").OnTrailers | undefined;
    origin: string;
    redirect: import("./core").RedirectTypes;
    redirected: string[];
    request: Request;
    signal: import("./abort").AbortSignal | undefined;
    signalPromise: Promise<Response> | null;
    timeoutAt: number | undefined;
    timeoutInfo: TimeoutInfo | null;
    url: string;
}>;
export declare function handleSignalAndTimeout(signalPromise: Promise<Response> | null, timeoutInfo: TimeoutInfo | null, cleanup: () => void, fetcher: () => Promise<Response>, onError: () => void): Promise<any>;
export declare function make100Error(): Error;
export declare function makeAbortedError(): AbortError;
export declare function makeTimeoutError(): TimeoutError;
export declare function makeIllegalRedirectError(): Error;
export declare function makeRedirectionError(location: string | null): Error;
export declare function makeRedirectionMethodError(location: string | null, method: string): Error;
