import type { SessionStatusClaim } from '@clerk/types';
type RedirectAdapter<RedirectReturn> = (url: string) => RedirectReturn;
type RedirectToParams = {
    returnBackUrl?: string | URL | null;
};
export type RedirectFun<ReturnType> = (params?: RedirectToParams) => ReturnType;
/**
 * @internal
 */
type CreateRedirect = <ReturnType>(params: {
    publishableKey: string;
    devBrowserToken?: string;
    redirectAdapter: RedirectAdapter<ReturnType>;
    baseUrl: URL | string;
    signInUrl?: URL | string;
    signUpUrl?: URL | string;
    sessionStatus?: SessionStatusClaim | null;
}) => {
    redirectToSignIn: RedirectFun<ReturnType>;
    redirectToSignUp: RedirectFun<ReturnType>;
};
export declare const createRedirect: CreateRedirect;
export {};
//# sourceMappingURL=createRedirect.d.ts.map