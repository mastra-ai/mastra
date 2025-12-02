import type { ClerkUrl } from './clerkUrl';
/**
 * A class that extends the native Request class,
 * adds cookies helpers and a normalised clerkUrl that is constructed by using the values found
 * in req.headers so it is able to work reliably when the app is running behind a proxy server.
 */
declare class ClerkRequest extends Request {
    readonly clerkUrl: ClerkUrl;
    readonly cookies: Map<string, string | undefined>;
    constructor(input: ClerkRequest | Request | RequestInfo, init?: RequestInit);
    toJSON(): {
        url: string;
        method: string;
        headers: string;
        clerkUrl: string;
        cookies: string;
    };
    /**
     * Used to fix request.url using the x-forwarded-* headers
     * TODO add detailed description of the issues this solves
     */
    private deriveUrlFromHeaders;
    private getFirstValueFromHeader;
    private parseCookies;
    private decodeCookieValue;
}
export declare const createClerkRequest: (...args: ConstructorParameters<typeof ClerkRequest>) => ClerkRequest;
export type { ClerkRequest };
//# sourceMappingURL=clerkRequest.d.ts.map