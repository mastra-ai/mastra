import { INetworkModule, NetworkResponse, NetworkRequestOptions, Logger, ServerAuthorizationTokenResponse } from "@azure/msal-common/node";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
import { ManagedIdentityTokenResponse } from "../../response/ManagedIdentityTokenResponse.js";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
export declare const ARC_API_VERSION: string;
export declare const DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT: string;
type FilePathMap = {
    win32: string;
    linux: string;
};
export declare const SUPPORTED_AZURE_ARC_PLATFORMS: FilePathMap;
export declare const AZURE_ARC_FILE_DETECTION: FilePathMap;
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/AzureArcManagedIdentitySource.cs
 */
export declare class AzureArc extends BaseManagedIdentitySource {
    private identityEndpoint;
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, identityEndpoint: string);
    static getEnvironmentVariables(): Array<string | undefined>;
    static tryCreate(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, managedIdentityId: ManagedIdentityId): AzureArc | null;
    createRequest(resource: string): ManagedIdentityRequestParameters;
    getServerTokenResponseAsync(originalResponse: NetworkResponse<ManagedIdentityTokenResponse>, networkClient: INetworkModule, networkRequest: ManagedIdentityRequestParameters, networkRequestOptions: NetworkRequestOptions): Promise<ServerAuthorizationTokenResponse>;
}
export {};
//# sourceMappingURL=AzureArc.d.ts.map