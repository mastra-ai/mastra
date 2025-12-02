import type { ClerkAPIError } from '@clerk/types';
export type ClerkBackendApiRequestOptions = {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    queryParams?: Record<string, unknown>;
    headerParams?: Record<string, string>;
    bodyParams?: Record<string, unknown> | Array<Record<string, unknown>>;
    formData?: FormData;
} & ({
    url: string;
    path?: string;
} | {
    url?: string;
    path: string;
});
export type ClerkBackendApiResponse<T> = {
    data: T;
    errors: null;
    totalCount?: number;
} | {
    data: null;
    errors: ClerkAPIError[];
    totalCount?: never;
    clerkTraceId?: string;
    status?: number;
    statusText?: string;
    retryAfter?: number;
};
export type RequestFunction = ReturnType<typeof buildRequest>;
type BuildRequestOptions = {
    secretKey?: string;
    apiUrl?: string;
    apiVersion?: string;
    userAgent?: string;
    /**
     * Allow requests without specifying a secret key. In most cases this should be set to `false`.
     * @default true
     */
    requireSecretKey?: boolean;
};
export declare function buildRequest(options: BuildRequestOptions): LegacyRequestFunction;
type LegacyRequestFunction = <T>(requestOptions: ClerkBackendApiRequestOptions) => Promise<T>;
export {};
//# sourceMappingURL=request.d.ts.map