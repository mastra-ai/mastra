import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class WARPChangeEvents extends APIResource {
    /**
     * List WARP configuration and enablement toggle change events by device.
     *
     * @example
     * ```ts
     * const warpChangeEvents =
     *   await client.zeroTrust.dex.warpChangeEvents.get({
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     from: '2023-09-20T17:00:00Z',
     *     page: 1,
     *     per_page: 1,
     *     to: '2023-09-20T17:00:00Z',
     *   });
     * ```
     */
    get(params: WARPChangeEventGetParams, options?: Core.RequestOptions): Core.APIPromise<WARPChangeEventGetResponse>;
}
export type WARPChangeEventGetResponse = Array<WARPChangeEventGetResponse.DigitalExperienceMonitoringWARPToggleChangeEvent | WARPChangeEventGetResponse.DigitalExperienceMonitoringWARPConfigChangeEvent>;
export declare namespace WARPChangeEventGetResponse {
    interface DigitalExperienceMonitoringWARPToggleChangeEvent {
        /**
         * The account name.
         */
        account_name?: string;
        /**
         * The public account identifier.
         */
        account_tag?: string;
        /**
         * API Resource UUID tag.
         */
        device_id?: string;
        /**
         * API Resource UUID tag.
         */
        device_registration?: string;
        /**
         * The hostname of the machine the event is from
         */
        hostname?: string;
        /**
         * The serial number of the machine the event is from
         */
        serial_number?: string;
        /**
         * Timestamp in ISO format
         */
        timestamp?: string;
        /**
         * The state of the WARP toggle.
         */
        toggle?: 'on' | 'off';
        /**
         * Email tied to the device
         */
        user_email?: string;
    }
    interface DigitalExperienceMonitoringWARPConfigChangeEvent {
        /**
         * API Resource UUID tag.
         */
        device_id?: string;
        /**
         * API Resource UUID tag.
         */
        device_registration?: string;
        from?: DigitalExperienceMonitoringWARPConfigChangeEvent.From;
        /**
         * The hostname of the machine the event is from
         */
        hostname?: string;
        /**
         * The serial number of the machine the event is from
         */
        serial_number?: string;
        /**
         * Timestamp in ISO format
         */
        timestamp?: string;
        to?: DigitalExperienceMonitoringWARPConfigChangeEvent.To;
        /**
         * Email tied to the device
         */
        user_email?: string;
    }
    namespace DigitalExperienceMonitoringWARPConfigChangeEvent {
        interface From {
            /**
             * The account name.
             */
            account_name?: string;
            /**
             * API Resource UUID tag.
             */
            account_tag?: string;
            /**
             * The name of the WARP configuration.
             */
            config_name?: string;
        }
        interface To {
            /**
             * The account name.
             */
            account_name?: string;
            /**
             * API Resource UUID tag.
             */
            account_tag?: string;
            /**
             * The name of the WARP configuration.
             */
            config_name?: string;
        }
    }
}
export interface WARPChangeEventGetParams {
    /**
     * Path param: unique identifier linked to an account in the API request path
     */
    account_id: string;
    /**
     * Query param: Start time for the query in ISO (RFC3339 - ISO 8601) format
     */
    from: string;
    /**
     * Query param: Page number of paginated results
     */
    page: number;
    /**
     * Query param: Number of items per page
     */
    per_page: number;
    /**
     * Query param: End time for the query in ISO (RFC3339 - ISO 8601) format
     */
    to: string;
    /**
     * Query param: Filter events by account name.
     */
    account_name?: string;
    /**
     * Query param: Filter events by WARP configuration name changed from or to.
     * Applicable to type='config' events only.
     */
    config_name?: string;
    /**
     * Query param: Sort response by event timestamp.
     */
    sort_order?: 'ASC' | 'DESC';
    /**
     * Query param: Filter events by type toggle value. Applicable to type='toggle'
     * events only.
     */
    toggle?: 'on' | 'off';
    /**
     * Query param: Filter events by type 'config' or 'toggle'
     */
    type?: 'config' | 'toggle';
}
export declare namespace WARPChangeEvents {
    export { type WARPChangeEventGetResponse as WARPChangeEventGetResponse, type WARPChangeEventGetParams as WARPChangeEventGetParams, };
}
//# sourceMappingURL=warp-change-events.d.ts.map