import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Zones extends APIResource {
    /**
     * Add a zone as a member of a particular address map.
     *
     * @example
     * ```ts
     * const zone =
     *   await client.addressing.addressMaps.zones.update(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     {
     *       zone_id: '8ac8489932db6327334c9b6d58544cfe',
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *       body: {},
     *     },
     *   );
     * ```
     */
    update(addressMapId: string, params: ZoneUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ZoneUpdateResponse>;
    /**
     * Remove a zone as a member of a particular address map.
     *
     * @example
     * ```ts
     * const zone =
     *   await client.addressing.addressMaps.zones.delete(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     {
     *       zone_id: '8ac8489932db6327334c9b6d58544cfe',
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *     },
     *   );
     * ```
     */
    delete(addressMapId: string, params: ZoneDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ZoneDeleteResponse>;
}
export interface ZoneUpdateResponse {
    errors: Array<ZoneUpdateResponse.Error>;
    messages: Array<ZoneUpdateResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
    result_info?: ZoneUpdateResponse.ResultInfo;
}
export declare namespace ZoneUpdateResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
    interface ResultInfo {
        /**
         * Total number of results for the requested service.
         */
        count?: number;
        /**
         * Current page within paginated list of results.
         */
        page?: number;
        /**
         * Number of results per page of results.
         */
        per_page?: number;
        /**
         * Total results available without any search parameters.
         */
        total_count?: number;
    }
}
export interface ZoneDeleteResponse {
    errors: Array<ZoneDeleteResponse.Error>;
    messages: Array<ZoneDeleteResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
    result_info?: ZoneDeleteResponse.ResultInfo;
}
export declare namespace ZoneDeleteResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
    interface ResultInfo {
        /**
         * Total number of results for the requested service.
         */
        count?: number;
        /**
         * Current page within paginated list of results.
         */
        page?: number;
        /**
         * Number of results per page of results.
         */
        per_page?: number;
        /**
         * Total results available without any search parameters.
         */
        total_count?: number;
    }
}
export interface ZoneUpdateParams {
    /**
     * Path param: Identifier of a zone.
     */
    zone_id: string;
    /**
     * Path param: Identifier of a Cloudflare account.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface ZoneDeleteParams {
    /**
     * Identifier of a zone.
     */
    zone_id: string;
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export declare namespace Zones {
    export { type ZoneUpdateResponse as ZoneUpdateResponse, type ZoneDeleteResponse as ZoneDeleteResponse, type ZoneUpdateParams as ZoneUpdateParams, type ZoneDeleteParams as ZoneDeleteParams, };
}
//# sourceMappingURL=zones.d.ts.map