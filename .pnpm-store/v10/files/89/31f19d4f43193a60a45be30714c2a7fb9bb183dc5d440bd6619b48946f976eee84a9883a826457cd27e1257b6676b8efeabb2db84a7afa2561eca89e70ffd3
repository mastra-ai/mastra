import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Integrations extends APIResource {
    /**
     * Create a new device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.create(
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       config: {
     *         api_url: 'https://as123.awmdm.com/API',
     *         auth_url:
     *           'https://na.uemauth.vmwservices.com/connect/token',
     *         client_id: 'example client id',
     *         client_secret: 'example client secret',
     *       },
     *       interval: '10m',
     *       name: 'My Workspace One Integration',
     *       type: 'workspace_one',
     *     },
     *   );
     * ```
     */
    create(params: IntegrationCreateParams, options?: Core.RequestOptions): Core.APIPromise<Integration | null>;
    /**
     * Fetches the list of device posture integrations for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const integration of client.zeroTrust.devices.posture.integrations.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: IntegrationListParams, options?: Core.RequestOptions): Core.PagePromise<IntegrationsSinglePage, Integration>;
    /**
     * Delete a configured device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(integrationId: string, params: IntegrationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<IntegrationDeleteResponse | null>;
    /**
     * Updates a configured device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(integrationId: string, params: IntegrationEditParams, options?: Core.RequestOptions): Core.APIPromise<Integration | null>;
    /**
     * Fetches details for a single device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(integrationId: string, params: IntegrationGetParams, options?: Core.RequestOptions): Core.APIPromise<Integration | null>;
}
export declare class IntegrationsSinglePage extends SinglePage<Integration> {
}
export interface Integration {
    /**
     * API UUID.
     */
    id?: string;
    /**
     * The configuration object containing third-party integration information.
     */
    config?: Integration.Config;
    /**
     * The interval between each posture check with the third-party API. Use `m` for
     * minutes (e.g. `5m`) and `h` for hours (e.g. `12h`).
     */
    interval?: string;
    /**
     * The name of the device posture integration.
     */
    name?: string;
    /**
     * The type of device posture integration.
     */
    type?: 'workspace_one' | 'crowdstrike_s2s' | 'uptycs' | 'intune' | 'kolide' | 'tanium_s2s' | 'sentinelone_s2s' | 'custom_s2s';
}
export declare namespace Integration {
    /**
     * The configuration object containing third-party integration information.
     */
    interface Config {
        /**
         * The Workspace One API URL provided in the Workspace One Admin Dashboard.
         */
        api_url: string;
        /**
         * The Workspace One Authorization URL depending on your region.
         */
        auth_url: string;
        /**
         * The Workspace One client ID provided in the Workspace One Admin Dashboard.
         */
        client_id: string;
    }
}
export type IntegrationDeleteResponse = unknown | string;
export interface IntegrationCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: The configuration object containing third-party integration
     * information.
     */
    config: IntegrationCreateParams.TeamsDevicesWorkspaceOneConfigRequest | IntegrationCreateParams.TeamsDevicesCrowdstrikeConfigRequest | IntegrationCreateParams.TeamsDevicesUptycsConfigRequest | IntegrationCreateParams.TeamsDevicesIntuneConfigRequest | IntegrationCreateParams.TeamsDevicesKolideConfigRequest | IntegrationCreateParams.TeamsDevicesTaniumConfigRequest | IntegrationCreateParams.TeamsDevicesSentineloneS2sConfigRequest | IntegrationCreateParams.TeamsDevicesCustomS2sConfigRequest;
    /**
     * Body param: The interval between each posture check with the third-party API.
     * Use `m` for minutes (e.g. `5m`) and `h` for hours (e.g. `12h`).
     */
    interval: string;
    /**
     * Body param: The name of the device posture integration.
     */
    name: string;
    /**
     * Body param: The type of device posture integration.
     */
    type: 'workspace_one' | 'crowdstrike_s2s' | 'uptycs' | 'intune' | 'kolide' | 'tanium_s2s' | 'sentinelone_s2s' | 'custom_s2s';
}
export declare namespace IntegrationCreateParams {
    interface TeamsDevicesWorkspaceOneConfigRequest {
        /**
         * The Workspace One API URL provided in the Workspace One Admin Dashboard.
         */
        api_url: string;
        /**
         * The Workspace One Authorization URL depending on your region.
         */
        auth_url: string;
        /**
         * The Workspace One client ID provided in the Workspace One Admin Dashboard.
         */
        client_id: string;
        /**
         * The Workspace One client secret provided in the Workspace One Admin Dashboard.
         */
        client_secret: string;
    }
    interface TeamsDevicesCrowdstrikeConfigRequest {
        /**
         * The Crowdstrike API URL.
         */
        api_url: string;
        /**
         * The Crowdstrike client ID.
         */
        client_id: string;
        /**
         * The Crowdstrike client secret.
         */
        client_secret: string;
        /**
         * The Crowdstrike customer ID.
         */
        customer_id: string;
    }
    interface TeamsDevicesUptycsConfigRequest {
        /**
         * The Uptycs API URL.
         */
        api_url: string;
        /**
         * The Uptycs client secret.
         */
        client_key: string;
        /**
         * The Uptycs client secret.
         */
        client_secret: string;
        /**
         * The Uptycs customer ID.
         */
        customer_id: string;
    }
    interface TeamsDevicesIntuneConfigRequest {
        /**
         * The Intune client ID.
         */
        client_id: string;
        /**
         * The Intune client secret.
         */
        client_secret: string;
        /**
         * The Intune customer ID.
         */
        customer_id: string;
    }
    interface TeamsDevicesKolideConfigRequest {
        /**
         * The Kolide client ID.
         */
        client_id: string;
        /**
         * The Kolide client secret.
         */
        client_secret: string;
    }
    interface TeamsDevicesTaniumConfigRequest {
        /**
         * The Tanium API URL.
         */
        api_url: string;
        /**
         * The Tanium client secret.
         */
        client_secret: string;
        /**
         * If present, this id will be passed in the `CF-Access-Client-ID` header when
         * hitting the `api_url`.
         */
        access_client_id?: string;
        /**
         * If present, this secret will be passed in the `CF-Access-Client-Secret` header
         * when hitting the `api_url`.
         */
        access_client_secret?: string;
    }
    interface TeamsDevicesSentineloneS2sConfigRequest {
        /**
         * The SentinelOne S2S API URL.
         */
        api_url: string;
        /**
         * The SentinelOne S2S client secret.
         */
        client_secret: string;
    }
    interface TeamsDevicesCustomS2sConfigRequest {
        /**
         * This id will be passed in the `CF-Access-Client-ID` header when hitting the
         * `api_url`.
         */
        access_client_id: string;
        /**
         * This secret will be passed in the `CF-Access-Client-Secret` header when hitting
         * the `api_url`.
         */
        access_client_secret: string;
        /**
         * The Custom Device Posture Integration API URL.
         */
        api_url: string;
    }
}
export interface IntegrationListParams {
    account_id: string;
}
export interface IntegrationDeleteParams {
    account_id: string;
}
export interface IntegrationEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: The configuration object containing third-party integration
     * information.
     */
    config?: IntegrationEditParams.TeamsDevicesWorkspaceOneConfigRequest | IntegrationEditParams.TeamsDevicesCrowdstrikeConfigRequest | IntegrationEditParams.TeamsDevicesUptycsConfigRequest | IntegrationEditParams.TeamsDevicesIntuneConfigRequest | IntegrationEditParams.TeamsDevicesKolideConfigRequest | IntegrationEditParams.TeamsDevicesTaniumConfigRequest | IntegrationEditParams.TeamsDevicesSentineloneS2sConfigRequest | IntegrationEditParams.TeamsDevicesCustomS2sConfigRequest;
    /**
     * Body param: The interval between each posture check with the third-party API.
     * Use `m` for minutes (e.g. `5m`) and `h` for hours (e.g. `12h`).
     */
    interval?: string;
    /**
     * Body param: The name of the device posture integration.
     */
    name?: string;
    /**
     * Body param: The type of device posture integration.
     */
    type?: 'workspace_one' | 'crowdstrike_s2s' | 'uptycs' | 'intune' | 'kolide' | 'tanium_s2s' | 'sentinelone_s2s' | 'custom_s2s';
}
export declare namespace IntegrationEditParams {
    interface TeamsDevicesWorkspaceOneConfigRequest {
        /**
         * The Workspace One API URL provided in the Workspace One Admin Dashboard.
         */
        api_url: string;
        /**
         * The Workspace One Authorization URL depending on your region.
         */
        auth_url: string;
        /**
         * The Workspace One client ID provided in the Workspace One Admin Dashboard.
         */
        client_id: string;
        /**
         * The Workspace One client secret provided in the Workspace One Admin Dashboard.
         */
        client_secret: string;
    }
    interface TeamsDevicesCrowdstrikeConfigRequest {
        /**
         * The Crowdstrike API URL.
         */
        api_url: string;
        /**
         * The Crowdstrike client ID.
         */
        client_id: string;
        /**
         * The Crowdstrike client secret.
         */
        client_secret: string;
        /**
         * The Crowdstrike customer ID.
         */
        customer_id: string;
    }
    interface TeamsDevicesUptycsConfigRequest {
        /**
         * The Uptycs API URL.
         */
        api_url: string;
        /**
         * The Uptycs client secret.
         */
        client_key: string;
        /**
         * The Uptycs client secret.
         */
        client_secret: string;
        /**
         * The Uptycs customer ID.
         */
        customer_id: string;
    }
    interface TeamsDevicesIntuneConfigRequest {
        /**
         * The Intune client ID.
         */
        client_id: string;
        /**
         * The Intune client secret.
         */
        client_secret: string;
        /**
         * The Intune customer ID.
         */
        customer_id: string;
    }
    interface TeamsDevicesKolideConfigRequest {
        /**
         * The Kolide client ID.
         */
        client_id: string;
        /**
         * The Kolide client secret.
         */
        client_secret: string;
    }
    interface TeamsDevicesTaniumConfigRequest {
        /**
         * The Tanium API URL.
         */
        api_url: string;
        /**
         * The Tanium client secret.
         */
        client_secret: string;
        /**
         * If present, this id will be passed in the `CF-Access-Client-ID` header when
         * hitting the `api_url`.
         */
        access_client_id?: string;
        /**
         * If present, this secret will be passed in the `CF-Access-Client-Secret` header
         * when hitting the `api_url`.
         */
        access_client_secret?: string;
    }
    interface TeamsDevicesSentineloneS2sConfigRequest {
        /**
         * The SentinelOne S2S API URL.
         */
        api_url: string;
        /**
         * The SentinelOne S2S client secret.
         */
        client_secret: string;
    }
    interface TeamsDevicesCustomS2sConfigRequest {
        /**
         * This id will be passed in the `CF-Access-Client-ID` header when hitting the
         * `api_url`.
         */
        access_client_id: string;
        /**
         * This secret will be passed in the `CF-Access-Client-Secret` header when hitting
         * the `api_url`.
         */
        access_client_secret: string;
        /**
         * The Custom Device Posture Integration API URL.
         */
        api_url: string;
    }
}
export interface IntegrationGetParams {
    account_id: string;
}
export declare namespace Integrations {
    export { type Integration as Integration, type IntegrationDeleteResponse as IntegrationDeleteResponse, IntegrationsSinglePage as IntegrationsSinglePage, type IntegrationCreateParams as IntegrationCreateParams, type IntegrationListParams as IntegrationListParams, type IntegrationDeleteParams as IntegrationDeleteParams, type IntegrationEditParams as IntegrationEditParams, type IntegrationGetParams as IntegrationGetParams, };
}
//# sourceMappingURL=integrations.d.ts.map