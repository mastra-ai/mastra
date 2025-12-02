import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as DevicesDevicesAPI from "./devices_.js";
import { DeviceDeleteParams, DeviceDeleteResponse, DeviceListResponse, DeviceListResponsesCursorPagination, DeviceRevokeParams, DeviceRevokeResponse, Devices as DevicesAPIDevices } from "./devices_.js";
import * as DEXTestsAPI from "./dex-tests.js";
import { DEXTestCreateParams, DEXTestCreateResponse, DEXTestDeleteParams, DEXTestDeleteResponse, DEXTestGetParams, DEXTestGetResponse, DEXTestListParams, DEXTestListResponse, DEXTestListResponsesSinglePage, DEXTestUpdateParams, DEXTestUpdateResponse, DEXTests, SchemaData, SchemaHTTP } from "./dex-tests.js";
import * as FleetStatusAPI from "./fleet-status.js";
import { FleetStatus, FleetStatusGetParams, FleetStatusGetResponse } from "./fleet-status.js";
import * as NetworksAPI from "./networks.js";
import { DeviceNetwork, DeviceNetworksSinglePage, NetworkCreateParams, NetworkDeleteParams, NetworkGetParams, NetworkListParams, NetworkUpdateParams, Networks } from "./networks.js";
import * as OverrideCodesAPI from "./override-codes.js";
import { OverrideCodeGetParams, OverrideCodeGetResponse, OverrideCodeListParams, OverrideCodeListResponse, OverrideCodeListResponsesSinglePage, OverrideCodes } from "./override-codes.js";
import * as RegistrationsAPI from "./registrations.js";
import { RegistrationBulkDeleteParams, RegistrationBulkDeleteResponse, RegistrationDeleteParams, RegistrationDeleteResponse, RegistrationGetParams, RegistrationGetResponse, RegistrationListParams, RegistrationListResponse, RegistrationListResponsesCursorPagination, RegistrationRevokeParams, RegistrationRevokeResponse, RegistrationUnrevokeParams, RegistrationUnrevokeResponse, Registrations } from "./registrations.js";
import * as RevokeAPI from "./revoke.js";
import { Revoke, RevokeCreateParams, RevokeCreateResponse } from "./revoke.js";
import * as SettingsAPI from "./settings.js";
import { DeviceSettings, SettingDeleteParams, SettingEditParams, SettingGetParams, SettingUpdateParams, Settings } from "./settings.js";
import * as UnrevokeAPI from "./unrevoke.js";
import { Unrevoke, UnrevokeCreateParams, UnrevokeCreateResponse } from "./unrevoke.js";
import * as PoliciesAPI from "./policies/policies.js";
import { DevicePolicyCertificates, FallbackDomain, FallbackDomainPolicy, Policies, SettingsPolicy, SplitTunnelExclude, SplitTunnelInclude } from "./policies/policies.js";
import * as PostureAPI from "./posture/posture.js";
import { CarbonblackInput, ClientCertificateInput, CrowdstrikeInput, DeviceInput, DeviceMatch, DevicePostureRule, DevicePostureRulesSinglePage, DiskEncryptionInput, DomainJoinedInput, FileInput, FirewallInput, IntuneInput, KolideInput, OSVersionInput, Posture, PostureCreateParams, PostureDeleteParams, PostureDeleteResponse, PostureGetParams, PostureListParams, PostureUpdateParams, SentineloneInput, SentineloneS2sInput, TaniumInput, UniqueClientIDInput, WorkspaceOneInput } from "./posture/posture.js";
import * as ResilienceAPI from "./resilience/resilience.js";
import { Resilience } from "./resilience/resilience.js";
import { SinglePage } from "../../../pagination.js";
export declare class Devices extends APIResource {
    devices: DevicesDevicesAPI.Devices;
    resilience: ResilienceAPI.Resilience;
    registrations: RegistrationsAPI.Registrations;
    dexTests: DEXTestsAPI.DEXTests;
    networks: NetworksAPI.Networks;
    fleetStatus: FleetStatusAPI.FleetStatus;
    policies: PoliciesAPI.Policies;
    posture: PostureAPI.Posture;
    revoke: RevokeAPI.Revoke;
    settings: SettingsAPI.Settings;
    unrevoke: UnrevokeAPI.Unrevoke;
    overrideCodes: OverrideCodesAPI.OverrideCodes;
    /**
     * List WARP devices. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled for the account.
     *
     * **Deprecated**: please use one of the following endpoints instead:
     *
     * - GET /accounts/{account_id}/devices/physical-devices
     * - GET /accounts/{account_id}/devices/registrations
     *
     * @deprecated
     */
    list(params: DeviceListParams, options?: Core.RequestOptions): Core.PagePromise<DevicesSinglePage, Device>;
    /**
     * Fetches a single WARP device. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled for the account.
     *
     * **Deprecated**: please use one of the following endpoints instead:
     *
     * - GET /accounts/{account_id}/devices/physical-devices/{device_id}
     * - GET /accounts/{account_id}/devices/registrations/{registration_id}
     *
     * @deprecated
     */
    get(deviceId: string, params: DeviceGetParams, options?: Core.RequestOptions): Core.APIPromise<DeviceGetResponse | null>;
}
export declare class DevicesSinglePage extends SinglePage<Device> {
}
export interface Device {
    /**
     * Registration ID. Equal to Device ID except for accounts which enabled
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/).
     */
    id?: string;
    /**
     * When the device was created.
     */
    created?: string;
    /**
     * True if the device was deleted.
     */
    deleted?: boolean;
    device_type?: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'chromeos';
    /**
     * IPv4 or IPv6 address.
     */
    ip?: string;
    /**
     * The device's public key.
     */
    key?: string;
    /**
     * When the device last connected to Cloudflare services.
     */
    last_seen?: string;
    /**
     * The device mac address.
     */
    mac_address?: string;
    /**
     * The device manufacturer name.
     */
    manufacturer?: string;
    /**
     * The device model name.
     */
    model?: string;
    /**
     * The device name.
     */
    name?: string;
    /**
     * The Linux distro name.
     */
    os_distro_name?: string;
    /**
     * The Linux distro revision.
     */
    os_distro_revision?: string;
    /**
     * The operating system version.
     */
    os_version?: string;
    /**
     * The operating system version extra parameter.
     */
    os_version_extra?: string;
    /**
     * When the device was revoked.
     */
    revoked_at?: string;
    /**
     * The device serial number.
     */
    serial_number?: string;
    /**
     * When the device was updated.
     */
    updated?: string;
    user?: Device.User;
    /**
     * The WARP client version.
     */
    version?: string;
}
export declare namespace Device {
    interface User {
        /**
         * UUID.
         */
        id?: string;
        /**
         * The contact email address of the user.
         */
        email?: string;
        /**
         * The enrolled device user's name.
         */
        name?: string;
    }
}
export interface DeviceGetResponse {
    /**
     * Registration ID. Equal to Device ID except for accounts which enabled
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/).
     */
    id?: string;
    account?: DeviceGetResponse.Account;
    /**
     * When the device was created.
     */
    created?: string;
    /**
     * True if the device was deleted.
     */
    deleted?: boolean;
    device_type?: string;
    /**
     * @deprecated
     */
    gateway_device_id?: string;
    /**
     * IPv4 or IPv6 address.
     */
    ip?: string;
    /**
     * The device's public key.
     */
    key?: string;
    /**
     * Type of the key.
     */
    key_type?: string;
    /**
     * When the device last connected to Cloudflare services.
     */
    last_seen?: string;
    /**
     * The device mac address.
     */
    mac_address?: string;
    /**
     * The device model name.
     */
    model?: string;
    /**
     * The device name.
     */
    name?: string;
    /**
     * The operating system version.
     */
    os_version?: string;
    /**
     * The device serial number.
     */
    serial_number?: string;
    /**
     * Type of the tunnel connection used.
     */
    tunnel_type?: string;
    /**
     * When the device was updated.
     */
    updated?: string;
    user?: DeviceGetResponse.User;
    /**
     * The WARP client version.
     */
    version?: string;
}
export declare namespace DeviceGetResponse {
    interface Account {
        /**
         * @deprecated
         */
        id?: string;
        /**
         * @deprecated
         */
        account_type?: string;
        /**
         * The name of the enrolled account.
         */
        name?: string;
    }
    interface User {
        /**
         * UUID.
         */
        id?: string;
        /**
         * The contact email address of the user.
         */
        email?: string;
        /**
         * The enrolled device user's name.
         */
        name?: string;
    }
}
export interface DeviceListParams {
    account_id: string;
}
export interface DeviceGetParams {
    account_id: string;
}
export declare namespace Devices {
    export { type Device as Device, type DeviceGetResponse as DeviceGetResponse, DevicesSinglePage as DevicesSinglePage, type DeviceListParams as DeviceListParams, type DeviceGetParams as DeviceGetParams, };
    export { DevicesAPIDevices as Devices, type DeviceListResponse as DeviceListResponse, type DeviceDeleteResponse as DeviceDeleteResponse, type DeviceRevokeResponse as DeviceRevokeResponse, DeviceListResponsesCursorPagination as DeviceListResponsesCursorPagination, type DeviceDeleteParams as DeviceDeleteParams, type DeviceRevokeParams as DeviceRevokeParams, };
    export { Resilience as Resilience };
    export { Registrations as Registrations, type RegistrationListResponse as RegistrationListResponse, type RegistrationDeleteResponse as RegistrationDeleteResponse, type RegistrationBulkDeleteResponse as RegistrationBulkDeleteResponse, type RegistrationGetResponse as RegistrationGetResponse, type RegistrationRevokeResponse as RegistrationRevokeResponse, type RegistrationUnrevokeResponse as RegistrationUnrevokeResponse, RegistrationListResponsesCursorPagination as RegistrationListResponsesCursorPagination, type RegistrationListParams as RegistrationListParams, type RegistrationDeleteParams as RegistrationDeleteParams, type RegistrationBulkDeleteParams as RegistrationBulkDeleteParams, type RegistrationGetParams as RegistrationGetParams, type RegistrationRevokeParams as RegistrationRevokeParams, type RegistrationUnrevokeParams as RegistrationUnrevokeParams, };
    export { DEXTests as DEXTests, type SchemaData as SchemaData, type SchemaHTTP as SchemaHTTP, type DEXTestCreateResponse as DEXTestCreateResponse, type DEXTestUpdateResponse as DEXTestUpdateResponse, type DEXTestListResponse as DEXTestListResponse, type DEXTestDeleteResponse as DEXTestDeleteResponse, type DEXTestGetResponse as DEXTestGetResponse, DEXTestListResponsesSinglePage as DEXTestListResponsesSinglePage, type DEXTestCreateParams as DEXTestCreateParams, type DEXTestUpdateParams as DEXTestUpdateParams, type DEXTestListParams as DEXTestListParams, type DEXTestDeleteParams as DEXTestDeleteParams, type DEXTestGetParams as DEXTestGetParams, };
    export { Networks as Networks, type DeviceNetwork as DeviceNetwork, DeviceNetworksSinglePage as DeviceNetworksSinglePage, type NetworkCreateParams as NetworkCreateParams, type NetworkUpdateParams as NetworkUpdateParams, type NetworkListParams as NetworkListParams, type NetworkDeleteParams as NetworkDeleteParams, type NetworkGetParams as NetworkGetParams, };
    export { FleetStatus as FleetStatus, type FleetStatusGetResponse as FleetStatusGetResponse, type FleetStatusGetParams as FleetStatusGetParams, };
    export { Policies as Policies, type DevicePolicyCertificates as DevicePolicyCertificates, type FallbackDomain as FallbackDomain, type FallbackDomainPolicy as FallbackDomainPolicy, type SettingsPolicy as SettingsPolicy, type SplitTunnelExclude as SplitTunnelExclude, type SplitTunnelInclude as SplitTunnelInclude, };
    export { Posture as Posture, type CarbonblackInput as CarbonblackInput, type ClientCertificateInput as ClientCertificateInput, type CrowdstrikeInput as CrowdstrikeInput, type DeviceInput as DeviceInput, type DeviceMatch as DeviceMatch, type DevicePostureRule as DevicePostureRule, type DiskEncryptionInput as DiskEncryptionInput, type DomainJoinedInput as DomainJoinedInput, type FileInput as FileInput, type FirewallInput as FirewallInput, type IntuneInput as IntuneInput, type KolideInput as KolideInput, type OSVersionInput as OSVersionInput, type SentineloneInput as SentineloneInput, type SentineloneS2sInput as SentineloneS2sInput, type TaniumInput as TaniumInput, type UniqueClientIDInput as UniqueClientIDInput, type WorkspaceOneInput as WorkspaceOneInput, type PostureDeleteResponse as PostureDeleteResponse, DevicePostureRulesSinglePage as DevicePostureRulesSinglePage, type PostureCreateParams as PostureCreateParams, type PostureUpdateParams as PostureUpdateParams, type PostureListParams as PostureListParams, type PostureDeleteParams as PostureDeleteParams, type PostureGetParams as PostureGetParams, };
    export { Revoke as Revoke, type RevokeCreateResponse as RevokeCreateResponse, type RevokeCreateParams as RevokeCreateParams, };
    export { Settings as Settings, type DeviceSettings as DeviceSettings, type SettingUpdateParams as SettingUpdateParams, type SettingDeleteParams as SettingDeleteParams, type SettingEditParams as SettingEditParams, type SettingGetParams as SettingGetParams, };
    export { Unrevoke as Unrevoke, type UnrevokeCreateResponse as UnrevokeCreateResponse, type UnrevokeCreateParams as UnrevokeCreateParams, };
    export { OverrideCodes as OverrideCodes, type OverrideCodeListResponse as OverrideCodeListResponse, type OverrideCodeGetResponse as OverrideCodeGetResponse, OverrideCodeListResponsesSinglePage as OverrideCodeListResponsesSinglePage, type OverrideCodeListParams as OverrideCodeListParams, type OverrideCodeGetParams as OverrideCodeGetParams, };
}
//# sourceMappingURL=devices.d.ts.map