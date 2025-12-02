import { INetworkModule, Logger } from "@azure/msal-common/node";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/AppServiceManagedIdentitySource.cs
 */
export declare class AppService extends BaseManagedIdentitySource {
    private identityEndpoint;
    private identityHeader;
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, identityEndpoint: string, identityHeader: string);
    static getEnvironmentVariables(): Array<string | undefined>;
    static tryCreate(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean): AppService | null;
    createRequest(resource: string, managedIdentityId: ManagedIdentityId): ManagedIdentityRequestParameters;
}
//# sourceMappingURL=AppService.d.ts.map