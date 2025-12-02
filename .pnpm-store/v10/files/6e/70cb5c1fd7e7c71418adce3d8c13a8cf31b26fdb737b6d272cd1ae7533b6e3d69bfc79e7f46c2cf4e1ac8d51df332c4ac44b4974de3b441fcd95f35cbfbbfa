import type { ApiClient } from '../api';
import type { AuthenticateRequestOptions } from './types';
type RunTimeOptions = Omit<AuthenticateRequestOptions, 'apiUrl' | 'apiVersion'>;
type BuildTimeOptions = Partial<Pick<AuthenticateRequestOptions, 'apiUrl' | 'apiVersion' | 'audience' | 'domain' | 'isSatellite' | 'jwtKey' | 'proxyUrl' | 'publishableKey' | 'secretKey'>>;
/**
 * @internal
 */
export type CreateAuthenticateRequestOptions = {
    options: BuildTimeOptions;
    apiClient: ApiClient;
};
/**
 * @internal
 */
export declare function createAuthenticateRequest(params: CreateAuthenticateRequestOptions): {
    authenticateRequest: (request: Request, options?: RunTimeOptions) => Promise<import("./authStatus").RequestState>;
    debugRequestState: (params: import("./authStatus").RequestState) => {
        isSignedIn: boolean;
        proxyUrl: string | undefined;
        reason: string | null;
        message: string | null;
        publishableKey: string;
        isSatellite: boolean;
        domain: string;
    };
};
export {};
//# sourceMappingURL=factory.d.ts.map