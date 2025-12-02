import { AuthInfo, IAuthentication } from "./IAuthentication.js";
export declare class CognitiveTokenAuthentication implements IAuthentication {
    private static privTokenPrefix;
    private privFetchCallback;
    private privFetchOnExpiryCallback;
    constructor(fetchCallback: (authFetchEventId: string) => Promise<string>, fetchOnExpiryCallback: (authFetchEventId: string) => Promise<string>);
    fetch(authFetchEventId: string): Promise<AuthInfo>;
    fetchOnExpiry(authFetchEventId: string): Promise<AuthInfo>;
}
