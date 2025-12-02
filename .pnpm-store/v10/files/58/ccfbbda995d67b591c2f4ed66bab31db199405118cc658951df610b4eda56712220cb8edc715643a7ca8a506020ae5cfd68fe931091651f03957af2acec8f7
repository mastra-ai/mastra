/*! @azure/msal-node v3.8.0 2025-09-24 */
'use strict';
import { BaseManagedIdentitySource, ManagedIdentityUserAssignedIdQueryParameterNames } from './BaseManagedIdentitySource.mjs';
import { ManagedIdentityEnvironmentVariableNames, ManagedIdentitySourceNames, ManagedIdentityHeaders, ManagedIdentityQueryParameters, ManagedIdentityIdType, HttpMethod } from '../../utils/Constants.mjs';
import { ManagedIdentityRequestParameters } from '../../config/ManagedIdentityRequestParameters.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
const MACHINE_LEARNING_MSI_API_VERSION = "2017-09-01";
const MANAGED_IDENTITY_MACHINE_LEARNING_UNSUPPORTED_ID_TYPE_ERROR = `Only client id is supported for user-assigned managed identity in ${ManagedIdentitySourceNames.MACHINE_LEARNING}.`; // referenced in unit test
class MachineLearning extends BaseManagedIdentitySource {
    constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, msiEndpoint, secret) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.msiEndpoint = msiEndpoint;
        this.secret = secret;
    }
    static getEnvironmentVariables() {
        const msiEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT];
        const secret = process.env[ManagedIdentityEnvironmentVariableNames.MSI_SECRET];
        return [msiEndpoint, secret];
    }
    static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries) {
        const [msiEndpoint, secret] = MachineLearning.getEnvironmentVariables();
        // if either of the MSI endpoint or MSI secret variables are undefined, this MSI provider is unavailable.
        if (!msiEndpoint || !secret) {
            logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.MACHINE_LEARNING} managed identity is unavailable because one or both of the '${ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT}' and '${ManagedIdentityEnvironmentVariableNames.MSI_SECRET}' environment variables are not defined.`);
            return null;
        }
        const validatedMsiEndpoint = MachineLearning.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.MSI_ENDPOINT, msiEndpoint, ManagedIdentitySourceNames.MACHINE_LEARNING, logger);
        logger.info(`[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.MACHINE_LEARNING} managed identity. Endpoint URI: ${validatedMsiEndpoint}. Creating ${ManagedIdentitySourceNames.MACHINE_LEARNING} managed identity.`);
        return new MachineLearning(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, msiEndpoint, secret);
    }
    createRequest(resource, managedIdentityId) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.msiEndpoint);
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.headers[ManagedIdentityHeaders.ML_AND_SF_SECRET_HEADER_NAME] =
            this.secret;
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] =
            MACHINE_LEARNING_MSI_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] =
            resource;
        if (managedIdentityId.idType === ManagedIdentityIdType.SYSTEM_ASSIGNED) {
            request.queryParameters[ManagedIdentityUserAssignedIdQueryParameterNames.MANAGED_IDENTITY_CLIENT_ID_2017] = process.env[ManagedIdentityEnvironmentVariableNames
                .DEFAULT_IDENTITY_CLIENT_ID]; // this environment variable is always set in an Azure Machine Learning source
        }
        else if (managedIdentityId.idType ===
            ManagedIdentityIdType.USER_ASSIGNED_CLIENT_ID) {
            request.queryParameters[this.getManagedIdentityUserAssignedIdQueryParameterKey(managedIdentityId.idType, false, // isIMDS
            true // uses2017API
            )] = managedIdentityId.id;
        }
        else {
            throw new Error(MANAGED_IDENTITY_MACHINE_LEARNING_UNSUPPORTED_ID_TYPE_ERROR);
        }
        // bodyParameters calculated in BaseManagedIdentity.acquireTokenWithManagedIdentity
        return request;
    }
}

export { MANAGED_IDENTITY_MACHINE_LEARNING_UNSUPPORTED_ID_TYPE_ERROR, MachineLearning };
//# sourceMappingURL=MachineLearning.mjs.map
