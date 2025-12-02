/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import { INetworkModule, NetworkRequestOptions, NetworkResponse } from "@azure/msal-common/node";
import http from "http";
import https from "https";
/**
 * This class implements the API for network requests.
 */
export declare class HttpClient implements INetworkModule {
    private proxyUrl;
    private customAgentOptions;
    constructor(proxyUrl?: string, customAgentOptions?: http.AgentOptions | https.AgentOptions);
    /**
     * Http Get request
     * @param url
     * @param options
     */
    sendGetRequestAsync<T>(url: string, options?: NetworkRequestOptions, timeout?: number): Promise<NetworkResponse<T>>;
    /**
     * Http Post request
     * @param url
     * @param options
     */
    sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse<T>>;
}
//# sourceMappingURL=HttpClient.d.ts.map