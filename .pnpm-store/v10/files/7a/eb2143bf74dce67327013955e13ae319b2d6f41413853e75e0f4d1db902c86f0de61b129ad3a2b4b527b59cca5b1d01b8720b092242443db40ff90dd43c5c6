/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { INetworkModule, Logger } from "@azure/msal-common/node";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import {
    HttpMethod,
    ManagedIdentityEnvironmentVariableNames,
    ManagedIdentitySourceNames,
    ManagedIdentityIdType,
    ManagedIdentityQueryParameters,
    ManagedIdentityHeaders,
} from "../../utils/Constants.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { NodeStorage } from "../../cache/NodeStorage.js";

// MSI Constants. Docs for MSI are available here https://docs.microsoft.com/azure/app-service/overview-managed-identity
const APP_SERVICE_MSI_API_VERSION: string = "2019-08-01";

/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/AppServiceManagedIdentitySource.cs
 */
export class AppService extends BaseManagedIdentitySource {
    private identityEndpoint: string;
    private identityHeader: string;

    constructor(
        logger: Logger,
        nodeStorage: NodeStorage,
        networkClient: INetworkModule,
        cryptoProvider: CryptoProvider,
        disableInternalRetries: boolean,
        identityEndpoint: string,
        identityHeader: string
    ) {
        super(
            logger,
            nodeStorage,
            networkClient,
            cryptoProvider,
            disableInternalRetries
        );

        this.identityEndpoint = identityEndpoint;
        this.identityHeader = identityHeader;
    }

    public static getEnvironmentVariables(): Array<string | undefined> {
        const identityEndpoint: string | undefined =
            process.env[
                ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT
            ];
        const identityHeader: string | undefined =
            process.env[
                ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER
            ];

        return [identityEndpoint, identityHeader];
    }

    public static tryCreate(
        logger: Logger,
        nodeStorage: NodeStorage,
        networkClient: INetworkModule,
        cryptoProvider: CryptoProvider,
        disableInternalRetries: boolean
    ): AppService | null {
        const [identityEndpoint, identityHeader] =
            AppService.getEnvironmentVariables();

        // if either of the identity endpoint or identity header variables are undefined, this MSI provider is unavailable.
        if (!identityEndpoint || !identityHeader) {
            logger.info(
                `[Managed Identity] ${ManagedIdentitySourceNames.APP_SERVICE} managed identity is unavailable because one or both of the '${ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER}' and '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' environment variables are not defined.`
            );
            return null;
        }

        const validatedIdentityEndpoint: string =
            AppService.getValidatedEnvVariableUrlString(
                ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT,
                identityEndpoint,
                ManagedIdentitySourceNames.APP_SERVICE,
                logger
            );

        logger.info(
            `[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.APP_SERVICE} managed identity. Endpoint URI: ${validatedIdentityEndpoint}. Creating ${ManagedIdentitySourceNames.APP_SERVICE} managed identity.`
        );

        return new AppService(
            logger,
            nodeStorage,
            networkClient,
            cryptoProvider,
            disableInternalRetries,
            identityEndpoint,
            identityHeader
        );
    }

    public createRequest(
        resource: string,
        managedIdentityId: ManagedIdentityId
    ): ManagedIdentityRequestParameters {
        const request: ManagedIdentityRequestParameters =
            new ManagedIdentityRequestParameters(
                HttpMethod.GET,
                this.identityEndpoint
            );

        request.headers[ManagedIdentityHeaders.APP_SERVICE_SECRET_HEADER_NAME] =
            this.identityHeader;

        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] =
            APP_SERVICE_MSI_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] =
            resource;

        if (
            managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED
        ) {
            request.queryParameters[
                this.getManagedIdentityUserAssignedIdQueryParameterKey(
                    managedIdentityId.idType
                )
            ] = managedIdentityId.id;
        }

        // bodyParameters calculated in BaseManagedIdentity.acquireTokenWithManagedIdentity

        return request;
    }
}
