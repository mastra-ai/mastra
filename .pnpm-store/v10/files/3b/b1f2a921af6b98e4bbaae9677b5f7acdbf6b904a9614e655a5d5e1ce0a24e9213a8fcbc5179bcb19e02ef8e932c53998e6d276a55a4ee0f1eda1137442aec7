import { INetworkModule, Logger } from "@azure/msal-common/node";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/ServiceFabricManagedIdentitySource.cs
 */
export declare class ServiceFabric extends BaseManagedIdentitySource {
    private identityEndpoint;
    private identityHeader;
    /**
     * Constructs a new ServiceFabric managed identity source.
     * @param logger Logger instance for logging
     * @param nodeStorage NodeStorage instance for caching
     * @param networkClient Network client for HTTP requests
     * @param cryptoProvider Crypto provider for cryptographic operations
     * @param disableInternalRetries Whether to disable internal retry logic
     * @param identityEndpoint The Service Fabric managed identity endpoint
     * @param identityHeader The Service Fabric managed identity secret header
     */
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, identityEndpoint: string, identityHeader: string);
    /**
     * Retrieves the environment variables required for Service Fabric managed identity.
     * @returns An array containing the identity endpoint, identity header, and identity server thumbprint.
     */
    static getEnvironmentVariables(): Array<string | undefined>;
    /**
     * Attempts to create a ServiceFabric managed identity source if all required environment variables are present.
     * @param logger Logger instance for logging
     * @param nodeStorage NodeStorage instance for caching
     * @param networkClient Network client for HTTP requests
     * @param cryptoProvider Crypto provider for cryptographic operations
     * @param disableInternalRetries Whether to disable internal retry logic
     * @param managedIdentityId Managed identity identifier
     * @returns A ServiceFabric instance if environment variables are set, otherwise null
     */
    static tryCreate(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, managedIdentityId: ManagedIdentityId): ServiceFabric | null;
    /**
     * Creates the request parameters for acquiring a token from the Service Fabric cluster.
     * @param resource - The resource URI for which the token is requested.
     * @param managedIdentityId - The managed identity ID (system-assigned or user-assigned).
     * @returns A ManagedIdentityRequestParameters object configured for Service Fabric.
     */
    createRequest(resource: string, managedIdentityId: ManagedIdentityId): ManagedIdentityRequestParameters;
}
//# sourceMappingURL=ServiceFabric.d.ts.map