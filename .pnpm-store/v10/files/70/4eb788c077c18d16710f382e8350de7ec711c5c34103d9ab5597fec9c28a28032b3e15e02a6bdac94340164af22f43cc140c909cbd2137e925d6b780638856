/*! @azure/msal-node v3.8.0 2025-09-24 */
'use strict';
import { HttpStatus, EncodingTypes, AuthError, createClientAuthError, ClientAuthErrorCodes } from '@azure/msal-common/node';
import { ManagedIdentityRequestParameters } from '../../config/ManagedIdentityRequestParameters.mjs';
import { BaseManagedIdentitySource } from './BaseManagedIdentitySource.mjs';
import { createManagedIdentityError } from '../../error/ManagedIdentityError.mjs';
import { ManagedIdentityEnvironmentVariableNames, ManagedIdentitySourceNames, ManagedIdentityIdType, HttpMethod, ManagedIdentityHeaders, ManagedIdentityQueryParameters, AZURE_ARC_SECRET_FILE_MAX_SIZE_BYTES } from '../../utils/Constants.mjs';
import { accessSync, constants, statSync, readFileSync } from 'fs';
import path from 'path';
import { unableToCreateAzureArc, wwwAuthenticateHeaderMissing, wwwAuthenticateHeaderUnsupportedFormat, platformNotSupported, invalidFileExtension, invalidFilePath, unableToReadSecretFile, invalidSecret } from '../../error/ManagedIdentityErrorCodes.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
const ARC_API_VERSION = "2019-11-01";
const DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT = "http://127.0.0.1:40342/metadata/identity/oauth2/token";
const HIMDS_EXECUTABLE_HELPER_STRING = "N/A: himds executable exists";
const SUPPORTED_AZURE_ARC_PLATFORMS = {
    win32: `${process.env["ProgramData"]}\\AzureConnectedMachineAgent\\Tokens\\`,
    linux: "/var/opt/azcmagent/tokens/",
};
const AZURE_ARC_FILE_DETECTION = {
    win32: `${process.env["ProgramFiles"]}\\AzureConnectedMachineAgent\\himds.exe`,
    linux: "/opt/azcmagent/bin/himds",
};
/**
 * Original source of code: https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/identity/Azure.Identity/src/AzureArcManagedIdentitySource.cs
 */
class AzureArc extends BaseManagedIdentitySource {
    constructor(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint) {
        super(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries);
        this.identityEndpoint = identityEndpoint;
    }
    static getEnvironmentVariables() {
        let identityEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT];
        let imdsEndpoint = process.env[ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT];
        // if either of the identity or imds endpoints are undefined, check if the himds executable exists
        if (!identityEndpoint || !imdsEndpoint) {
            // get the expected Windows or Linux file path of the himds executable
            const fileDetectionPath = AZURE_ARC_FILE_DETECTION[process.platform];
            try {
                /*
                 * check if the himds executable exists and its permissions allow it to be read
                 * returns undefined if true, throws an error otherwise
                 */
                accessSync(fileDetectionPath, constants.F_OK | constants.R_OK);
                identityEndpoint = DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT;
                imdsEndpoint = HIMDS_EXECUTABLE_HELPER_STRING;
            }
            catch (err) {
                /*
                 * do nothing
                 * accessSync returns undefined on success, and throws an error on failure
                 */
            }
        }
        return [identityEndpoint, imdsEndpoint];
    }
    static tryCreate(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, managedIdentityId) {
        const [identityEndpoint, imdsEndpoint] = AzureArc.getEnvironmentVariables();
        // if either of the identity or imds endpoints are undefined (even after himds file detection)
        if (!identityEndpoint || !imdsEndpoint) {
            logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.AZURE_ARC} managed identity is unavailable through environment variables because one or both of '${ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT}' and '${ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT}' are not defined. ${ManagedIdentitySourceNames.AZURE_ARC} managed identity is also unavailable through file detection.`);
            return null;
        }
        // check if the imds endpoint is set to the default for file detection
        if (imdsEndpoint === HIMDS_EXECUTABLE_HELPER_STRING) {
            logger.info(`[Managed Identity] ${ManagedIdentitySourceNames.AZURE_ARC} managed identity is available through file detection. Defaulting to known ${ManagedIdentitySourceNames.AZURE_ARC} endpoint: ${DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT}. Creating ${ManagedIdentitySourceNames.AZURE_ARC} managed identity.`);
        }
        else {
            // otherwise, both the identity and imds endpoints are defined without file detection; validate them
            const validatedIdentityEndpoint = AzureArc.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.IDENTITY_ENDPOINT, identityEndpoint, ManagedIdentitySourceNames.AZURE_ARC, logger);
            // remove trailing slash
            validatedIdentityEndpoint.endsWith("/")
                ? validatedIdentityEndpoint.slice(0, -1)
                : validatedIdentityEndpoint;
            AzureArc.getValidatedEnvVariableUrlString(ManagedIdentityEnvironmentVariableNames.IMDS_ENDPOINT, imdsEndpoint, ManagedIdentitySourceNames.AZURE_ARC, logger);
            logger.info(`[Managed Identity] Environment variables validation passed for ${ManagedIdentitySourceNames.AZURE_ARC} managed identity. Endpoint URI: ${validatedIdentityEndpoint}. Creating ${ManagedIdentitySourceNames.AZURE_ARC} managed identity.`);
        }
        if (managedIdentityId.idType !== ManagedIdentityIdType.SYSTEM_ASSIGNED) {
            throw createManagedIdentityError(unableToCreateAzureArc);
        }
        return new AzureArc(logger, nodeStorage, networkClient, cryptoProvider, disableInternalRetries, identityEndpoint);
    }
    createRequest(resource) {
        const request = new ManagedIdentityRequestParameters(HttpMethod.GET, this.identityEndpoint.replace("localhost", "127.0.0.1"));
        request.headers[ManagedIdentityHeaders.METADATA_HEADER_NAME] = "true";
        request.queryParameters[ManagedIdentityQueryParameters.API_VERSION] =
            ARC_API_VERSION;
        request.queryParameters[ManagedIdentityQueryParameters.RESOURCE] =
            resource;
        // bodyParameters calculated in BaseManagedIdentity.acquireTokenWithManagedIdentity
        return request;
    }
    async getServerTokenResponseAsync(originalResponse, networkClient, networkRequest, networkRequestOptions) {
        let retryResponse;
        if (originalResponse.status === HttpStatus.UNAUTHORIZED) {
            const wwwAuthHeader = originalResponse.headers["www-authenticate"];
            if (!wwwAuthHeader) {
                throw createManagedIdentityError(wwwAuthenticateHeaderMissing);
            }
            if (!wwwAuthHeader.includes("Basic realm=")) {
                throw createManagedIdentityError(wwwAuthenticateHeaderUnsupportedFormat);
            }
            const secretFilePath = wwwAuthHeader.split("Basic realm=")[1];
            // throw an error if the managed identity application is not being run on Windows or Linux
            if (!SUPPORTED_AZURE_ARC_PLATFORMS.hasOwnProperty(process.platform)) {
                throw createManagedIdentityError(platformNotSupported);
            }
            // get the expected Windows or Linux file path
            const expectedSecretFilePath = SUPPORTED_AZURE_ARC_PLATFORMS[process.platform];
            // throw an error if the file in the file path is not a .key file
            const fileName = path.basename(secretFilePath);
            if (!fileName.endsWith(".key")) {
                throw createManagedIdentityError(invalidFileExtension);
            }
            /*
             * throw an error if the file path from the www-authenticate header does not match the
             * expected file path for the platform (Windows or Linux) the managed identity application
             * is running on
             */
            if (expectedSecretFilePath + fileName !== secretFilePath) {
                throw createManagedIdentityError(invalidFilePath);
            }
            let secretFileSize;
            // attempt to get the secret file's size, in bytes
            try {
                secretFileSize = await statSync(secretFilePath).size;
            }
            catch (e) {
                throw createManagedIdentityError(unableToReadSecretFile);
            }
            // throw an error if the secret file's size is greater than 4096 bytes
            if (secretFileSize > AZURE_ARC_SECRET_FILE_MAX_SIZE_BYTES) {
                throw createManagedIdentityError(invalidSecret);
            }
            // attempt to read the contents of the secret file
            let secret;
            try {
                secret = readFileSync(secretFilePath, EncodingTypes.UTF8);
            }
            catch (e) {
                throw createManagedIdentityError(unableToReadSecretFile);
            }
            const authHeaderValue = `Basic ${secret}`;
            this.logger.info(`[Managed Identity] Adding authorization header to the request.`);
            networkRequest.headers[ManagedIdentityHeaders.AUTHORIZATION_HEADER_NAME] = authHeaderValue;
            try {
                retryResponse =
                    await networkClient.sendGetRequestAsync(networkRequest.computeUri(), networkRequestOptions);
            }
            catch (error) {
                if (error instanceof AuthError) {
                    throw error;
                }
                else {
                    throw createClientAuthError(ClientAuthErrorCodes.networkError);
                }
            }
        }
        return this.getServerTokenResponse(retryResponse || originalResponse);
    }
}

export { ARC_API_VERSION, AZURE_ARC_FILE_DETECTION, AzureArc, DEFAULT_AZURE_ARC_IDENTITY_ENDPOINT, SUPPORTED_AZURE_ARC_PLATFORMS };
//# sourceMappingURL=AzureArc.mjs.map
