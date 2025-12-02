import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as IntegrationsAPI from "./integrations.js";
import { Integration, IntegrationCreateParams, IntegrationDeleteParams, IntegrationDeleteResponse, IntegrationEditParams, IntegrationGetParams, IntegrationListParams, Integrations, IntegrationsSinglePage } from "./integrations.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Posture extends APIResource {
    integrations: IntegrationsAPI.Integrations;
    /**
     * Creates a new device posture rule.
     *
     * @example
     * ```ts
     * const devicePostureRule =
     *   await client.zeroTrust.devices.posture.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'Admin Serial Numbers',
     *     type: 'file',
     *   });
     * ```
     */
    create(params: PostureCreateParams, options?: Core.RequestOptions): Core.APIPromise<DevicePostureRule | null>;
    /**
     * Updates a device posture rule.
     *
     * @example
     * ```ts
     * const devicePostureRule =
     *   await client.zeroTrust.devices.posture.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       name: 'Admin Serial Numbers',
     *       type: 'file',
     *     },
     *   );
     * ```
     */
    update(ruleId: string, params: PostureUpdateParams, options?: Core.RequestOptions): Core.APIPromise<DevicePostureRule | null>;
    /**
     * Fetches device posture rules for a Zero Trust account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const devicePostureRule of client.zeroTrust.devices.posture.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: PostureListParams, options?: Core.RequestOptions): Core.PagePromise<DevicePostureRulesSinglePage, DevicePostureRule>;
    /**
     * Deletes a device posture rule.
     *
     * @example
     * ```ts
     * const posture =
     *   await client.zeroTrust.devices.posture.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(ruleId: string, params: PostureDeleteParams, options?: Core.RequestOptions): Core.APIPromise<PostureDeleteResponse | null>;
    /**
     * Fetches a single device posture rule.
     *
     * @example
     * ```ts
     * const devicePostureRule =
     *   await client.zeroTrust.devices.posture.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(ruleId: string, params: PostureGetParams, options?: Core.RequestOptions): Core.APIPromise<DevicePostureRule | null>;
}
export declare class DevicePostureRulesSinglePage extends SinglePage<DevicePostureRule> {
}
export type CarbonblackInput = string;
export type CarbonblackInputParam = string;
export interface ClientCertificateInput {
    /**
     * UUID of Cloudflare managed certificate.
     */
    certificate_id: string;
    /**
     * Common Name that is protected by the certificate.
     */
    cn: string;
}
export interface ClientCertificateInputParam {
    /**
     * UUID of Cloudflare managed certificate.
     */
    certificate_id: string;
    /**
     * Common Name that is protected by the certificate.
     */
    cn: string;
}
export interface CrowdstrikeInput {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * For more details on last seen, please refer to the Crowdstrike documentation.
     */
    last_seen?: string;
    /**
     * Operator.
     */
    operator?: '<' | '<=' | '>' | '>=' | '==';
    /**
     * Os Version.
     */
    os?: string;
    /**
     * Overall.
     */
    overall?: string;
    /**
     * SensorConfig.
     */
    sensor_config?: string;
    /**
     * For more details on state, please refer to the Crowdstrike documentation.
     */
    state?: 'online' | 'offline' | 'unknown';
    /**
     * Version.
     */
    version?: string;
    /**
     * Version Operator.
     */
    versionOperator?: '<' | '<=' | '>' | '>=' | '==';
}
export interface CrowdstrikeInputParam {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * For more details on last seen, please refer to the Crowdstrike documentation.
     */
    last_seen?: string;
    /**
     * Operator.
     */
    operator?: '<' | '<=' | '>' | '>=' | '==';
    /**
     * Os Version.
     */
    os?: string;
    /**
     * Overall.
     */
    overall?: string;
    /**
     * SensorConfig.
     */
    sensor_config?: string;
    /**
     * For more details on state, please refer to the Crowdstrike documentation.
     */
    state?: 'online' | 'offline' | 'unknown';
    /**
     * Version.
     */
    version?: string;
    /**
     * Version Operator.
     */
    versionOperator?: '<' | '<=' | '>' | '>=' | '==';
}
/**
 * The value to be checked against.
 */
export type DeviceInput = FileInput | UniqueClientIDInput | DomainJoinedInput | OSVersionInput | FirewallInput | SentineloneInput | DeviceInput.TeamsDevicesCarbonblackInputRequest | DeviceInput.TeamsDevicesAccessSerialNumberListInputRequest | DiskEncryptionInput | DeviceInput.TeamsDevicesApplicationInputRequest | ClientCertificateInput | DeviceInput.TeamsDevicesClientCertificateV2InputRequest | WorkspaceOneInput | CrowdstrikeInput | IntuneInput | KolideInput | TaniumInput | SentineloneS2sInput | DeviceInput.TeamsDevicesCustomS2sInputRequest;
export declare namespace DeviceInput {
    interface TeamsDevicesCarbonblackInputRequest {
        /**
         * Operating system.
         */
        operating_system: 'windows' | 'linux' | 'mac';
        /**
         * File path.
         */
        path: string;
        /**
         * SHA-256.
         */
        sha256?: string;
        /**
         * Signing certificate thumbprint.
         */
        thumbprint?: string;
    }
    interface TeamsDevicesAccessSerialNumberListInputRequest {
        /**
         * UUID of Access List.
         */
        id: string;
    }
    interface TeamsDevicesApplicationInputRequest {
        /**
         * Operating system.
         */
        operating_system: 'windows' | 'linux' | 'mac';
        /**
         * Path for the application.
         */
        path: string;
        /**
         * SHA-256.
         */
        sha256?: string;
        /**
         * Signing certificate thumbprint.
         */
        thumbprint?: string;
    }
    interface TeamsDevicesClientCertificateV2InputRequest {
        /**
         * UUID of Cloudflare managed certificate.
         */
        certificate_id: string;
        /**
         * Confirm the certificate was not imported from another device. We recommend
         * keeping this enabled unless the certificate was deployed without a private key.
         */
        check_private_key: boolean;
        /**
         * Operating system.
         */
        operating_system: 'windows' | 'linux' | 'mac';
        /**
         * Certificate Common Name. This may include one or more variables in the ${ }
         * notation. Only ${serial_number} and ${hostname} are valid variables.
         */
        cn?: string;
        /**
         * List of values indicating purposes for which the certificate public key can be
         * used.
         */
        extended_key_usage?: Array<'clientAuth' | 'emailProtection'>;
        locations?: TeamsDevicesClientCertificateV2InputRequest.Locations;
        /**
         * List of certificate Subject Alternative Names.
         */
        subject_alternative_names?: Array<string>;
    }
    namespace TeamsDevicesClientCertificateV2InputRequest {
        interface Locations {
            /**
             * List of paths to check for client certificate on linux.
             */
            paths?: Array<string>;
            /**
             * List of trust stores to check for client certificate.
             */
            trust_stores?: Array<'system' | 'user'>;
        }
    }
    interface TeamsDevicesCustomS2sInputRequest {
        /**
         * Posture Integration ID.
         */
        connection_id: string;
        /**
         * Operator.
         */
        operator: '<' | '<=' | '>' | '>=' | '==';
        /**
         * A value between 0-100 assigned to devices set by the 3rd party posture provider.
         */
        score: number;
    }
}
/**
 * The value to be checked against.
 */
export type DeviceInputParam = FileInputParam | UniqueClientIDInputParam | DomainJoinedInputParam | OSVersionInputParam | FirewallInputParam | SentineloneInputParam | DeviceInputParam.TeamsDevicesCarbonblackInputRequest | DeviceInputParam.TeamsDevicesAccessSerialNumberListInputRequest | DiskEncryptionInputParam | DeviceInputParam.TeamsDevicesApplicationInputRequest | ClientCertificateInputParam | DeviceInputParam.TeamsDevicesClientCertificateV2InputRequest | WorkspaceOneInputParam | CrowdstrikeInputParam | IntuneInputParam | KolideInputParam | TaniumInputParam | SentineloneS2sInputParam | DeviceInputParam.TeamsDevicesCustomS2sInputRequest;
export declare namespace DeviceInputParam {
    interface TeamsDevicesCarbonblackInputRequest {
        /**
         * Operating system.
         */
        operating_system: 'windows' | 'linux' | 'mac';
        /**
         * File path.
         */
        path: string;
        /**
         * SHA-256.
         */
        sha256?: string;
        /**
         * Signing certificate thumbprint.
         */
        thumbprint?: string;
    }
    interface TeamsDevicesAccessSerialNumberListInputRequest {
        /**
         * UUID of Access List.
         */
        id: string;
    }
    interface TeamsDevicesApplicationInputRequest {
        /**
         * Operating system.
         */
        operating_system: 'windows' | 'linux' | 'mac';
        /**
         * Path for the application.
         */
        path: string;
        /**
         * SHA-256.
         */
        sha256?: string;
        /**
         * Signing certificate thumbprint.
         */
        thumbprint?: string;
    }
    interface TeamsDevicesClientCertificateV2InputRequest {
        /**
         * UUID of Cloudflare managed certificate.
         */
        certificate_id: string;
        /**
         * Confirm the certificate was not imported from another device. We recommend
         * keeping this enabled unless the certificate was deployed without a private key.
         */
        check_private_key: boolean;
        /**
         * Operating system.
         */
        operating_system: 'windows' | 'linux' | 'mac';
        /**
         * Certificate Common Name. This may include one or more variables in the ${ }
         * notation. Only ${serial_number} and ${hostname} are valid variables.
         */
        cn?: string;
        /**
         * List of values indicating purposes for which the certificate public key can be
         * used.
         */
        extended_key_usage?: Array<'clientAuth' | 'emailProtection'>;
        locations?: TeamsDevicesClientCertificateV2InputRequest.Locations;
        /**
         * List of certificate Subject Alternative Names.
         */
        subject_alternative_names?: Array<string>;
    }
    namespace TeamsDevicesClientCertificateV2InputRequest {
        interface Locations {
            /**
             * List of paths to check for client certificate on linux.
             */
            paths?: Array<string>;
            /**
             * List of trust stores to check for client certificate.
             */
            trust_stores?: Array<'system' | 'user'>;
        }
    }
    interface TeamsDevicesCustomS2sInputRequest {
        /**
         * Posture Integration ID.
         */
        connection_id: string;
        /**
         * Operator.
         */
        operator: '<' | '<=' | '>' | '>=' | '==';
        /**
         * A value between 0-100 assigned to devices set by the 3rd party posture provider.
         */
        score: number;
    }
}
export interface DeviceMatch {
    platform?: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'chromeos';
}
export interface DeviceMatchParam {
    platform?: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'chromeos';
}
export interface DevicePostureRule {
    /**
     * API UUID.
     */
    id?: string;
    /**
     * The description of the device posture rule.
     */
    description?: string;
    /**
     * Sets the expiration time for a posture check result. If empty, the result
     * remains valid until it is overwritten by new data from the WARP client.
     */
    expiration?: string;
    /**
     * The value to be checked against.
     */
    input?: DeviceInput;
    /**
     * The conditions that the client must match to run the rule.
     */
    match?: Array<DeviceMatch>;
    /**
     * The name of the device posture rule.
     */
    name?: string;
    /**
     * Polling frequency for the WARP client posture check. Default: `5m` (poll every
     * five minutes). Minimum: `1m`.
     */
    schedule?: string;
    /**
     * The type of device posture rule.
     */
    type?: 'file' | 'application' | 'tanium' | 'gateway' | 'warp' | 'disk_encryption' | 'serial_number' | 'sentinelone' | 'carbonblack' | 'firewall' | 'os_version' | 'domain_joined' | 'client_certificate' | 'client_certificate_v2' | 'unique_client_id' | 'kolide' | 'tanium_s2s' | 'crowdstrike_s2s' | 'intune' | 'workspace_one' | 'sentinelone_s2s' | 'custom_s2s';
}
export interface DiskEncryptionInput {
    /**
     * List of volume names to be checked for encryption.
     */
    checkDisks?: Array<CarbonblackInput>;
    /**
     * Whether to check all disks for encryption.
     */
    requireAll?: boolean;
}
export interface DiskEncryptionInputParam {
    /**
     * List of volume names to be checked for encryption.
     */
    checkDisks?: Array<CarbonblackInputParam>;
    /**
     * Whether to check all disks for encryption.
     */
    requireAll?: boolean;
}
export interface DomainJoinedInput {
    /**
     * Operating System.
     */
    operating_system: 'windows';
    /**
     * Domain.
     */
    domain?: string;
}
export interface DomainJoinedInputParam {
    /**
     * Operating System.
     */
    operating_system: 'windows';
    /**
     * Domain.
     */
    domain?: string;
}
export interface FileInput {
    /**
     * Operating system.
     */
    operating_system: 'windows' | 'linux' | 'mac';
    /**
     * File path.
     */
    path: string;
    /**
     * Whether or not file exists.
     */
    exists?: boolean;
    /**
     * SHA-256.
     */
    sha256?: string;
    /**
     * Signing certificate thumbprint.
     */
    thumbprint?: string;
}
export interface FileInputParam {
    /**
     * Operating system.
     */
    operating_system: 'windows' | 'linux' | 'mac';
    /**
     * File path.
     */
    path: string;
    /**
     * Whether or not file exists.
     */
    exists?: boolean;
    /**
     * SHA-256.
     */
    sha256?: string;
    /**
     * Signing certificate thumbprint.
     */
    thumbprint?: string;
}
export interface FirewallInput {
    /**
     * Enabled.
     */
    enabled: boolean;
    /**
     * Operating System.
     */
    operating_system: 'windows' | 'mac';
}
export interface FirewallInputParam {
    /**
     * Enabled.
     */
    enabled: boolean;
    /**
     * Operating System.
     */
    operating_system: 'windows' | 'mac';
}
export interface IntuneInput {
    /**
     * Compliance Status.
     */
    compliance_status: 'compliant' | 'noncompliant' | 'unknown' | 'notapplicable' | 'ingraceperiod' | 'error';
    /**
     * Posture Integration ID.
     */
    connection_id: string;
}
export interface IntuneInputParam {
    /**
     * Compliance Status.
     */
    compliance_status: 'compliant' | 'noncompliant' | 'unknown' | 'notapplicable' | 'ingraceperiod' | 'error';
    /**
     * Posture Integration ID.
     */
    connection_id: string;
}
export interface KolideInput {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * Count Operator.
     */
    countOperator: '<' | '<=' | '>' | '>=' | '==';
    /**
     * The Number of Issues.
     */
    issue_count: string;
}
export interface KolideInputParam {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * Count Operator.
     */
    countOperator: '<' | '<=' | '>' | '>=' | '==';
    /**
     * The Number of Issues.
     */
    issue_count: string;
}
export interface OSVersionInput {
    /**
     * Operating System.
     */
    operating_system: 'windows';
    /**
     * Operator.
     */
    operator: '<' | '<=' | '>' | '>=' | '==';
    /**
     * Version of OS.
     */
    version: string;
    /**
     * Operating System Distribution Name (linux only).
     */
    os_distro_name?: string;
    /**
     * Version of OS Distribution (linux only).
     */
    os_distro_revision?: string;
    /**
     * Additional version data. For Mac or iOS, the Product Version Extra. For Linux,
     * the kernel release version. (Mac, iOS, and Linux only).
     */
    os_version_extra?: string;
}
export interface OSVersionInputParam {
    /**
     * Operating System.
     */
    operating_system: 'windows';
    /**
     * Operator.
     */
    operator: '<' | '<=' | '>' | '>=' | '==';
    /**
     * Version of OS.
     */
    version: string;
    /**
     * Operating System Distribution Name (linux only).
     */
    os_distro_name?: string;
    /**
     * Version of OS Distribution (linux only).
     */
    os_distro_revision?: string;
    /**
     * Additional version data. For Mac or iOS, the Product Version Extra. For Linux,
     * the kernel release version. (Mac, iOS, and Linux only).
     */
    os_version_extra?: string;
}
export interface SentineloneInput {
    /**
     * Operating system.
     */
    operating_system: 'windows' | 'linux' | 'mac';
    /**
     * File path.
     */
    path: string;
    /**
     * SHA-256.
     */
    sha256?: string;
    /**
     * Signing certificate thumbprint.
     */
    thumbprint?: string;
}
export interface SentineloneInputParam {
    /**
     * Operating system.
     */
    operating_system: 'windows' | 'linux' | 'mac';
    /**
     * File path.
     */
    path: string;
    /**
     * SHA-256.
     */
    sha256?: string;
    /**
     * Signing certificate thumbprint.
     */
    thumbprint?: string;
}
export interface SentineloneS2sInput {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * The Number of active threats.
     */
    active_threats?: number;
    /**
     * Whether device is infected.
     */
    infected?: boolean;
    /**
     * Whether device is active.
     */
    is_active?: boolean;
    /**
     * Network status of device.
     */
    network_status?: 'connected' | 'disconnected' | 'disconnecting' | 'connecting';
    /**
     * Agent operational state.
     */
    operational_state?: 'na' | 'partially_disabled' | 'auto_fully_disabled' | 'fully_disabled' | 'auto_partially_disabled' | 'disabled_error' | 'db_corruption';
    /**
     * Operator.
     */
    operator?: '<' | '<=' | '>' | '>=' | '==';
}
export interface SentineloneS2sInputParam {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * The Number of active threats.
     */
    active_threats?: number;
    /**
     * Whether device is infected.
     */
    infected?: boolean;
    /**
     * Whether device is active.
     */
    is_active?: boolean;
    /**
     * Network status of device.
     */
    network_status?: 'connected' | 'disconnected' | 'disconnecting' | 'connecting';
    /**
     * Agent operational state.
     */
    operational_state?: 'na' | 'partially_disabled' | 'auto_fully_disabled' | 'fully_disabled' | 'auto_partially_disabled' | 'disabled_error' | 'db_corruption';
    /**
     * Operator.
     */
    operator?: '<' | '<=' | '>' | '>=' | '==';
}
export interface TaniumInput {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * For more details on eid last seen, refer to the Tanium documentation.
     */
    eid_last_seen?: string;
    /**
     * Operator to evaluate risk_level or eid_last_seen.
     */
    operator?: '<' | '<=' | '>' | '>=' | '==';
    /**
     * For more details on risk level, refer to the Tanium documentation.
     */
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    /**
     * Score Operator.
     */
    scoreOperator?: '<' | '<=' | '>' | '>=' | '==';
    /**
     * For more details on total score, refer to the Tanium documentation.
     */
    total_score?: number;
}
export interface TaniumInputParam {
    /**
     * Posture Integration ID.
     */
    connection_id: string;
    /**
     * For more details on eid last seen, refer to the Tanium documentation.
     */
    eid_last_seen?: string;
    /**
     * Operator to evaluate risk_level or eid_last_seen.
     */
    operator?: '<' | '<=' | '>' | '>=' | '==';
    /**
     * For more details on risk level, refer to the Tanium documentation.
     */
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    /**
     * Score Operator.
     */
    scoreOperator?: '<' | '<=' | '>' | '>=' | '==';
    /**
     * For more details on total score, refer to the Tanium documentation.
     */
    total_score?: number;
}
export interface UniqueClientIDInput {
    /**
     * List ID.
     */
    id: string;
    /**
     * Operating System.
     */
    operating_system: 'android' | 'ios' | 'chromeos';
}
export interface UniqueClientIDInputParam {
    /**
     * List ID.
     */
    id: string;
    /**
     * Operating System.
     */
    operating_system: 'android' | 'ios' | 'chromeos';
}
export interface WorkspaceOneInput {
    /**
     * Compliance Status.
     */
    compliance_status: 'compliant' | 'noncompliant' | 'unknown';
    /**
     * Posture Integration ID.
     */
    connection_id: string;
}
export interface WorkspaceOneInputParam {
    /**
     * Compliance Status.
     */
    compliance_status: 'compliant' | 'noncompliant' | 'unknown';
    /**
     * Posture Integration ID.
     */
    connection_id: string;
}
export interface PostureDeleteResponse {
    /**
     * API UUID.
     */
    id?: string;
}
export interface PostureCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: The name of the device posture rule.
     */
    name: string;
    /**
     * Body param: The type of device posture rule.
     */
    type: 'file' | 'application' | 'tanium' | 'gateway' | 'warp' | 'disk_encryption' | 'serial_number' | 'sentinelone' | 'carbonblack' | 'firewall' | 'os_version' | 'domain_joined' | 'client_certificate' | 'client_certificate_v2' | 'unique_client_id' | 'kolide' | 'tanium_s2s' | 'crowdstrike_s2s' | 'intune' | 'workspace_one' | 'sentinelone_s2s' | 'custom_s2s';
    /**
     * Body param: The description of the device posture rule.
     */
    description?: string;
    /**
     * Body param: Sets the expiration time for a posture check result. If empty, the
     * result remains valid until it is overwritten by new data from the WARP client.
     */
    expiration?: string;
    /**
     * Body param: The value to be checked against.
     */
    input?: DeviceInputParam;
    /**
     * Body param: The conditions that the client must match to run the rule.
     */
    match?: Array<DeviceMatchParam>;
    /**
     * Body param: Polling frequency for the WARP client posture check. Default: `5m`
     * (poll every five minutes). Minimum: `1m`.
     */
    schedule?: string;
}
export interface PostureUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: The name of the device posture rule.
     */
    name: string;
    /**
     * Body param: The type of device posture rule.
     */
    type: 'file' | 'application' | 'tanium' | 'gateway' | 'warp' | 'disk_encryption' | 'serial_number' | 'sentinelone' | 'carbonblack' | 'firewall' | 'os_version' | 'domain_joined' | 'client_certificate' | 'client_certificate_v2' | 'unique_client_id' | 'kolide' | 'tanium_s2s' | 'crowdstrike_s2s' | 'intune' | 'workspace_one' | 'sentinelone_s2s' | 'custom_s2s';
    /**
     * Body param: The description of the device posture rule.
     */
    description?: string;
    /**
     * Body param: Sets the expiration time for a posture check result. If empty, the
     * result remains valid until it is overwritten by new data from the WARP client.
     */
    expiration?: string;
    /**
     * Body param: The value to be checked against.
     */
    input?: DeviceInputParam;
    /**
     * Body param: The conditions that the client must match to run the rule.
     */
    match?: Array<DeviceMatchParam>;
    /**
     * Body param: Polling frequency for the WARP client posture check. Default: `5m`
     * (poll every five minutes). Minimum: `1m`.
     */
    schedule?: string;
}
export interface PostureListParams {
    account_id: string;
}
export interface PostureDeleteParams {
    account_id: string;
}
export interface PostureGetParams {
    account_id: string;
}
export declare namespace Posture {
    export { type CarbonblackInput as CarbonblackInput, type ClientCertificateInput as ClientCertificateInput, type CrowdstrikeInput as CrowdstrikeInput, type DeviceInput as DeviceInput, type DeviceMatch as DeviceMatch, type DevicePostureRule as DevicePostureRule, type DiskEncryptionInput as DiskEncryptionInput, type DomainJoinedInput as DomainJoinedInput, type FileInput as FileInput, type FirewallInput as FirewallInput, type IntuneInput as IntuneInput, type KolideInput as KolideInput, type OSVersionInput as OSVersionInput, type SentineloneInput as SentineloneInput, type SentineloneS2sInput as SentineloneS2sInput, type TaniumInput as TaniumInput, type UniqueClientIDInput as UniqueClientIDInput, type WorkspaceOneInput as WorkspaceOneInput, type PostureDeleteResponse as PostureDeleteResponse, DevicePostureRulesSinglePage as DevicePostureRulesSinglePage, type PostureCreateParams as PostureCreateParams, type PostureUpdateParams as PostureUpdateParams, type PostureListParams as PostureListParams, type PostureDeleteParams as PostureDeleteParams, type PostureGetParams as PostureGetParams, };
    export { Integrations as Integrations, type Integration as Integration, type IntegrationDeleteResponse as IntegrationDeleteResponse, IntegrationsSinglePage as IntegrationsSinglePage, type IntegrationCreateParams as IntegrationCreateParams, type IntegrationListParams as IntegrationListParams, type IntegrationDeleteParams as IntegrationDeleteParams, type IntegrationEditParams as IntegrationEditParams, type IntegrationGetParams as IntegrationGetParams, };
}
//# sourceMappingURL=posture.d.ts.map