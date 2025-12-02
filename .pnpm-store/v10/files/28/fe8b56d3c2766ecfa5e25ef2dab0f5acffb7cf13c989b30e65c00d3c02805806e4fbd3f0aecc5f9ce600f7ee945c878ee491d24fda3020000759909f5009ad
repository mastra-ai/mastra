import { INetworkModule, Logger } from "@azure/msal-common/node";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/ImdsManagedIdentitySource.cs
 */
export declare class Imds extends BaseManagedIdentitySource {
    private identityEndpoint;
    /**
     * Constructs an Imds instance.
     * @param logger - Logger instance for logging.
     * @param nodeStorage - NodeStorage instance for caching.
     * @param networkClient - Network client for HTTP requests.
     * @param cryptoProvider - CryptoProvider for cryptographic operations.
     * @param disableInternalRetries - Whether to disable internal retry logic.
     * @param identityEndpoint - The IMDS endpoint to use.
     */
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, identityEndpoint: string);
    /**
     * Attempts to create an Imds instance by determining the correct endpoint.
     * If the AZURE_POD_IDENTITY_AUTHORITY_HOST environment variable is set, it uses that as the endpoint.
     * Otherwise, it falls back to the default IMDS endpoint.
     *
     * @param logger - Logger instance for logging.
     * @param nodeStorage - NodeStorage instance for caching.
     * @param networkClient - Network client for HTTP requests.
     * @param cryptoProvider - CryptoProvider for cryptographic operations.
     * @param disableInternalRetries - Whether to disable internal retry logic.
     * @returns An instance of Imds configured with the appropriate endpoint.
     */
    static tryCreate(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean): Imds;
    /**
     * Creates a ManagedIdentityRequestParameters object for acquiring a token from IMDS.
     * Sets the required headers and query parameters for the IMDS token request.
     *
     * @param resource - The resource URI for which the token is requested.
     * @param managedIdentityId - The managed identity ID (system-assigned or user-assigned).
     * @returns A ManagedIdentityRequestParameters object configured for IMDS.
     */
    createRequest(resource: string, managedIdentityId: ManagedIdentityId): ManagedIdentityRequestParameters;
}
//# sourceMappingURL=Imds.d.ts.map