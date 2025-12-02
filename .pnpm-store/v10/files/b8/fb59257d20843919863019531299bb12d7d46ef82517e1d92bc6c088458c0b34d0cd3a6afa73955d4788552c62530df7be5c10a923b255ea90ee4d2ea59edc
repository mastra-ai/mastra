/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2018 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailPrivacyAuthConfig = exports.PasswordPolicyAuthConfig = exports.MobileLinksAuthConfig = exports.RecaptchaAuthConfig = exports.SmsRegionsAuthConfig = exports.OIDCConfig = exports.SAMLConfig = exports.EmailSignInConfig = exports.MultiFactorAuthConfig = exports.MAXIMUM_TEST_PHONE_NUMBERS = void 0;
exports.validateTestPhoneNumbers = validateTestPhoneNumbers;
const validator = require("../utils/validator");
const deep_copy_1 = require("../utils/deep-copy");
const error_1 = require("../utils/error");
/** A maximum of 10 test phone number / code pairs can be configured. */
exports.MAXIMUM_TEST_PHONE_NUMBERS = 10;
/** Client Auth factor type to server auth factor type mapping. */
const AUTH_FACTOR_CLIENT_TO_SERVER_TYPE = {
    phone: 'PHONE_SMS',
};
/** Server Auth factor type to client auth factor type mapping. */
const AUTH_FACTOR_SERVER_TO_CLIENT_TYPE = Object.keys(AUTH_FACTOR_CLIENT_TO_SERVER_TYPE)
    .reduce((res, key) => {
    res[AUTH_FACTOR_CLIENT_TO_SERVER_TYPE[key]] = key;
    return res;
}, {});
/**
 * Defines the multi-factor config class used to convert client side MultiFactorConfig
 * to a format that is understood by the Auth server.
 *
 * @internal
 */
class MultiFactorAuthConfig {
    /**
     * Static method to convert a client side request to a MultiFactorAuthServerConfig.
     * Throws an error if validation fails.
     *
     * @param options - The options object to convert to a server request.
     * @returns The resulting server request.
     * @internal
     */
    static buildServerRequest(options) {
        const request = {};
        MultiFactorAuthConfig.validate(options);
        if (Object.prototype.hasOwnProperty.call(options, 'state')) {
            request.state = options.state;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'factorIds')) {
            (options.factorIds || []).forEach((factorId) => {
                if (typeof request.enabledProviders === 'undefined') {
                    request.enabledProviders = [];
                }
                request.enabledProviders.push(AUTH_FACTOR_CLIENT_TO_SERVER_TYPE[factorId]);
            });
            // In case an empty array is passed. Ensure it gets populated so the array is cleared.
            if (options.factorIds && options.factorIds.length === 0) {
                request.enabledProviders = [];
            }
        }
        if (Object.prototype.hasOwnProperty.call(options, 'providerConfigs')) {
            request.providerConfigs = options.providerConfigs;
        }
        return request;
    }
    /**
     * Validates the MultiFactorConfig options object. Throws an error on failure.
     *
     * @param options - The options object to validate.
     */
    static validate(options) {
        const validKeys = {
            state: true,
            factorIds: true,
            providerConfigs: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MultiFactorConfig" must be a non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid MultiFactorConfig parameter.`);
            }
        }
        // Validate content.
        if (typeof options.state !== 'undefined' &&
            options.state !== 'ENABLED' &&
            options.state !== 'DISABLED') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MultiFactorConfig.state" must be either "ENABLED" or "DISABLED".');
        }
        if (typeof options.factorIds !== 'undefined') {
            if (!validator.isArray(options.factorIds)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MultiFactorConfig.factorIds" must be an array of valid "AuthFactorTypes".');
            }
            // Validate content of array.
            options.factorIds.forEach((factorId) => {
                if (typeof AUTH_FACTOR_CLIENT_TO_SERVER_TYPE[factorId] === 'undefined') {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${factorId}" is not a valid "AuthFactorType".`);
                }
            });
        }
        if (typeof options.providerConfigs !== 'undefined') {
            if (!validator.isArray(options.providerConfigs)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MultiFactorConfig.providerConfigs" must be an array of valid "MultiFactorProviderConfig."');
            }
            //Validate content of array.
            options.providerConfigs.forEach((multiFactorProviderConfig) => {
                if (typeof multiFactorProviderConfig === 'undefined' || !validator.isObject(multiFactorProviderConfig)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${multiFactorProviderConfig}" is not a valid "MultiFactorProviderConfig" type.`);
                }
                const validProviderConfigKeys = {
                    state: true,
                    totpProviderConfig: true,
                };
                for (const key in multiFactorProviderConfig) {
                    if (!(key in validProviderConfigKeys)) {
                        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid ProviderConfig parameter.`);
                    }
                }
                if (typeof multiFactorProviderConfig.state === 'undefined' ||
                    (multiFactorProviderConfig.state !== 'ENABLED' &&
                        multiFactorProviderConfig.state !== 'DISABLED')) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MultiFactorConfig.providerConfigs.state" must be either "ENABLED" or "DISABLED".');
                }
                // Since TOTP is the only provider config available right now, not defining it will lead into an error
                if (typeof multiFactorProviderConfig.totpProviderConfig === 'undefined') {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MultiFactorConfig.providerConfigs.totpProviderConfig" must be defined.');
                }
                const validTotpProviderConfigKeys = {
                    adjacentIntervals: true,
                };
                for (const key in multiFactorProviderConfig.totpProviderConfig) {
                    if (!(key in validTotpProviderConfigKeys)) {
                        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid TotpProviderConfig parameter.`);
                    }
                }
                const adjIntervals = multiFactorProviderConfig.totpProviderConfig.adjacentIntervals;
                if (typeof adjIntervals !== 'undefined' &&
                    (!Number.isInteger(adjIntervals) || adjIntervals < 0 || adjIntervals > 10)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"MultiFactorConfig.providerConfigs.totpProviderConfig.adjacentIntervals" must' +
                        ' be a valid number between 0 and 10 (both inclusive).');
                }
            });
        }
    }
    /**
     * The MultiFactorAuthConfig constructor.
     *
     * @param response - The server side response used to initialize the
     *     MultiFactorAuthConfig object.
     * @constructor
     * @internal
     */
    constructor(response) {
        if (typeof response.state === 'undefined') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid multi-factor configuration response');
        }
        this.state = response.state;
        this.factorIds = [];
        (response.enabledProviders || []).forEach((enabledProvider) => {
            // Ignore unsupported types. It is possible the current admin SDK version is
            // not up to date and newer backend types are supported.
            if (typeof AUTH_FACTOR_SERVER_TO_CLIENT_TYPE[enabledProvider] !== 'undefined') {
                this.factorIds.push(AUTH_FACTOR_SERVER_TO_CLIENT_TYPE[enabledProvider]);
            }
        });
        this.providerConfigs = [];
        (response.providerConfigs || []).forEach((providerConfig) => {
            if (typeof providerConfig !== 'undefined') {
                if (typeof providerConfig.state === 'undefined' ||
                    typeof providerConfig.totpProviderConfig === 'undefined' ||
                    (typeof providerConfig.totpProviderConfig.adjacentIntervals !== 'undefined' &&
                        typeof providerConfig.totpProviderConfig.adjacentIntervals !== 'number')) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid multi-factor configuration response');
                }
                this.providerConfigs.push(providerConfig);
            }
        });
    }
    /** Converts MultiFactorConfig to JSON object
     * @returns The plain object representation of the multi-factor config instance. */
    toJSON() {
        return {
            state: this.state,
            factorIds: this.factorIds,
            providerConfigs: this.providerConfigs,
        };
    }
}
exports.MultiFactorAuthConfig = MultiFactorAuthConfig;
/**
 * Validates the provided map of test phone number / code pairs.
 * @param testPhoneNumbers - The phone number / code pairs to validate.
 */
function validateTestPhoneNumbers(testPhoneNumbers) {
    if (!validator.isObject(testPhoneNumbers)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"testPhoneNumbers" must be a map of phone number / code pairs.');
    }
    if (Object.keys(testPhoneNumbers).length > exports.MAXIMUM_TEST_PHONE_NUMBERS) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MAXIMUM_TEST_PHONE_NUMBER_EXCEEDED);
    }
    for (const phoneNumber in testPhoneNumbers) {
        // Validate phone number.
        if (!validator.isPhoneNumber(phoneNumber)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TESTING_PHONE_NUMBER, `"${phoneNumber}" is not a valid E.164 standard compliant phone number.`);
        }
        // Validate code.
        if (!validator.isString(testPhoneNumbers[phoneNumber]) ||
            !/^[\d]{6}$/.test(testPhoneNumbers[phoneNumber])) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TESTING_PHONE_NUMBER, `"${testPhoneNumbers[phoneNumber]}" is not a valid 6 digit code string.`);
        }
    }
}
/**
 * Defines the email sign-in config class used to convert client side EmailSignInConfig
 * to a format that is understood by the Auth server.
 *
 * @internal
 */
class EmailSignInConfig {
    /**
     * Static method to convert a client side request to a EmailSignInConfigServerRequest.
     * Throws an error if validation fails.
     *
     * @param options - The options object to convert to a server request.
     * @returns The resulting server request.
     * @internal
     */
    static buildServerRequest(options) {
        const request = {};
        EmailSignInConfig.validate(options);
        if (Object.prototype.hasOwnProperty.call(options, 'enabled')) {
            request.allowPasswordSignup = options.enabled;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'passwordRequired')) {
            request.enableEmailLinkSignin = !options.passwordRequired;
        }
        return request;
    }
    /**
     * Validates the EmailSignInConfig options object. Throws an error on failure.
     *
     * @param options - The options object to validate.
     */
    static validate(options) {
        // TODO: Validate the request.
        const validKeys = {
            enabled: true,
            passwordRequired: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"EmailSignInConfig" must be a non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${key}" is not a valid EmailSignInConfig parameter.`);
            }
        }
        // Validate content.
        if (typeof options.enabled !== 'undefined' &&
            !validator.isBoolean(options.enabled)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"EmailSignInConfig.enabled" must be a boolean.');
        }
        if (typeof options.passwordRequired !== 'undefined' &&
            !validator.isBoolean(options.passwordRequired)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"EmailSignInConfig.passwordRequired" must be a boolean.');
        }
    }
    /**
     * The EmailSignInConfig constructor.
     *
     * @param response - The server side response used to initialize the
     *     EmailSignInConfig object.
     * @constructor
     */
    constructor(response) {
        if (typeof response.allowPasswordSignup === 'undefined') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid email sign-in configuration response');
        }
        this.enabled = response.allowPasswordSignup;
        this.passwordRequired = !response.enableEmailLinkSignin;
    }
    /** @returns The plain object representation of the email sign-in config. */
    toJSON() {
        return {
            enabled: this.enabled,
            passwordRequired: this.passwordRequired,
        };
    }
}
exports.EmailSignInConfig = EmailSignInConfig;
/**
 * Defines the SAMLConfig class used to convert a client side configuration to its
 * server side representation.
 *
 * @internal
 */
class SAMLConfig {
    /**
     * Converts a client side request to a SAMLConfigServerRequest which is the format
     * accepted by the backend server.
     * Throws an error if validation fails. If the request is not a SAMLConfig request,
     * returns null.
     *
     * @param options - The options object to convert to a server request.
     * @param ignoreMissingFields - Whether to ignore missing fields.
     * @returns The resulting server request or null if not valid.
     */
    static buildServerRequest(options, ignoreMissingFields = false) {
        const makeRequest = validator.isNonNullObject(options) &&
            (options.providerId || ignoreMissingFields);
        if (!makeRequest) {
            return null;
        }
        const request = {};
        // Validate options.
        SAMLConfig.validate(options, ignoreMissingFields);
        request.enabled = options.enabled;
        request.displayName = options.displayName;
        // IdP config.
        if (options.idpEntityId || options.ssoURL || options.x509Certificates) {
            request.idpConfig = {
                idpEntityId: options.idpEntityId,
                ssoUrl: options.ssoURL,
                signRequest: options.enableRequestSigning,
                idpCertificates: typeof options.x509Certificates === 'undefined' ? undefined : [],
            };
            if (options.x509Certificates) {
                for (const cert of (options.x509Certificates || [])) {
                    request.idpConfig.idpCertificates.push({ x509Certificate: cert });
                }
            }
        }
        // RP config.
        if (options.callbackURL || options.rpEntityId) {
            request.spConfig = {
                spEntityId: options.rpEntityId,
                callbackUri: options.callbackURL,
            };
        }
        return request;
    }
    /**
     * Returns the provider ID corresponding to the resource name if available.
     *
     * @param resourceName - The server side resource name.
     * @returns The provider ID corresponding to the resource, null otherwise.
     */
    static getProviderIdFromResourceName(resourceName) {
        // name is of form projects/project1/inboundSamlConfigs/providerId1
        const matchProviderRes = resourceName.match(/\/inboundSamlConfigs\/(saml\..*)$/);
        if (!matchProviderRes || matchProviderRes.length < 2) {
            return null;
        }
        return matchProviderRes[1];
    }
    /**
     * @param providerId - The provider ID to check.
     * @returns Whether the provider ID corresponds to a SAML provider.
     */
    static isProviderId(providerId) {
        return validator.isNonEmptyString(providerId) && providerId.indexOf('saml.') === 0;
    }
    /**
     * Validates the SAMLConfig options object. Throws an error on failure.
     *
     * @param options - The options object to validate.
     * @param ignoreMissingFields - Whether to ignore missing fields.
     */
    static validate(options, ignoreMissingFields = false) {
        const validKeys = {
            enabled: true,
            displayName: true,
            providerId: true,
            idpEntityId: true,
            ssoURL: true,
            x509Certificates: true,
            rpEntityId: true,
            callbackURL: true,
            enableRequestSigning: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig" must be a valid non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid SAML config parameter.`);
            }
        }
        // Required fields.
        if (validator.isNonEmptyString(options.providerId)) {
            if (options.providerId.indexOf('saml.') !== 0) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID, '"SAMLAuthProviderConfig.providerId" must be a valid non-empty string prefixed with "saml.".');
            }
        }
        else if (!ignoreMissingFields) {
            // providerId is required and not provided correctly.
            throw new error_1.FirebaseAuthError(!options.providerId ? error_1.AuthClientErrorCode.MISSING_PROVIDER_ID : error_1.AuthClientErrorCode.INVALID_PROVIDER_ID, '"SAMLAuthProviderConfig.providerId" must be a valid non-empty string prefixed with "saml.".');
        }
        if (!(ignoreMissingFields && typeof options.idpEntityId === 'undefined') &&
            !validator.isNonEmptyString(options.idpEntityId)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.idpEntityId" must be a valid non-empty string.');
        }
        if (!(ignoreMissingFields && typeof options.ssoURL === 'undefined') &&
            !validator.isURL(options.ssoURL)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.ssoURL" must be a valid URL string.');
        }
        if (!(ignoreMissingFields && typeof options.rpEntityId === 'undefined') &&
            !validator.isNonEmptyString(options.rpEntityId)) {
            throw new error_1.FirebaseAuthError(!options.rpEntityId ? error_1.AuthClientErrorCode.MISSING_SAML_RELYING_PARTY_CONFIG :
                error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.rpEntityId" must be a valid non-empty string.');
        }
        if (!(ignoreMissingFields && typeof options.callbackURL === 'undefined') &&
            !validator.isURL(options.callbackURL)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.callbackURL" must be a valid URL string.');
        }
        if (!(ignoreMissingFields && typeof options.x509Certificates === 'undefined') &&
            !validator.isArray(options.x509Certificates)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.x509Certificates" must be a valid array of X509 certificate strings.');
        }
        (options.x509Certificates || []).forEach((cert) => {
            if (!validator.isNonEmptyString(cert)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.x509Certificates" must be a valid array of X509 certificate strings.');
            }
        });
        if (typeof options.enableRequestSigning !== 'undefined' &&
            !validator.isBoolean(options.enableRequestSigning)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.enableRequestSigning" must be a boolean.');
        }
        if (typeof options.enabled !== 'undefined' &&
            !validator.isBoolean(options.enabled)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.enabled" must be a boolean.');
        }
        if (typeof options.displayName !== 'undefined' &&
            !validator.isString(options.displayName)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SAMLAuthProviderConfig.displayName" must be a valid string.');
        }
    }
    /**
     * The SAMLConfig constructor.
     *
     * @param response - The server side response used to initialize the SAMLConfig object.
     * @constructor
     */
    constructor(response) {
        if (!response ||
            !response.idpConfig ||
            !response.idpConfig.idpEntityId ||
            !response.idpConfig.ssoUrl ||
            !response.spConfig ||
            !response.spConfig.spEntityId ||
            !response.name ||
            !(validator.isString(response.name) &&
                SAMLConfig.getProviderIdFromResourceName(response.name))) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid SAML configuration response');
        }
        const providerId = SAMLConfig.getProviderIdFromResourceName(response.name);
        if (!providerId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid SAML configuration response');
        }
        this.providerId = providerId;
        // RP config.
        this.rpEntityId = response.spConfig.spEntityId;
        this.callbackURL = response.spConfig.callbackUri;
        // IdP config.
        this.idpEntityId = response.idpConfig.idpEntityId;
        this.ssoURL = response.idpConfig.ssoUrl;
        this.enableRequestSigning = !!response.idpConfig.signRequest;
        const x509Certificates = [];
        for (const cert of (response.idpConfig.idpCertificates || [])) {
            if (cert.x509Certificate) {
                x509Certificates.push(cert.x509Certificate);
            }
        }
        this.x509Certificates = x509Certificates;
        // When enabled is undefined, it takes its default value of false.
        this.enabled = !!response.enabled;
        this.displayName = response.displayName;
    }
    /** @returns The plain object representation of the SAMLConfig. */
    toJSON() {
        return {
            enabled: this.enabled,
            displayName: this.displayName,
            providerId: this.providerId,
            idpEntityId: this.idpEntityId,
            ssoURL: this.ssoURL,
            x509Certificates: (0, deep_copy_1.deepCopy)(this.x509Certificates),
            rpEntityId: this.rpEntityId,
            callbackURL: this.callbackURL,
            enableRequestSigning: this.enableRequestSigning,
        };
    }
}
exports.SAMLConfig = SAMLConfig;
/**
 * Defines the OIDCConfig class used to convert a client side configuration to its
 * server side representation.
 *
 * @internal
 */
class OIDCConfig {
    /**
     * Converts a client side request to a OIDCConfigServerRequest which is the format
     * accepted by the backend server.
     * Throws an error if validation fails. If the request is not a OIDCConfig request,
     * returns null.
     *
     * @param options - The options object to convert to a server request.
     * @param ignoreMissingFields - Whether to ignore missing fields.
     * @returns The resulting server request or null if not valid.
     */
    static buildServerRequest(options, ignoreMissingFields = false) {
        const makeRequest = validator.isNonNullObject(options) &&
            (options.providerId || ignoreMissingFields);
        if (!makeRequest) {
            return null;
        }
        const request = {};
        // Validate options.
        OIDCConfig.validate(options, ignoreMissingFields);
        request.enabled = options.enabled;
        request.displayName = options.displayName;
        request.issuer = options.issuer;
        request.clientId = options.clientId;
        if (typeof options.clientSecret !== 'undefined') {
            request.clientSecret = options.clientSecret;
        }
        if (typeof options.responseType !== 'undefined') {
            request.responseType = options.responseType;
        }
        return request;
    }
    /**
     * Returns the provider ID corresponding to the resource name if available.
     *
     * @param resourceName - The server side resource name
     * @returns The provider ID corresponding to the resource, null otherwise.
     */
    static getProviderIdFromResourceName(resourceName) {
        // name is of form projects/project1/oauthIdpConfigs/providerId1
        const matchProviderRes = resourceName.match(/\/oauthIdpConfigs\/(oidc\..*)$/);
        if (!matchProviderRes || matchProviderRes.length < 2) {
            return null;
        }
        return matchProviderRes[1];
    }
    /**
     * @param providerId - The provider ID to check.
     * @returns Whether the provider ID corresponds to an OIDC provider.
     */
    static isProviderId(providerId) {
        return validator.isNonEmptyString(providerId) && providerId.indexOf('oidc.') === 0;
    }
    /**
     * Validates the OIDCConfig options object. Throws an error on failure.
     *
     * @param options - The options object to validate.
     * @param ignoreMissingFields - Whether to ignore missing fields.
     */
    static validate(options, ignoreMissingFields = false) {
        const validKeys = {
            enabled: true,
            displayName: true,
            providerId: true,
            clientId: true,
            issuer: true,
            clientSecret: true,
            responseType: true,
        };
        const validResponseTypes = {
            idToken: true,
            code: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"OIDCAuthProviderConfig" must be a valid non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid OIDC config parameter.`);
            }
        }
        // Required fields.
        if (validator.isNonEmptyString(options.providerId)) {
            if (options.providerId.indexOf('oidc.') !== 0) {
                throw new error_1.FirebaseAuthError(!options.providerId ? error_1.AuthClientErrorCode.MISSING_PROVIDER_ID : error_1.AuthClientErrorCode.INVALID_PROVIDER_ID, '"OIDCAuthProviderConfig.providerId" must be a valid non-empty string prefixed with "oidc.".');
            }
        }
        else if (!ignoreMissingFields) {
            throw new error_1.FirebaseAuthError(!options.providerId ? error_1.AuthClientErrorCode.MISSING_PROVIDER_ID : error_1.AuthClientErrorCode.INVALID_PROVIDER_ID, '"OIDCAuthProviderConfig.providerId" must be a valid non-empty string prefixed with "oidc.".');
        }
        if (!(ignoreMissingFields && typeof options.clientId === 'undefined') &&
            !validator.isNonEmptyString(options.clientId)) {
            throw new error_1.FirebaseAuthError(!options.clientId ? error_1.AuthClientErrorCode.MISSING_OAUTH_CLIENT_ID : error_1.AuthClientErrorCode.INVALID_OAUTH_CLIENT_ID, '"OIDCAuthProviderConfig.clientId" must be a valid non-empty string.');
        }
        if (!(ignoreMissingFields && typeof options.issuer === 'undefined') &&
            !validator.isURL(options.issuer)) {
            throw new error_1.FirebaseAuthError(!options.issuer ? error_1.AuthClientErrorCode.MISSING_ISSUER : error_1.AuthClientErrorCode.INVALID_CONFIG, '"OIDCAuthProviderConfig.issuer" must be a valid URL string.');
        }
        if (typeof options.enabled !== 'undefined' &&
            !validator.isBoolean(options.enabled)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"OIDCAuthProviderConfig.enabled" must be a boolean.');
        }
        if (typeof options.displayName !== 'undefined' &&
            !validator.isString(options.displayName)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"OIDCAuthProviderConfig.displayName" must be a valid string.');
        }
        if (typeof options.clientSecret !== 'undefined' &&
            !validator.isNonEmptyString(options.clientSecret)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"OIDCAuthProviderConfig.clientSecret" must be a valid string.');
        }
        if (validator.isNonNullObject(options.responseType) && typeof options.responseType !== 'undefined') {
            Object.keys(options.responseType).forEach((key) => {
                if (!(key in validResponseTypes)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid OAuthResponseType parameter.`);
                }
            });
            const idToken = options.responseType.idToken;
            if (typeof idToken !== 'undefined' && !validator.isBoolean(idToken)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"OIDCAuthProviderConfig.responseType.idToken" must be a boolean.');
            }
            const code = options.responseType.code;
            if (typeof code !== 'undefined') {
                if (!validator.isBoolean(code)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"OIDCAuthProviderConfig.responseType.code" must be a boolean.');
                }
                // If code flow is enabled, client secret must be provided.
                if (code && typeof options.clientSecret === 'undefined') {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MISSING_OAUTH_CLIENT_SECRET, 'The OAuth configuration client secret is required to enable OIDC code flow.');
                }
            }
            const allKeys = Object.keys(options.responseType).length;
            const enabledCount = Object.values(options.responseType).filter(Boolean).length;
            // Only one of OAuth response types can be set to true.
            if (allKeys > 1 && enabledCount !== 1) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_OAUTH_RESPONSETYPE, 'Only exactly one OAuth responseType should be set to true.');
            }
        }
    }
    /**
     * The OIDCConfig constructor.
     *
     * @param response - The server side response used to initialize the OIDCConfig object.
     * @constructor
     */
    constructor(response) {
        if (!response ||
            !response.issuer ||
            !response.clientId ||
            !response.name ||
            !(validator.isString(response.name) &&
                OIDCConfig.getProviderIdFromResourceName(response.name))) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid OIDC configuration response');
        }
        const providerId = OIDCConfig.getProviderIdFromResourceName(response.name);
        if (!providerId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid SAML configuration response');
        }
        this.providerId = providerId;
        this.clientId = response.clientId;
        this.issuer = response.issuer;
        // When enabled is undefined, it takes its default value of false.
        this.enabled = !!response.enabled;
        this.displayName = response.displayName;
        if (typeof response.clientSecret !== 'undefined') {
            this.clientSecret = response.clientSecret;
        }
        if (typeof response.responseType !== 'undefined') {
            this.responseType = response.responseType;
        }
    }
    /** @returns The plain object representation of the OIDCConfig. */
    toJSON() {
        return {
            enabled: this.enabled,
            displayName: this.displayName,
            providerId: this.providerId,
            issuer: this.issuer,
            clientId: this.clientId,
            clientSecret: (0, deep_copy_1.deepCopy)(this.clientSecret),
            responseType: (0, deep_copy_1.deepCopy)(this.responseType),
        };
    }
}
exports.OIDCConfig = OIDCConfig;
/**
 * Defines the SMSRegionConfig class used for validation.
 *
 * @internal
 */
class SmsRegionsAuthConfig {
    static validate(options) {
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SmsRegionConfig" must be a non-null object.');
        }
        const validKeys = {
            allowlistOnly: true,
            allowByDefault: true,
        };
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid SmsRegionConfig parameter.`);
            }
        }
        // validate mutual exclusiveness of allowByDefault and allowlistOnly
        if (typeof options.allowByDefault !== 'undefined' && typeof options.allowlistOnly !== 'undefined') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, 'SmsRegionConfig cannot have both "allowByDefault" and "allowlistOnly" parameters.');
        }
        // validation for allowByDefault type
        if (typeof options.allowByDefault !== 'undefined') {
            const allowByDefaultValidKeys = {
                disallowedRegions: true,
            };
            for (const key in options.allowByDefault) {
                if (!(key in allowByDefaultValidKeys)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid SmsRegionConfig.allowByDefault parameter.`);
                }
            }
            // disallowedRegion can be empty.
            if (typeof options.allowByDefault.disallowedRegions !== 'undefined'
                && !validator.isArray(options.allowByDefault.disallowedRegions)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SmsRegionConfig.allowByDefault.disallowedRegions" must be a valid string array.');
            }
        }
        if (typeof options.allowlistOnly !== 'undefined') {
            const allowListOnlyValidKeys = {
                allowedRegions: true,
            };
            for (const key in options.allowlistOnly) {
                if (!(key in allowListOnlyValidKeys)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid SmsRegionConfig.allowlistOnly parameter.`);
                }
            }
            // allowedRegions can be empty
            if (typeof options.allowlistOnly.allowedRegions !== 'undefined'
                && !validator.isArray(options.allowlistOnly.allowedRegions)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"SmsRegionConfig.allowlistOnly.allowedRegions" must be a valid string array.');
            }
        }
    }
}
exports.SmsRegionsAuthConfig = SmsRegionsAuthConfig;
/**
 * Defines the recaptcha config class used to convert client side RecaptchaConfig
 * to a format that is understood by the Auth server.
 *
 * @internal
 */
class RecaptchaAuthConfig {
    /**
     * The RecaptchaAuthConfig constructor.
     *
     * @param response - The server side response used to initialize the
     *     RecaptchaAuthConfig object.
     * @constructor
     * @internal
     */
    constructor(response) {
        const filteredResponse = Object.fromEntries(Object.entries(response).filter(([, value]) => value !== undefined));
        // Explicitly map the 'tollFraudManagedRules' to 'smsTollFraudManagedRules'
        if (filteredResponse.tollFraudManagedRules !== undefined) {
            this.smsTollFraudManagedRules = filteredResponse.tollFraudManagedRules;
            delete filteredResponse.tollFraudManagedRules; // Remove it if necessary
        }
        // Assign the remaining properties directly
        Object.assign(this, filteredResponse);
    }
    /**
     * Builds a server request object from the client-side RecaptchaConfig.
     * Converts client-side fields to their server-side equivalents.
     *
     * @param options - The client-side RecaptchaConfig object.
     * @returns The server-side RecaptchaAuthServerConfig object.
     */
    static buildServerRequest(options) {
        RecaptchaAuthConfig.validate(options); // Validate options before building request
        const request = {};
        if (typeof options.emailPasswordEnforcementState !== 'undefined') {
            request.emailPasswordEnforcementState = options.emailPasswordEnforcementState;
        }
        if (typeof options.phoneEnforcementState !== 'undefined') {
            request.phoneEnforcementState = options.phoneEnforcementState;
        }
        if (typeof options.managedRules !== 'undefined') {
            request.managedRules = options.managedRules;
        }
        if (typeof options.recaptchaKeys !== 'undefined') {
            request.recaptchaKeys = options.recaptchaKeys;
        }
        if (typeof options.useAccountDefender !== 'undefined') {
            request.useAccountDefender = options.useAccountDefender;
        }
        if (typeof options.useSmsBotScore !== 'undefined') {
            request.useSmsBotScore = options.useSmsBotScore;
        }
        if (typeof options.useSmsTollFraudProtection !== 'undefined') {
            request.useSmsTollFraudProtection = options.useSmsTollFraudProtection;
        }
        if (typeof options.smsTollFraudManagedRules !== 'undefined') {
            request.tollFraudManagedRules = options.smsTollFraudManagedRules; // Map client-side field to server-side
        }
        return request;
    }
    /**
     * Validates the RecaptchaConfig options object. Throws an error on failure.
     * @param options - The options object to validate.
     */
    static validate(options) {
        const validKeys = {
            emailPasswordEnforcementState: true,
            phoneEnforcementState: true,
            managedRules: true,
            recaptchaKeys: true,
            useAccountDefender: true,
            useSmsBotScore: true,
            useSmsTollFraudProtection: true,
            smsTollFraudManagedRules: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig" must be a non-null object.');
        }
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid RecaptchaConfig parameter.`);
            }
        }
        // Validation
        if (typeof options.emailPasswordEnforcementState !== 'undefined') {
            if (!validator.isNonEmptyString(options.emailPasswordEnforcementState)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"RecaptchaConfig.emailPasswordEnforcementState" must be a valid non-empty string.');
            }
            if (options.emailPasswordEnforcementState !== 'OFF' &&
                options.emailPasswordEnforcementState !== 'AUDIT' &&
                options.emailPasswordEnforcementState !== 'ENFORCE') {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.emailPasswordEnforcementState" must be either "OFF", "AUDIT" or "ENFORCE".');
            }
        }
        if (typeof options.phoneEnforcementState !== 'undefined') {
            if (!validator.isNonEmptyString(options.phoneEnforcementState)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"RecaptchaConfig.phoneEnforcementState" must be a valid non-empty string.');
            }
            if (options.phoneEnforcementState !== 'OFF' &&
                options.phoneEnforcementState !== 'AUDIT' &&
                options.phoneEnforcementState !== 'ENFORCE') {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.phoneEnforcementState" must be either "OFF", "AUDIT" or "ENFORCE".');
            }
        }
        if (typeof options.managedRules !== 'undefined') {
            // Validate array
            if (!validator.isArray(options.managedRules)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.managedRules" must be an array of valid "RecaptchaManagedRule".');
            }
            // Validate each rule of the array
            options.managedRules.forEach((managedRule) => {
                RecaptchaAuthConfig.validateManagedRule(managedRule);
            });
        }
        if (typeof options.useAccountDefender !== 'undefined') {
            if (!validator.isBoolean(options.useAccountDefender)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.useAccountDefender" must be a boolean value".');
            }
        }
        if (typeof options.useSmsBotScore !== 'undefined') {
            if (!validator.isBoolean(options.useSmsBotScore)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.useSmsBotScore" must be a boolean value".');
            }
        }
        if (typeof options.useSmsTollFraudProtection !== 'undefined') {
            if (!validator.isBoolean(options.useSmsTollFraudProtection)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.useSmsTollFraudProtection" must be a boolean value".');
            }
        }
        if (typeof options.smsTollFraudManagedRules !== 'undefined') {
            // Validate array
            if (!validator.isArray(options.smsTollFraudManagedRules)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaConfig.smsTollFraudManagedRules" must be an array of valid "RecaptchaTollFraudManagedRule".');
            }
            // Validate each rule of the array
            options.smsTollFraudManagedRules.forEach((tollFraudManagedRule) => {
                RecaptchaAuthConfig.validateTollFraudManagedRule(tollFraudManagedRule);
            });
        }
    }
    /**
     * Validate each element in ManagedRule array
     * @param options - The options object to validate.
     */
    static validateManagedRule(options) {
        const validKeys = {
            endScore: true,
            action: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaManagedRule" must be a non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid RecaptchaManagedRule parameter.`);
            }
        }
        // Validate content.
        if (typeof options.action !== 'undefined' &&
            options.action !== 'BLOCK') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaManagedRule.action" must be "BLOCK".');
        }
    }
    /**
     * Validate each element in TollFraudManagedRule array
     * @param options - The options object to validate.
     */
    static validateTollFraudManagedRule(options) {
        const validKeys = {
            startScore: true,
            action: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaTollFraudManagedRule" must be a non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid RecaptchaTollFraudManagedRule parameter.`);
            }
        }
        // Validate content.
        if (typeof options.action !== 'undefined' &&
            options.action !== 'BLOCK') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"RecaptchaTollFraudManagedRule.action" must be "BLOCK".');
        }
    }
}
exports.RecaptchaAuthConfig = RecaptchaAuthConfig;
/**
 * Defines the MobileLinksAuthConfig class used for validation.
 *
 * @internal
 */
class MobileLinksAuthConfig {
    static validate(options) {
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MobileLinksConfig" must be a non-null object.');
        }
        const validKeys = {
            domain: true,
        };
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid "MobileLinksConfig" parameter.`);
            }
        }
        if (typeof options.domain !== 'undefined'
            && options.domain !== 'HOSTING_DOMAIN'
            && options.domain !== 'FIREBASE_DYNAMIC_LINK_DOMAIN') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"MobileLinksConfig.domain" must be either "HOSTING_DOMAIN" or "FIREBASE_DYNAMIC_LINK_DOMAIN".');
        }
    }
}
exports.MobileLinksAuthConfig = MobileLinksAuthConfig;
/**
 * Defines the password policy config class used to convert client side PasswordPolicyConfig
 * to a format that is understood by the Auth server.
 *
 * @internal
 */
class PasswordPolicyAuthConfig {
    /**
     * Static method to convert a client side request to a PasswordPolicyAuthServerConfig.
     * Throws an error if validation fails.
     *
     * @param options - The options object to convert to a server request.
     * @returns The resulting server request.
     * @internal
     */
    static buildServerRequest(options) {
        const request = {};
        PasswordPolicyAuthConfig.validate(options);
        if (Object.prototype.hasOwnProperty.call(options, 'enforcementState')) {
            request.passwordPolicyEnforcementState = options.enforcementState;
        }
        request.forceUpgradeOnSignin = false;
        if (Object.prototype.hasOwnProperty.call(options, 'forceUpgradeOnSignin')) {
            request.forceUpgradeOnSignin = options.forceUpgradeOnSignin;
        }
        const constraintsRequest = {
            containsUppercaseCharacter: false,
            containsLowercaseCharacter: false,
            containsNonAlphanumericCharacter: false,
            containsNumericCharacter: false,
            minPasswordLength: 6,
            maxPasswordLength: 4096,
        };
        request.passwordPolicyVersions = [];
        if (Object.prototype.hasOwnProperty.call(options, 'constraints')) {
            if (options) {
                if (options.constraints?.requireUppercase !== undefined) {
                    constraintsRequest.containsUppercaseCharacter = options.constraints.requireUppercase;
                }
                if (options.constraints?.requireLowercase !== undefined) {
                    constraintsRequest.containsLowercaseCharacter = options.constraints.requireLowercase;
                }
                if (options.constraints?.requireNonAlphanumeric !== undefined) {
                    constraintsRequest.containsNonAlphanumericCharacter = options.constraints.requireNonAlphanumeric;
                }
                if (options.constraints?.requireNumeric !== undefined) {
                    constraintsRequest.containsNumericCharacter = options.constraints.requireNumeric;
                }
                if (options.constraints?.minLength !== undefined) {
                    constraintsRequest.minPasswordLength = options.constraints.minLength;
                }
                if (options.constraints?.maxLength !== undefined) {
                    constraintsRequest.maxPasswordLength = options.constraints.maxLength;
                }
            }
        }
        request.passwordPolicyVersions.push({ customStrengthOptions: constraintsRequest });
        return request;
    }
    /**
     * Validates the PasswordPolicyConfig options object. Throws an error on failure.
     *
     * @param options - The options object to validate.
     * @internal
     */
    static validate(options) {
        const validKeys = {
            enforcementState: true,
            forceUpgradeOnSignin: true,
            constraints: true,
        };
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig" must be a non-null object.');
        }
        // Check for unsupported top level attributes.
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid PasswordPolicyConfig parameter.`);
            }
        }
        // Validate content.
        if (typeof options.enforcementState === 'undefined' ||
            !(options.enforcementState === 'ENFORCE' ||
                options.enforcementState === 'OFF')) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.enforcementState" must be either "ENFORCE" or "OFF".');
        }
        if (typeof options.forceUpgradeOnSignin !== 'undefined') {
            if (!validator.isBoolean(options.forceUpgradeOnSignin)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.forceUpgradeOnSignin" must be a boolean.');
            }
        }
        if (typeof options.constraints !== 'undefined') {
            if (options.enforcementState === 'ENFORCE' && !validator.isNonNullObject(options.constraints)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints" must be a non-empty object.');
            }
            const validCharKeys = {
                requireUppercase: true,
                requireLowercase: true,
                requireNumeric: true,
                requireNonAlphanumeric: true,
                minLength: true,
                maxLength: true,
            };
            // Check for unsupported  attributes.
            for (const key in options.constraints) {
                if (!(key in validCharKeys)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid PasswordPolicyConfig.constraints parameter.`);
                }
            }
            if (typeof options.constraints.requireUppercase !== 'undefined' &&
                !validator.isBoolean(options.constraints.requireUppercase)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.requireUppercase" must be a boolean.');
            }
            if (typeof options.constraints.requireLowercase !== 'undefined' &&
                !validator.isBoolean(options.constraints.requireLowercase)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.requireLowercase" must be a boolean.');
            }
            if (typeof options.constraints.requireNonAlphanumeric !== 'undefined' &&
                !validator.isBoolean(options.constraints.requireNonAlphanumeric)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.requireNonAlphanumeric"' +
                    ' must be a boolean.');
            }
            if (typeof options.constraints.requireNumeric !== 'undefined' &&
                !validator.isBoolean(options.constraints.requireNumeric)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.requireNumeric" must be a boolean.');
            }
            if (typeof options.constraints.minLength === 'undefined') {
                options.constraints.minLength = 6;
            }
            else if (!validator.isNumber(options.constraints.minLength)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.minLength" must be a number.');
            }
            else {
                if (!(options.constraints.minLength >= 6
                    && options.constraints.minLength <= 30)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.minLength"' +
                        ' must be an integer between 6 and 30, inclusive.');
                }
            }
            if (typeof options.constraints.maxLength === 'undefined') {
                options.constraints.maxLength = 4096;
            }
            else if (!validator.isNumber(options.constraints.maxLength)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.maxLength" must be a number.');
            }
            else {
                if (!(options.constraints.maxLength >= options.constraints.minLength &&
                    options.constraints.maxLength <= 4096)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints.maxLength"' +
                        ' must be greater than or equal to minLength and at max 4096.');
                }
            }
        }
        else {
            if (options.enforcementState === 'ENFORCE') {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"PasswordPolicyConfig.constraints" must be defined.');
            }
        }
    }
    /**
     * The PasswordPolicyAuthConfig constructor.
     *
     * @param response - The server side response used to initialize the
     *     PasswordPolicyAuthConfig object.
     * @constructor
     * @internal
     */
    constructor(response) {
        if (typeof response.passwordPolicyEnforcementState === 'undefined') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid password policy configuration response');
        }
        this.enforcementState = response.passwordPolicyEnforcementState;
        let constraintsResponse = {};
        if (typeof response.passwordPolicyVersions !== 'undefined') {
            (response.passwordPolicyVersions || []).forEach((policyVersion) => {
                constraintsResponse = {
                    requireLowercase: policyVersion.customStrengthOptions?.containsLowercaseCharacter,
                    requireUppercase: policyVersion.customStrengthOptions?.containsUppercaseCharacter,
                    requireNonAlphanumeric: policyVersion.customStrengthOptions?.containsNonAlphanumericCharacter,
                    requireNumeric: policyVersion.customStrengthOptions?.containsNumericCharacter,
                    minLength: policyVersion.customStrengthOptions?.minPasswordLength,
                    maxLength: policyVersion.customStrengthOptions?.maxPasswordLength,
                };
            });
        }
        this.constraints = constraintsResponse;
        this.forceUpgradeOnSignin = response.forceUpgradeOnSignin ? true : false;
    }
}
exports.PasswordPolicyAuthConfig = PasswordPolicyAuthConfig;
/**
 * Defines the EmailPrivacyAuthConfig class used for validation.
 *
 * @internal
 */
class EmailPrivacyAuthConfig {
    static validate(options) {
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"EmailPrivacyConfig" must be a non-null object.');
        }
        const validKeys = {
            enableImprovedEmailPrivacy: true,
        };
        for (const key in options) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, `"${key}" is not a valid "EmailPrivacyConfig" parameter.`);
            }
        }
        if (typeof options.enableImprovedEmailPrivacy !== 'undefined'
            && !validator.isBoolean(options.enableImprovedEmailPrivacy)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, '"EmailPrivacyConfig.enableImprovedEmailPrivacy" must be a valid boolean value.');
        }
    }
}
exports.EmailPrivacyAuthConfig = EmailPrivacyAuthConfig;
