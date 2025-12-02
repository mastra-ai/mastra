import { AssistantCloudAuthStrategy } from "./AssistantCloudAuthStrategy";
export type AssistantCloudConfig = {
    baseUrl: string;
    authToken: () => Promise<string | null>;
} | {
    apiKey: string;
    userId: string;
    workspaceId: string;
} | {
    baseUrl: string;
    anonymous: true;
};
type MakeRequestOptions = {
    method?: "POST" | "PUT" | "DELETE" | undefined;
    headers?: Record<string, string> | undefined;
    query?: Record<string, string | number | boolean> | undefined;
    body?: object | undefined;
};
export declare class AssistantCloudAPI {
    _auth: AssistantCloudAuthStrategy;
    _baseUrl: string;
    constructor(config: AssistantCloudConfig);
    initializeAuth(): Promise<boolean>;
    makeRawRequest(endpoint: string, options?: MakeRequestOptions): Promise<Response>;
    makeRequest(endpoint: string, options?: MakeRequestOptions): Promise<any>;
}
export {};
//# sourceMappingURL=AssistantCloudAPI.d.ts.map