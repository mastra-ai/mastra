/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2019 Google Inc.
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
exports.Tenant = void 0;
const validator = require("../utils/validator");
const deep_copy_1 = require("../utils/deep-copy");
const error_1 = require("../utils/error");
const auth_config_1 = require("./auth-config");
/**
 * Represents a tenant configuration.
 *
 * Multi-tenancy support requires Google Cloud's Identity Platform
 * (GCIP). To learn more about GCIP, including pricing and features,
 * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
 *
 * Before multi-tenancy can be used on a Google Cloud Identity Platform project,
 * tenants must be allowed on that project via the Cloud Console UI.
 *
 * A tenant configuration provides information such as the display name, tenant
 * identifier and email authentication configuration.
 * For OIDC/SAML provider configuration management, `TenantAwareAuth` instances should
 * be used instead of a `Tenant` to retrieve the list of configured IdPs on a tenant.
 * When configuring these providers, note that tenants will inherit
 * whitelisted domains and authenticated redirect URIs of their parent project.
 *
 * All other settings of a tenant will also be inherited. These will need to be managed
 * from the Cloud Console UI.
 */
class Tenant {
    /**
     * Builds the corresponding server request for a TenantOptions object.
     *
     * @param tenantOptions - The properties to convert to a server request.
     * @param createRequest - Whether this is a create request.
     * @returns The equivalent server request.
     *
     * @internal
     */
    static buildServerRequest(tenantOptions, createRequest) {
        Tenant.validate(tenantOptions, createRequest);
        let request = {};
        if (typeof tenantOptions.emailSignInConfig !== 'undefined') {
            request = auth_config_1.EmailSignInConfig.buildServerRequest(tenantOptions.emailSignInConfig);
        }
        if (typeof tenantOptions.displayName !== 'undefined') {
            request.displayName = tenantOptions.displayName;
        }
        if (typeof tenantOptions.anonymousSignInEnabled !== 'undefined') {
            request.enableAnonymousUser = tenantOptions.anonymousSignInEnabled;
        }
        if (typeof tenantOptions.multiFactorConfig !== 'undefined') {
            request.mfaConfig = auth_config_1.MultiFactorAuthConfig.buildServerRequest(tenantOptions.multiFactorConfig);
        }
        if (typeof tenantOptions.testPhoneNumbers !== 'undefined') {
            // null will clear existing test phone numbers. Translate to empty object.
            request.testPhoneNumbers = tenantOptions.testPhoneNumbers ?? {};
        }
        if (typeof tenantOptions.smsRegionConfig !== 'undefined') {
            request.smsRegionConfig = tenantOptions.smsRegionConfig;
        }
        if (typeof tenantOptions.recaptchaConfig !== 'undefined') {
            request.recaptchaConfig = auth_config_1.RecaptchaAuthConfig.buildServerRequest(tenantOptions.recaptchaConfig);
        }
        if (typeof tenantOptions.passwordPolicyConfig !== 'undefined') {
            request.passwordPolicyConfig = auth_config_1.PasswordPolicyAuthConfig.buildServerRequest(tenantOptions.passwordPolicyConfig);
        }
        if (typeof tenantOptions.emailPrivacyConfig !== 'undefined') {
            request.emailPrivacyConfig = tenantOptions.emailPrivacyConfig;
        }
        return request;
    }
    /**
     * Returns the tenant ID corresponding to the resource name if available.
     *
     * @param resourceName - The server side resource name
     * @returns The tenant ID corresponding to the resource, null otherwise.
     *
     * @internal
     */
    static getTenantIdFromResourceName(resourceName) {
        // name is of form projects/project1/tenants/tenant1
        const matchTenantRes = resourceName.match(/\/tenants\/(.*)$/);
        if (!matchTenantRes || matchTenantRes.length < 2) {
            return null;
        }
        return matchTenantRes[1];
    }
    /**
     * Validates a tenant options object. Throws an error on failure.
     *
     * @param request - The tenant options object to validate.
     * @param createRequest - Whether this is a create request.
     */
    static validate(request, createRequest) {
        const validKeys = {
            displayName: true,
            emailSignInConfig: true,
            anonymousSignInEnabled: true,
            multiFactorConfig: true,
            testPhoneNumbers: true,
            smsRegionConfig: true,
            recaptchaConfig: true,
            passwordPolicyConfig: true,
            emailPrivacyConfig: true,
        };
        const label = createRequest ? 'CreateTenantRequest' : 'UpdateTenantRequest';
        if (!validator.isNonNullObject(request)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${label}" must be a valid non-null object.`);
        }
        // Check for unsupported top level attributes.
        for (const key in request) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${key}" is not a valid ${label} parameter.`);
            }
        }
        // Validate displayName type if provided.
        if (typeof request.displayName !== 'undefined' &&
            !validator.isNonEmptyString(request.displayName)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${label}.displayName" must be a valid non-empty string.`);
        }
        // Validate emailSignInConfig type if provided.
        if (typeof request.emailSignInConfig !== 'undefined') {
            // This will throw an error if invalid.
            auth_config_1.EmailSignInConfig.buildServerRequest(request.emailSignInConfig);
        }
        // Validate test phone numbers if provided.
        if (typeof request.testPhoneNumbers !== 'undefined' &&
            request.testPhoneNumbers !== null) {
            (0, auth_config_1.validateTestPhoneNumbers)(request.testPhoneNumbers);
        }
        else if (request.testPhoneNumbers === null && createRequest) {
            // null allowed only for update operations.
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${label}.testPhoneNumbers" must be a non-null object.`);
        }
        // Validate multiFactorConfig type if provided.
        if (typeof request.multiFactorConfig !== 'undefined') {
            // This will throw an error if invalid.
            auth_config_1.MultiFactorAuthConfig.buildServerRequest(request.multiFactorConfig);
        }
        // Validate SMS Regions Config if provided.
        if (typeof request.smsRegionConfig !== 'undefined') {
            auth_config_1.SmsRegionsAuthConfig.validate(request.smsRegionConfig);
        }
        // Validate reCAPTCHAConfig type if provided.
        if (typeof request.recaptchaConfig !== 'undefined') {
            auth_config_1.RecaptchaAuthConfig.buildServerRequest(request.recaptchaConfig);
        }
        // Validate passwordPolicyConfig type if provided.
        if (typeof request.passwordPolicyConfig !== 'undefined') {
            // This will throw an error if invalid.
            auth_config_1.PasswordPolicyAuthConfig.buildServerRequest(request.passwordPolicyConfig);
        }
        // Validate Email Privacy Config if provided.
        if (typeof request.emailPrivacyConfig !== 'undefined') {
            auth_config_1.EmailPrivacyAuthConfig.validate(request.emailPrivacyConfig);
        }
    }
    /**
     * The Tenant object constructor.
     *
     * @param response - The server side response used to initialize the Tenant object.
     * @constructor
     * @internal
     */
    constructor(response) {
        const tenantId = Tenant.getTenantIdFromResourceName(response.name);
        if (!tenantId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid tenant response');
        }
        this.tenantId = tenantId;
        this.displayName = response.displayName;
        try {
            this.emailSignInConfig_ = new auth_config_1.EmailSignInConfig(response);
        }
        catch (e) {
            // If allowPasswordSignup is undefined, it is disabled by default.
            this.emailSignInConfig_ = new auth_config_1.EmailSignInConfig({
                allowPasswordSignup: false,
            });
        }
        this.anonymousSignInEnabled = !!response.enableAnonymousUser;
        if (typeof response.mfaConfig !== 'undefined') {
            this.multiFactorConfig_ = new auth_config_1.MultiFactorAuthConfig(response.mfaConfig);
        }
        if (typeof response.testPhoneNumbers !== 'undefined') {
            this.testPhoneNumbers = (0, deep_copy_1.deepCopy)(response.testPhoneNumbers || {});
        }
        if (typeof response.smsRegionConfig !== 'undefined') {
            this.smsRegionConfig = (0, deep_copy_1.deepCopy)(response.smsRegionConfig);
        }
        if (typeof response.recaptchaConfig !== 'undefined') {
            this.recaptchaConfig_ = new auth_config_1.RecaptchaAuthConfig(response.recaptchaConfig);
        }
        if (typeof response.passwordPolicyConfig !== 'undefined') {
            this.passwordPolicyConfig = new auth_config_1.PasswordPolicyAuthConfig(response.passwordPolicyConfig);
        }
        if (typeof response.emailPrivacyConfig !== 'undefined') {
            this.emailPrivacyConfig = (0, deep_copy_1.deepCopy)(response.emailPrivacyConfig);
        }
    }
    /**
     * The email sign in provider configuration.
     */
    get emailSignInConfig() {
        return this.emailSignInConfig_;
    }
    /**
     * The multi-factor auth configuration on the current tenant.
     */
    get multiFactorConfig() {
        return this.multiFactorConfig_;
    }
    /**
     * The recaptcha config auth configuration of the current tenant.
     */
    get recaptchaConfig() {
        return this.recaptchaConfig_;
    }
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON() {
        const json = {
            tenantId: this.tenantId,
            displayName: this.displayName,
            emailSignInConfig: this.emailSignInConfig_?.toJSON(),
            multiFactorConfig: this.multiFactorConfig_?.toJSON(),
            anonymousSignInEnabled: this.anonymousSignInEnabled,
            testPhoneNumbers: this.testPhoneNumbers,
            smsRegionConfig: (0, deep_copy_1.deepCopy)(this.smsRegionConfig),
            recaptchaConfig: (0, deep_copy_1.deepCopy)(this.recaptchaConfig),
            passwordPolicyConfig: (0, deep_copy_1.deepCopy)(this.passwordPolicyConfig),
            emailPrivacyConfig: (0, deep_copy_1.deepCopy)(this.emailPrivacyConfig),
        };
        if (typeof json.multiFactorConfig === 'undefined') {
            delete json.multiFactorConfig;
        }
        if (typeof json.testPhoneNumbers === 'undefined') {
            delete json.testPhoneNumbers;
        }
        if (typeof json.smsRegionConfig === 'undefined') {
            delete json.smsRegionConfig;
        }
        if (typeof json.recaptchaConfig === 'undefined') {
            delete json.recaptchaConfig;
        }
        if (typeof json.passwordPolicyConfig === 'undefined') {
            delete json.passwordPolicyConfig;
        }
        if (typeof json.emailPrivacyConfig === 'undefined') {
            delete json.emailPrivacyConfig;
        }
        return json;
    }
}
exports.Tenant = Tenant;
