import { INetworkModule, Logger } from "@azure/msal-common/node";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
export declare const MANAGED_IDENTITY_MACHINE_LEARNING_UNSUPPORTED_ID_TYPE_ERROR: string;
export declare class MachineLearning extends BaseManagedIdentitySource {
    private msiEndpoint;
    private secret;
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean, msiEndpoint: string, secret: string);
    static getEnvironmentVariables(): Array<string | undefined>;
    static tryCreate(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean): MachineLearning | null;
    createRequest(resource: string, managedIdentityId: ManagedIdentityId): ManagedIdentityRequestParameters;
}
//# sourceMappingURL=MachineLearning.d.ts.map