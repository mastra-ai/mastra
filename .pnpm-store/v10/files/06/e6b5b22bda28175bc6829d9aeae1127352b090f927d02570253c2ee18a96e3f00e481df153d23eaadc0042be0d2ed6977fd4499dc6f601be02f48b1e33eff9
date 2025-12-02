/*! firebase-admin v13.5.0 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectConfig = void 0;
/*!
 * Copyright 2022 Google Inc.
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
const validator = require("../utils/validator");
const error_1 = require("../utils/error");
const auth_config_1 = require("./auth-config");
const deep_copy_1 = require("../utils/deep-copy");
/**
* Represents a project configuration.
*/
class ProjectConfig {
    /**
     * The multi-factor auth configuration.
     */
    get multiFactorConfig() {
        return this.multiFactorConfig_;
    }
    /**
     * The reCAPTCHA configuration.
     */
    get recaptchaConfig() {
        return this.recaptchaConfig_;
    }
    /**
     * Validates a project config options object. Throws an error on failure.
     *
     * @param request - The project config options object to validate.
     */
    static validate(request) {
        if (!validator.isNonNullObject(request)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"UpdateProjectConfigRequest" must be a valid non-null object.');
        }
        const validKeys = {
            smsRegionConfig: true,
            multiFactorConfig: true,
            recaptchaConfig: true,
            passwordPolicyConfig: true,
            emailPrivacyConfig: true,
            mobileLinksConfig: true,
        };
        // Check for unsupported top level attributes.
        for (const key in request) {
            if (!(key in validKeys)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${key}" is not a valid UpdateProjectConfigRequest parameter.`);
            }
        }
        // Validate SMS Regions Config if provided.
        if (typeof request.smsRegionConfig !== 'undefined') {
            auth_config_1.SmsRegionsAuthConfig.validate(request.smsRegionConfig);
        }
        // Validate Multi Factor Config if provided
        if (typeof request.multiFactorConfig !== 'undefined') {
            auth_config_1.MultiFactorAuthConfig.validate(request.multiFactorConfig);
        }
        // Validate reCAPTCHA config attribute.
        if (typeof request.recaptchaConfig !== 'undefined') {
            auth_config_1.RecaptchaAuthConfig.validate(request.recaptchaConfig);
        }
        // Validate Password policy Config if provided
        if (typeof request.passwordPolicyConfig !== 'undefined') {
            auth_config_1.PasswordPolicyAuthConfig.validate(request.passwordPolicyConfig);
        }
        // Validate Email Privacy Config if provided.
        if (typeof request.emailPrivacyConfig !== 'undefined') {
            auth_config_1.EmailPrivacyAuthConfig.validate(request.emailPrivacyConfig);
        }
        // Validate Mobile Links Config if provided.
        if (typeof request.mobileLinksConfig !== 'undefined') {
            auth_config_1.MobileLinksAuthConfig.validate(request.mobileLinksConfig);
        }
    }
    /**
     * Build the corresponding server request for a UpdateProjectConfigRequest object.
     * @param configOptions - The properties to convert to a server request.
     * @returns  The equivalent server request.
     *
     * @internal
     */
    static buildServerRequest(configOptions) {
        ProjectConfig.validate(configOptions);
        const request = {};
        if (typeof configOptions.smsRegionConfig !== 'undefined') {
            request.smsRegionConfig = configOptions.smsRegionConfig;
        }
        if (typeof configOptions.multiFactorConfig !== 'undefined') {
            request.mfa = auth_config_1.MultiFactorAuthConfig.buildServerRequest(configOptions.multiFactorConfig);
        }
        if (typeof configOptions.recaptchaConfig !== 'undefined') {
            request.recaptchaConfig = auth_config_1.RecaptchaAuthConfig.buildServerRequest(configOptions.recaptchaConfig);
        }
        if (typeof configOptions.passwordPolicyConfig !== 'undefined') {
            request.passwordPolicyConfig = auth_config_1.PasswordPolicyAuthConfig.buildServerRequest(configOptions.passwordPolicyConfig);
        }
        if (typeof configOptions.emailPrivacyConfig !== 'undefined') {
            request.emailPrivacyConfig = configOptions.emailPrivacyConfig;
        }
        if (typeof configOptions.mobileLinksConfig !== 'undefined') {
            request.mobileLinksConfig = configOptions.mobileLinksConfig;
        }
        return request;
    }
    /**
     * The Project Config object constructor.
     *
     * @param response - The server side response used to initialize the Project Config object.
     * @constructor
     * @internal
     */
    constructor(response) {
        if (typeof response.smsRegionConfig !== 'undefined') {
            this.smsRegionConfig = response.smsRegionConfig;
        }
        //Backend API returns "mfa" in case of project config and "mfaConfig" in case of tenant config. 
        //The SDK exposes it as multiFactorConfig always.
        if (typeof response.mfa !== 'undefined') {
            this.multiFactorConfig_ = new auth_config_1.MultiFactorAuthConfig(response.mfa);
        }
        if (typeof response.recaptchaConfig !== 'undefined') {
            this.recaptchaConfig_ = new auth_config_1.RecaptchaAuthConfig(response.recaptchaConfig);
        }
        if (typeof response.passwordPolicyConfig !== 'undefined') {
            this.passwordPolicyConfig = new auth_config_1.PasswordPolicyAuthConfig(response.passwordPolicyConfig);
        }
        if (typeof response.emailPrivacyConfig !== 'undefined') {
            this.emailPrivacyConfig = response.emailPrivacyConfig;
        }
        if (typeof response.mobileLinksConfig !== 'undefined') {
            this.mobileLinksConfig = response.mobileLinksConfig;
        }
    }
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON() {
        // JSON serialization
        const json = {
            smsRegionConfig: (0, deep_copy_1.deepCopy)(this.smsRegionConfig),
            multiFactorConfig: (0, deep_copy_1.deepCopy)(this.multiFactorConfig),
            recaptchaConfig: (0, deep_copy_1.deepCopy)(this.recaptchaConfig),
            passwordPolicyConfig: (0, deep_copy_1.deepCopy)(this.passwordPolicyConfig),
            emailPrivacyConfig: (0, deep_copy_1.deepCopy)(this.emailPrivacyConfig),
            mobileLinksConfig: (0, deep_copy_1.deepCopy)(this.mobileLinksConfig),
        };
        if (typeof json.smsRegionConfig === 'undefined') {
            delete json.smsRegionConfig;
        }
        if (typeof json.multiFactorConfig === 'undefined') {
            delete json.multiFactorConfig;
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
        if (typeof json.mobileLinksConfig === 'undefined') {
            delete json.mobileLinksConfig;
        }
        return json;
    }
}
exports.ProjectConfig = ProjectConfig;
