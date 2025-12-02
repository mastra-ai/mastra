import type { RequestState } from './authStatus';
import type { AuthenticateRequestOptions } from './types';
export declare const RefreshTokenErrorReason: {
    readonly NonEligibleNoCookie: "non-eligible-no-refresh-cookie";
    readonly NonEligibleNonGet: "non-eligible-non-get";
    readonly InvalidSessionToken: "invalid-session-token";
    readonly MissingApiClient: "missing-api-client";
    readonly MissingSessionToken: "missing-session-token";
    readonly MissingRefreshToken: "missing-refresh-token";
    readonly ExpiredSessionTokenDecodeFailed: "expired-session-token-decode-failed";
    readonly ExpiredSessionTokenMissingSidClaim: "expired-session-token-missing-sid-claim";
    readonly FetchError: "fetch-error";
    readonly UnexpectedSDKError: "unexpected-sdk-error";
    readonly UnexpectedBAPIError: "unexpected-bapi-error";
};
export declare function authenticateRequest(request: Request, options: AuthenticateRequestOptions): Promise<RequestState>;
/**
 * @internal
 */
export declare const debugRequestState: (params: RequestState) => {
    isSignedIn: boolean;
    proxyUrl: string | undefined;
    reason: string | null;
    message: string | null;
    publishableKey: string;
    isSatellite: boolean;
    domain: string;
};
//# sourceMappingURL=request.d.ts.map