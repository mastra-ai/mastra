/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    AuthError,
    Authority,
    ClientAuthErrorCodes,
    Constants,
    HeaderNames,
    INetworkModule,
    Logger,
    NetworkRequestOptions,
    NetworkResponse,
    ResponseHandler,
    ServerAuthorizationTokenResponse,
    TimeUtils,
    createClientAuthError,
    AuthenticationResult,
    UrlString,
} from "@azure/msal-common/node";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { ManagedIdentityRequest } from "../../request/ManagedIdentityRequest.js";
import {
    HttpMethod,
    ManagedIdentityIdType,
    ManagedIdentityQueryParameters,
} from "../../utils/Constants.js";
import { ManagedIdentityTokenResponse } from "../../response/ManagedIdentityTokenResponse.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
import {
    ManagedIdentityErrorCodes,
    createManagedIdentityError,
} from "../../error/ManagedIdentityError.js";
import { isIso8601 } from "../../utils/TimeUtils.js";
import { HttpClientWithRetries } from "../../network/HttpClientWithRetries.js";

/**
 * Managed Identity User Assigned Id Query Parameter Names
 */
export const ManagedIdentityUserAssignedIdQueryParameterNames = {
    MANAGED_IDENTITY_CLIENT_ID_2017: "clientid", // 2017-09-01 API version
    MANAGED_IDENTITY_CLIENT_ID: "client_id", // 2019+ API versions
    MANAGED_IDENTITY_OBJECT_ID: "object_id",
    MANAGED_IDENTITY_RESOURCE_ID_IMDS: "msi_res_id",
    MANAGED_IDENTITY_RESOURCE_ID_NON_IMDS: "mi_res_id",
} as const;
export type ManagedIdentityUserAssignedIdQueryParameterNames =
    (typeof ManagedIdentityUserAssignedIdQueryParameterNames)[keyof typeof ManagedIdentityUserAssignedIdQueryParameterNames];

export abstract class BaseManagedIdentitySource {
    protected logger: Logger;
    private nodeStorage: NodeStorage;
    private networkClient: INetworkModule;
    private cryptoProvider: CryptoProvider;
    private disableInternalRetries: boolean;

    constructor(
        logger: Logger,
        nodeStorage: NodeStorage,
        networkClient: INetworkModule,
        cryptoProvider: CryptoProvider,
        disableInternalRetries: boolean
    ) {
        this.logger = logger;
        this.nodeStorage = nodeStorage;
        this.networkClient = networkClient;
        this.cryptoProvider = cryptoProvider;
        this.disableInternalRetries = disableInternalRetries;
    }

    abstract createRequest(
        request: string,
        managedIdentityId: ManagedIdentityId
    ): ManagedIdentityRequestParameters;

    public async getServerTokenResponseAsync(
        response: NetworkResponse<ManagedIdentityTokenResponse>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _networkClient: INetworkModule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _networkRequest: ManagedIdentityRequestParameters,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _networkRequestOptions: NetworkRequestOptions
    ): Promise<ServerAuthorizationTokenResponse> {
        return this.getServerTokenResponse(response);
    }

    public getServerTokenResponse(
        response: NetworkResponse<ManagedIdentityTokenResponse>
    ): ServerAuthorizationTokenResponse {
        let refreshIn, expiresIn: number | undefined;
        if (response.body.expires_on) {
            // if the expires_on field in the response body is a string and in ISO 8601 format, convert it to a Unix timestamp (seconds since epoch)
            if (isIso8601(response.body.expires_on)) {
                response.body.expires_on =
                    new Date(response.body.expires_on).getTime() / 1000;
            }

            expiresIn = response.body.expires_on - TimeUtils.nowSeconds();

            // compute refresh_in as 1/2 of expires_in, but only if expires_in > 2h
            if (expiresIn > 2 * 3600) {
                refreshIn = expiresIn / 2;
            }
        }

        const serverTokenResponse: ServerAuthorizationTokenResponse = {
            status: response.status,

            // success
            access_token: response.body.access_token,
            expires_in: expiresIn,
            scope: response.body.resource,
            token_type: response.body.token_type,
            refresh_in: refreshIn,

            // error
            correlation_id:
                response.body.correlation_id || response.body.correlationId,
            error:
                typeof response.body.error === "string"
                    ? response.body.error
                    : response.body.error?.code,
            error_description:
                response.body.message ||
                (typeof response.body.error === "string"
                    ? response.body.error_description
                    : response.body.error?.message),
            error_codes: response.body.error_codes,
            timestamp: response.body.timestamp,
            trace_id: response.body.trace_id,
        };

        return serverTokenResponse;
    }

    public async acquireTokenWithManagedIdentity(
        managedIdentityRequest: ManagedIdentityRequest,
        managedIdentityId: ManagedIdentityId,
        fakeAuthority: Authority,
        refreshAccessToken?: boolean
    ): Promise<AuthenticationResult> {
        const networkRequest: ManagedIdentityRequestParameters =
            this.createRequest(
                managedIdentityRequest.resource,
                managedIdentityId
            );

        if (managedIdentityRequest.revokedTokenSha256Hash) {
            this.logger.info(
                `[Managed Identity] The following claims are present in the request: ${managedIdentityRequest.claims}`
            );

            networkRequest.queryParameters[
                ManagedIdentityQueryParameters.SHA256_TOKEN_TO_REFRESH
            ] = managedIdentityRequest.revokedTokenSha256Hash;
        }

        if (managedIdentityRequest.clientCapabilities?.length) {
            const clientCapabilities: string =
                managedIdentityRequest.clientCapabilities.toString();

            this.logger.info(
                `[Managed Identity] The following client capabilities are present in the request: ${clientCapabilities}`
            );

            networkRequest.queryParameters[
                ManagedIdentityQueryParameters.XMS_CC
            ] = clientCapabilities;
        }

        const headers: Record<string, string> = networkRequest.headers;
        headers[HeaderNames.CONTENT_TYPE] = Constants.URL_FORM_CONTENT_TYPE;

        const networkRequestOptions: NetworkRequestOptions = { headers };

        if (Object.keys(networkRequest.bodyParameters).length) {
            networkRequestOptions.body =
                networkRequest.computeParametersBodyString();
        }

        /**
         * Initializes the network client helper based on the retry policy configuration.
         * If internal retries are disabled, it uses the provided network client directly.
         * Otherwise, it wraps the network client with an HTTP client that supports retries.
         */
        const networkClientHelper: INetworkModule = this.disableInternalRetries
            ? this.networkClient
            : new HttpClientWithRetries(
                  this.networkClient,
                  networkRequest.retryPolicy,
                  this.logger
              );

        const reqTimestamp = TimeUtils.nowSeconds();
        let response: NetworkResponse<ManagedIdentityTokenResponse>;
        try {
            // Sources that send POST requests: Cloud Shell
            if (networkRequest.httpMethod === HttpMethod.POST) {
                response =
                    await networkClientHelper.sendPostRequestAsync<ManagedIdentityTokenResponse>(
                        networkRequest.computeUri(),
                        networkRequestOptions
                    );
                // Sources that send GET requests: App Service, Azure Arc, IMDS, Service Fabric
            } else {
                response =
                    await networkClientHelper.sendGetRequestAsync<ManagedIdentityTokenResponse>(
                        networkRequest.computeUri(),
                        networkRequestOptions
                    );
            }
        } catch (error) {
            if (error instanceof AuthError) {
                throw error;
            } else {
                throw createClientAuthError(ClientAuthErrorCodes.networkError);
            }
        }

        const responseHandler = new ResponseHandler(
            managedIdentityId.id,
            this.nodeStorage,
            this.cryptoProvider,
            this.logger,
            null,
            null
        );

        const serverTokenResponse: ServerAuthorizationTokenResponse =
            await this.getServerTokenResponseAsync(
                response,
                networkClientHelper,
                networkRequest,
                networkRequestOptions
            );

        responseHandler.validateTokenResponse(
            serverTokenResponse,
            refreshAccessToken
        );

        // caches the token
        return responseHandler.handleServerTokenResponse(
            serverTokenResponse,
            fakeAuthority,
            reqTimestamp,
            managedIdentityRequest
        );
    }

    public getManagedIdentityUserAssignedIdQueryParameterKey(
        managedIdentityIdType: ManagedIdentityIdType,
        isImds?: boolean,
        usesApi2017?: boolean
    ): string {
        switch (managedIdentityIdType) {
            case ManagedIdentityIdType.USER_ASSIGNED_CLIENT_ID:
                this.logger.info(
                    `[Managed Identity] [API version ${
                        usesApi2017 ? "2017+" : "2019+"
                    }] Adding user assigned client id to the request.`
                );
                // The Machine Learning source uses the 2017-09-01 API version, which uses "clientid" instead of "client_id"
                return usesApi2017
                    ? ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_CLIENT_ID_2017
                    : ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_CLIENT_ID;

            case ManagedIdentityIdType.USER_ASSIGNED_RESOURCE_ID:
                this.logger.info(
                    "[Managed Identity] Adding user assigned resource id to the request."
                );
                return isImds
                    ? ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_RESOURCE_ID_IMDS
                    : ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_RESOURCE_ID_NON_IMDS;

            case ManagedIdentityIdType.USER_ASSIGNED_OBJECT_ID:
                this.logger.info(
                    "[Managed Identity] Adding user assigned object id to the request."
                );
                return ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_OBJECT_ID;
            default:
                throw createManagedIdentityError(
                    ManagedIdentityErrorCodes.invalidManagedIdentityIdType
                );
        }
    }

    public static getValidatedEnvVariableUrlString = (
        envVariableStringName: string,
        envVariable: string,
        sourceName: string,
        logger: Logger
    ): string => {
        try {
            return new UrlString(envVariable).urlString;
        } catch (error) {
            logger.info(
                `[Managed Identity] ${sourceName} managed identity is unavailable because the '${envVariableStringName}' environment variable is malformed.`
            );

            throw createManagedIdentityError(
                ManagedIdentityErrorCodes
                    .MsiEnvironmentVariableUrlMalformedErrorCodes[
                    envVariableStringName
                ]
            );
        }
    };
}
