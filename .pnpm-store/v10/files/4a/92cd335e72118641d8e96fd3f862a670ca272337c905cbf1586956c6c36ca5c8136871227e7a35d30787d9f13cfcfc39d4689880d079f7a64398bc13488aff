export interface IAuthentication {
    fetch(authFetchEventId: string): Promise<AuthInfo>;
    fetchOnExpiry(authFetchEventId: string): Promise<AuthInfo>;
}
export declare class AuthInfo {
    private privHeaderName;
    private privToken;
    constructor(headerName: string, token: string);
    get headerName(): string;
    get token(): string;
}
