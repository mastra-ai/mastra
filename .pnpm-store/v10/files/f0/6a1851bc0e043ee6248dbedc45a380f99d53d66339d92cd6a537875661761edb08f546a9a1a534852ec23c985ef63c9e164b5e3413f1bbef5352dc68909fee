import { INetworkModule, Logger } from "@azure/msal-common/node";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/CloudShellManagedIdentitySource.cs
 */
export declare class CloudShell extends BaseManagedIdentitySource {
    private msiEndpoint;
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, msiEndpoint: string);
    static getEnvironmentVariables(): Array<string | undefined>;
    static tryCreate(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, managedIdentityId: ManagedIdentityId): CloudShell | null;
    createRequest(resource: string): ManagedIdentityRequestParameters;
}
//# sourceMappingURL=CloudShell.d.ts.map