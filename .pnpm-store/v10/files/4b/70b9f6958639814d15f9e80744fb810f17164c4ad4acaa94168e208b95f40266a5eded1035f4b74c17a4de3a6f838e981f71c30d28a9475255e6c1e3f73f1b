export type AssistantCloudAuthStrategy = {
    readonly strategy: "anon" | "jwt" | "api-key";
    getAuthHeaders(): Promise<Record<string, string> | false>;
    readAuthHeaders(headers: Headers): void;
};
export declare class AssistantCloudJWTAuthStrategy implements AssistantCloudAuthStrategy {
    #private;
    readonly strategy = "jwt";
    private cachedToken;
    private tokenExpiry;
    constructor(authTokenCallback: () => Promise<string | null>);
    getAuthHeaders(): Promise<Record<string, string> | false>;
    readAuthHeaders(headers: Headers): void;
}
export declare class AssistantCloudAPIKeyAuthStrategy implements AssistantCloudAuthStrategy {
    #private;
    readonly strategy = "api-key";
    constructor(apiKey: string, userId: string, workspaceId: string);
    getAuthHeaders(): Promise<Record<string, string>>;
    readAuthHeaders(): void;
}
export declare class AssistantCloudAnonymousAuthStrategy implements AssistantCloudAuthStrategy {
    readonly strategy = "anon";
    private baseUrl;
    private jwtStrategy;
    constructor(baseUrl: string);
    getAuthHeaders(): Promise<Record<string, string> | false>;
    readAuthHeaders(headers: Headers): void;
}
//# sourceMappingURL=AssistantCloudAuthStrategy.d.ts.map