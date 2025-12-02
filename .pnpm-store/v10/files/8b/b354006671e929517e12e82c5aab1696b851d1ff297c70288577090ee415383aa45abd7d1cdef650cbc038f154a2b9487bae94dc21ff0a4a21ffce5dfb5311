/*! @azure/msal-node v3.8.0 2025-09-24 */
'use strict';
import { ManagedIdentityRequestParameters } from '../../config/ManagedIdentityRequestParameters.mjs';
import { BaseManagedIdentitySource } from './BaseManagedIdentitySource.mjs';
import { ManagedIdentityEnvironmentVariableNames, ManagedIdentitySourceNames, ManagedIdentityHeaders, ManagedIdentityQueryParameters, ManagedIdentityIdType, HttpMethod } from '../../utils/Constants.mjs';
import { ImdsRetryPolicy } from '../../retry/ImdsRetryPolicy.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
// Documentation for IMDS is available at https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/how-to-use-vm-token#get-a-token-using-http
const IMDS_TOKEN_PATH = "/metadata/identity/oauth2/token";
const DEFAULT_IMDS_ENDPOINT = `http://169.254.169.254${IMDS_TOKEN_PATH}`;
const IMDS_API_VERSION = "2018-02-01";
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/ImdsManagedIdentitySource.cs
 */
class Imds extends BaseManagedIdentitySource {
    /**
     * Constructs an Imds instance.
     * @param logger - Logger instance for logging.
     * @param nodeStorage - NodeStorage instance for caching.
     * @param networkClient - Network client for HTTP requests.
     * @param cryptoProvider - CryptoProvider for cryptographic operations.
     * @param disableInternalRetries - Whether to disable internal retry logic.
     * @param identityEndpoint - The IMDS endpoint to use.
     */
    constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.identityEndpoint = identityEndpoint;
    }
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
    static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        let validatedIdentityEndpoint;
        if (process.env[ManagedIdentityEnvironmentVariableNames
            .AZURE_POD_IDENTITY_AUTHORITY_HOST]) {
            logger.info(`[Managed Identity] Environment variable ${ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST} for ${ManagedIdentitySourceNames.IMDS} returned endpoint: ${process.env[ManagedIdentityEnvironmentVariableNames
                .AZURE_POD_IDENTITY_AUTHORITY_HOST]}`);
            validatedIdentityEndpoint = Imds.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST, `${process.env[ManagedIdentityEnvironmentVariableNames
                .AZURE_POD_IDENTITY_AUTHORITY_HOST]}${IMDS_TOKEN_PATH}`, ManagedIdentitySourceNames.IMDS, logger);
        }
        else {
            logger.info(`[Managed Identity] Unable to find ${ManagedIdentityEnvironmentVariableNames.AZURE_POD_IDENTITY_AUTHORITY_HOST} environment variable for ${ManagedIdentitySourceNames.IMDS}, using the default endpoint.`);
            validatedIdentityEndpoint = DEFAULT_IMDS_ENDPOINT;
        }
        return new Imds(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, validatedIdentityEndpoint);
    }
    /**
     * Creates a ManagedIdentityRequestParameters object for acquiring a token from IMDS.
     * Sets the required headers and query parameters for the IMDS token request.
     *
     * @param resource - The resource URI for which the token is requested.
     * @param managedIdentityId - The managed identity ID (system-assigned or user-assigned).
     * @returns A ManagedIdentityRequestParameters object configured for IMDS.
     */
    createRequest(resource, managedIdentityId) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.identityEndpoint);
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] =
            IMDS_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] =
            resource;
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
            request.queryParameters[this.getManagedIdentityUserAssignedIdQueryParameterKey(managedIdentityId.idType, true // indicates source is IMDS
            )] = managedIdentityId.id;
        }
        // The bodyParameters are calculated in BaseManagedIdentity.acquireTokenWithManagedIdentity.
        request.retryPolicy = new ImdsRetryPolicy();
        return request;
    }
}

export { Imds };
//# sourceMappingURL=Imds.mjs.map
