import { Authority, INetworkModule, Logger, NetworkRequestOptions, NetworkResponse, ServerAuthorizationTokenResponse, AuthenticationResult } from "@azure/msal-common/node";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { ManagedIdentityRequest } from "../../request/ManagedIdentityRequest.js";
import { ManagedIdentityIdType } from "../../utils/Constants.js";
import { ManagedIdentityTokenResponse } from "../../response/ManagedIdentityTokenResponse.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
/**
 * Managed Identity User Assigned Id Query Parameter Names
 */
export declare const ManagedIdentityUserAssignedIdQueryParameterNames: {
    readonly MANAGED_IDENTITY_CLIENT_ID_2017: "clientid";
    readonly MANAGED_IDENTITY_CLIENT_ID: "client_id";
    readonly MANAGED_IDENTITY_OBJECT_ID: "object_id";
    readonly MANAGED_IDENTITY_RESOURCE_ID_IMDS: "msi_res_id";
    readonly MANAGED_IDENTITY_RESOURCE_ID_NON_IMDS: "mi_res_id";
};
export type ManagedIdentityUserAssignedIdQueryParameterNames = (typeof ManagedIdentityUserAssignedIdQueryParameterNames)[keyof typeof ManagedIdentityUserAssignedIdQueryParameterNames];
export declare abstract class BaseManagedIdentitySource {
    protected logger: Logger;
    private nodeStorage;
    private networkClient;
    private cryptoProvider;
    private disableInternalRetries;
    constructor(logger: Logger, nodeStorage: NodeStorage, networkClient: INetworkModule, cryptoProvider: CryptoProvider, disableInternalRetries: boolean);
    abstract createRequest(request: string, managedIdentityId: ManagedIdentityId): ManagedIdentityRequestParameters;
    getServerTokenResponseAsync(response: NetworkResponse<ManagedIdentityTokenResponse>, _networkClient: INetworkModule, _networkRequest: ManagedIdentityRequestParameters, _networkRequestOptions: NetworkRequestOptions): Promise<ServerAuthorizationTokenResponse>;
    getServerTokenResponse(response: NetworkResponse<ManagedIdentityTokenResponse>): ServerAuthorizationTokenResponse;
    acquireTokenWithManagedIdentity(managedIdentityRequest: ManagedIdentityRequest, managedIdentityId: ManagedIdentityId, fakeAuthority: Authority, refreshAccessToken?: boolean): Promise<AuthenticationResult>;
    getManagedIdentityUserAssignedIdQueryParameterKey(managedIdentityIdType: ManagedIdentityIdType, isImds?: boolean, usesApi2017?: boolean): string;
    static getValidatedEnvVariableUrlString: (envVariableStringName: string, envVariable: string, sourceName: string, logger: Logger) => string;
}
//# sourceMappingURL=BaseManagedIdentitySource.d.ts.map