/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { INetworkModule, Logger } from "@azure/msal-common/node";
import { ManagedIdentityId } from "../../config/ManagedIdentityId.js";
import { ManagedIdentityRequestParameters } from "../../config/ManagedIdentityRequestParameters.js";
import { BaseManagedIdentitySource } from "./BaseManagedIdentitySource.js";
import { NodeStorage } from "../../cache/NodeStorage.js";
import { CryptoProvider } from "../../crypto/CryptoProvider.js";
import {
    HttpMethod,
    ManagedIdentityEnvironmentVariableNames,
    ManagedIdentityIdType,
    ManagedIdentitySourceNames,
    ManagedIdentityQueryParameters,
    ManagedIdentityHeaders,
} from "../../utils/Constants.js";

const SERVICE_FABRIC_MSI_API_VERSION: string = "2019-07-01-preview";

/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/ServiceFabricManagedIdentitySource.cs
 */
export class ServiceFabric extends BaseManagedIdentitySource {
    private identityEndpoint: string;
    private identityHeader: string;

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

    /**
     * Retrieves the environment variables required for Service Fabric managed identity.
     * @returns An array containing the identity endpoint, identity header, and identity server thumbprint.
     */
    public static getEnvironmentVariables(): Array<string | undefined> {
        const identityEndpoint: string | undefined =
            process.env[
                ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT
            ];
        const identityHeader: string | undefined =
            process.env[
                ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER
            ];
        const identityServerThumbprint: string | undefined =
            process.env[
                ManagedIdentityEnvironmentVariableNames
                    .IDENTITY_SERVER_THUMBPRINT
            ];

        return [identityEndpoint, identityHeader, identityServerThumbprint];
    }

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
    public static tryCreate(
        logger: Logger,
        nodeStorage: NodeStorage,
        networkClient: INetworkModule,
        cryptoProvider: CryptoProvider,
        disableInternalRetries: boolean,
        managedIdentityId: ManagedIdentityId
    ): ServiceFabric | null {
        const [identityEndpoint, identityHeader, identityServerThumbprint] =
            ServiceFabric.getEnvironmentVariables();

        if (!identityEndpoint || !identityHeader || !identityServerThumbprint) {
            logger.info(
                `[Managed Identity] ${ManagedIdentitySourceNames.SERVICE_FABRIC} managed identity is unavailable because one or all of the '${ManagedIdentityEnvironmentVariableNames.IDENTITY_HEADER}', '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' or '${ManagedIdentityEnvironmentVariableNames.IDENTITY_SERVER_THUMBPRINT}' environment variables are not defined.`
            );
            return null;
        }

        const validatedIdentityEndpoint: string =
            ServiceFabric.getValidatedEnvVariableUrlString(
                ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT,
                identityEndpoint,
                ManagedIdentitySourceNames.SERVICE_FABRIC,
                logger
            );

        logger.info(
            `[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.SERVICE_FABRIC} managed identity. Endpoint URI: ${validatedIdentityEndpoint}. Creating ${ManagedIdentitySourceNames.SERVICE_FABRIC} managed identity.`
        );

        if (
            managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED
        ) {
            logger.warning(
                `[Managed Identity] ${ManagedIdentitySourceNames.SERVICE_FABRIC} user assigned managed identity is configured in the cluster, not during runtime. See also: https://learn.microsoft.com/en-us/azure/service-fabric/configure-existing-cluster-enable-managed-identity-token-service.`
            );
        }

        return new ServiceFabric(
            logger,
            nodeStorage,
            networkClient,
            cryptoProvider,
            disableInternalRetries,
            identityEndpoint,
            identityHeader
        );
    }

    /**
     * Creates the request parameters for acquiring a token from the Service Fabric cluster.
     * @param resource - The resource URI for which the token is requested.
     * @param managedIdentityId - The managed identity ID (system-assigned or user-assigned).
     * @returns A ManagedIdentityRequestParameters object configured for Service Fabric.
     */
    public createRequest(
        resource: string,
        managedIdentityId: ManagedIdentityId
    ): ManagedIdentityRequestParameters {
        const request: ManagedIdentityRequestParameters =
            new ManagedIdentityRequestParameters(
                HttpMethod.GET,
                this.identityEndpoint
            );

        request.headers[ManagedIdentityHeaders.ML_AND_SF_SECRET_HEADER_NAME] =
            this.identityHeader;

        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] =
            SERVICE_FABRIC_MSI_API_VERSION;
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
