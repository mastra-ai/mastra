/*! firebase-admin v13.5.0 */
import { SmsRegionConfig, MultiFactorConfig, MultiFactorAuthServerConfig, RecaptchaConfig, RecaptchaAuthServerConfig, PasswordPolicyAuthServerConfig, PasswordPolicyConfig, EmailPrivacyConfig, MobileLinksConfig } from './auth-config';
/**
 * Interface representing the properties to update on the provided project config.
 */
export interface UpdateProjectConfigRequest {
    /**
     * The SMS configuration to update on the project.
     */
    smsRegionConfig?: SmsRegionConfig;
    /**
     * The multi-factor auth configuration to update on the project.
     */
    multiFactorConfig?: MultiFactorConfig;
    /**
     * The reCAPTCHA configuration to update on the project.
     * By enabling reCAPTCHA Enterprise integration, you are
     * agreeing to the reCAPTCHA Enterprise
     * {@link https://cloud.google.com/terms/service-terms | Term of Service}.
     */
    recaptchaConfig?: RecaptchaConfig;
    /**
     * The password policy configuration to update on the project
     */
    passwordPolicyConfig?: PasswordPolicyConfig;
    /**
     * The email privacy configuration to update on the project
     */
    emailPrivacyConfig?: EmailPrivacyConfig;
    /**
     * The mobile links configuration for the project
     */
    mobileLinksConfig?: MobileLinksConfig;
}
/**
 * Response received when getting or updating the project config.
 */
export interface ProjectConfigServerResponse {
    smsRegionConfig?: SmsRegionConfig;
    mfa?: MultiFactorAuthServerConfig;
    recaptchaConfig?: RecaptchaAuthServerConfig;
    passwordPolicyConfig?: PasswordPolicyAuthServerConfig;
    emailPrivacyConfig?: EmailPrivacyConfig;
    mobileLinksConfig?: MobileLinksConfig;
}
/**
 * Request to update the project config.
 */
export interface ProjectConfigClientRequest {
    smsRegionConfig?: SmsRegionConfig;
    mfa?: MultiFactorAuthServerConfig;
    recaptchaConfig?: RecaptchaAuthServerConfig;
    passwordPolicyConfig?: PasswordPolicyAuthServerConfig;
    emailPrivacyConfig?: EmailPrivacyConfig;
    mobileLinksConfig?: MobileLinksConfig;
}
/**
* Represents a project configuration.
*/
export declare class ProjectConfig {
    /**
     * The SMS Regions Config for the project.
     * Configures the regions where users are allowed to send verification SMS.
     * This is based on the calling code of the destination phone number.
     */
    readonly smsRegionConfig?: SmsRegionConfig;
    /**
     * The project's multi-factor auth configuration.
     * Supports only phone and TOTP.
     */
    private readonly multiFactorConfig_?;
    /**
     * The multi-factor auth configuration.
     */
    get multiFactorConfig(): MultiFactorConfig | undefined;
    /**
     * The reCAPTCHA configuration to update on the project.
     * By enabling reCAPTCHA Enterprise integration, you are
     * agreeing to the reCAPTCHA Enterprise
     * {@link https://cloud.google.com/terms/service-terms | Term of Service}.
     */
    private readonly recaptchaConfig_?;
    /**
     * The reCAPTCHA configuration.
     */
    get recaptchaConfig(): RecaptchaConfig | undefined;
    /**
     * The password policy configuration for the project
     */
    readonly passwordPolicyConfig?: PasswordPolicyConfig;
    /**
     * The email privacy configuration for the project
     */
    readonly emailPrivacyConfig?: EmailPrivacyConfig;
    /**
     * The mobile links configuration for the project
     */
    readonly mobileLinksConfig?: MobileLinksConfig;
    /**
     * Validates a project config options object. Throws an error on failure.
     *
     * @param request - The project config options object to validate.
     */
    private static validate;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): object;
}
