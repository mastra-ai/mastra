import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../../pagination.js";
export declare class Targets extends APIResource {
    /**
     * Create new target
     *
     * @example
     * ```ts
     * const target =
     *   await client.zeroTrust.access.infrastructure.targets.create(
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       hostname: 'infra-access-target',
     *       ip: {},
     *     },
     *   );
     * ```
     */
    create(params: TargetCreateParams, options?: Core.RequestOptions): Core.APIPromise<TargetCreateResponse>;
    /**
     * Update target
     *
     * @example
     * ```ts
     * const target =
     *   await client.zeroTrust.access.infrastructure.targets.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       hostname: 'infra-access-target',
     *       ip: {},
     *     },
     *   );
     * ```
     */
    update(targetId: string, params: TargetUpdateParams, options?: Core.RequestOptions): Core.APIPromise<TargetUpdateResponse>;
    /**
     * Lists and sorts an account’s targets. Filters are optional and are ANDed
     * together.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const targetListResponse of client.zeroTrust.access.infrastructure.targets.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: TargetListParams, options?: Core.RequestOptions): Core.PagePromise<TargetListResponsesV4PagePaginationArray, TargetListResponse>;
    /**
     * Delete target
     *
     * @example
     * ```ts
     * await client.zeroTrust.access.infrastructure.targets.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(targetId: string, params: TargetDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void>;
    /**
     * Removes one or more targets.
     *
     * @deprecated
     */
    bulkDelete(params: TargetBulkDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void>;
    /**
     * Removes one or more targets.
     *
     * @example
     * ```ts
     * await client.zeroTrust.access.infrastructure.targets.bulkDeleteV2(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     target_ids: ['182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'],
     *   },
     * );
     * ```
     */
    bulkDeleteV2(params: TargetBulkDeleteV2Params, options?: Core.RequestOptions): Core.APIPromise<void>;
    /**
     * Adds one or more targets.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const targetBulkUpdateResponse of client.zeroTrust.access.infrastructure.targets.bulkUpdate(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ hostname: 'infra-access-target', ip: {} }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkUpdate(params: TargetBulkUpdateParams, options?: Core.RequestOptions): Core.PagePromise<TargetBulkUpdateResponsesSinglePage, TargetBulkUpdateResponse>;
    /**
     * Get target
     *
     * @example
     * ```ts
     * const target =
     *   await client.zeroTrust.access.infrastructure.targets.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(targetId: string, params: TargetGetParams, options?: Core.RequestOptions): Core.APIPromise<TargetGetResponse>;
}
export declare class TargetListResponsesV4PagePaginationArray extends V4PagePaginationArray<TargetListResponse> {
}
export declare class TargetBulkUpdateResponsesSinglePage extends SinglePage<TargetBulkUpdateResponse> {
}
export interface TargetCreateResponse {
    /**
     * Target identifier
     */
    id: string;
    /**
     * Date and time at which the target was created
     */
    created_at: string;
    /**
     * A non-unique field that refers to a target
     */
    hostname: string;
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetCreateResponse.IP;
    /**
     * Date and time at which the target was modified
     */
    modified_at: string;
}
export declare namespace TargetCreateResponse {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetUpdateResponse {
    /**
     * Target identifier
     */
    id: string;
    /**
     * Date and time at which the target was created
     */
    created_at: string;
    /**
     * A non-unique field that refers to a target
     */
    hostname: string;
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetUpdateResponse.IP;
    /**
     * Date and time at which the target was modified
     */
    modified_at: string;
}
export declare namespace TargetUpdateResponse {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetListResponse {
    /**
     * Target identifier
     */
    id: string;
    /**
     * Date and time at which the target was created
     */
    created_at: string;
    /**
     * A non-unique field that refers to a target
     */
    hostname: string;
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetListResponse.IP;
    /**
     * Date and time at which the target was modified
     */
    modified_at: string;
}
export declare namespace TargetListResponse {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetBulkUpdateResponse {
    /**
     * Target identifier
     */
    id: string;
    /**
     * Date and time at which the target was created
     */
    created_at: string;
    /**
     * A non-unique field that refers to a target
     */
    hostname: string;
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetBulkUpdateResponse.IP;
    /**
     * Date and time at which the target was modified
     */
    modified_at: string;
}
export declare namespace TargetBulkUpdateResponse {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetGetResponse {
    /**
     * Target identifier
     */
    id: string;
    /**
     * Date and time at which the target was created
     */
    created_at: string;
    /**
     * A non-unique field that refers to a target
     */
    hostname: string;
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetGetResponse.IP;
    /**
     * Date and time at which the target was modified
     */
    modified_at: string;
}
export declare namespace TargetGetResponse {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetCreateParams {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Body param: A non-unique field that refers to a target. Case insensitive,
     * maximum length of 255 characters, supports the use of special characters dash
     * and period, does not support spaces, and must start and end with an alphanumeric
     * character.
     */
    hostname: string;
    /**
     * Body param: The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetCreateParams.IP;
}
export declare namespace TargetCreateParams {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetUpdateParams {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Body param: A non-unique field that refers to a target. Case insensitive,
     * maximum length of 255 characters, supports the use of special characters dash
     * and period, does not support spaces, and must start and end with an alphanumeric
     * character.
     */
    hostname: string;
    /**
     * Body param: The IPv4/IPv6 address that identifies where to reach a target
     */
    ip: TargetUpdateParams.IP;
}
export declare namespace TargetUpdateParams {
    /**
     * The IPv4/IPv6 address that identifies where to reach a target
     */
    interface IP {
        /**
         * The target's IPv4 address
         */
        ipv4?: IP.IPV4;
        /**
         * The target's IPv6 address
         */
        ipv6?: IP.IPV6;
    }
    namespace IP {
        /**
         * The target's IPv4 address
         */
        interface IPV4 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
        /**
         * The target's IPv6 address
         */
        interface IPV6 {
            /**
             * IP address of the target
             */
            ip_addr?: string;
            /**
             * (optional) Private virtual network identifier for the target. If omitted, the
             * default virtual network ID will be used.
             */
            virtual_network_id?: string;
        }
    }
}
export interface TargetListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Query param: Date and time at which the target was created after (inclusive)
     */
    created_after?: string | null;
    /**
     * Query param: Date and time at which the target was created before (inclusive)
     */
    created_before?: string | null;
    /**
     * Query param: The sorting direction.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Hostname of a target
     */
    hostname?: string | null;
    /**
     * Query param: Partial match to the hostname of a target
     */
    hostname_contains?: string | null;
    /**
     * Query param: Filters for targets whose IP addresses look like the specified
     * string. Supports `*` as a wildcard character
     */
    ip_like?: string | null;
    /**
     * Query param: IPv4 address of the target
     */
    ip_v4?: string | null;
    /**
     * Query param: IPv6 address of the target
     */
    ip_v6?: string | null;
    /**
     * Query param: Filters for targets that have any of the following IP addresses.
     * Specify `ips` multiple times in query parameter to build list of candidates.
     */
    ips?: Array<string>;
    /**
     * Query param: Defines an IPv4 filter range's ending value (inclusive). Requires
     * `ipv4_start` to be specified as well.
     */
    ipv4_end?: string | null;
    /**
     * Query param: Defines an IPv4 filter range's starting value (inclusive). Requires
     * `ipv4_end` to be specified as well.
     */
    ipv4_start?: string | null;
    /**
     * Query param: Defines an IPv6 filter range's ending value (inclusive). Requires
     * `ipv6_start` to be specified as well.
     */
    ipv6_end?: string | null;
    /**
     * Query param: Defines an IPv6 filter range's starting value (inclusive). Requires
     * `ipv6_end` to be specified as well.
     */
    ipv6_start?: string | null;
    /**
     * Query param: Date and time at which the target was modified after (inclusive)
     */
    modified_after?: string | null;
    /**
     * Query param: Date and time at which the target was modified before (inclusive)
     */
    modified_before?: string | null;
    /**
     * Query param: The field to sort by.
     */
    order?: 'hostname' | 'created_at';
    /**
     * Query param: Filters for targets that have any of the following UUIDs. Specify
     * `target_ids` multiple times in query parameter to build list of candidates.
     */
    target_ids?: Array<string>;
    /**
     * Query param: Private virtual network identifier of the target
     */
    virtual_network_id?: string | null;
}
export interface TargetDeleteParams {
    /**
     * Account identifier
     */
    account_id: string;
}
export interface TargetBulkDeleteParams {
    /**
     * Account identifier
     */
    account_id: string;
}
export interface TargetBulkDeleteV2Params {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Body param: List of target IDs to bulk delete
     */
    target_ids: Array<string>;
}
export interface TargetBulkUpdateParams {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<TargetBulkUpdateParams.Body>;
}
export declare namespace TargetBulkUpdateParams {
    interface Body {
        /**
         * A non-unique field that refers to a target. Case insensitive, maximum length of
         * 255 characters, supports the use of special characters dash and period, does not
         * support spaces, and must start and end with an alphanumeric character.
         */
        hostname: string;
        /**
         * The IPv4/IPv6 address that identifies where to reach a target
         */
        ip: Body.IP;
    }
    namespace Body {
        /**
         * The IPv4/IPv6 address that identifies where to reach a target
         */
        interface IP {
            /**
             * The target's IPv4 address
             */
            ipv4?: IP.IPV4;
            /**
             * The target's IPv6 address
             */
            ipv6?: IP.IPV6;
        }
        namespace IP {
            /**
             * The target's IPv4 address
             */
            interface IPV4 {
                /**
                 * IP address of the target
                 */
                ip_addr?: string;
                /**
                 * (optional) Private virtual network identifier for the target. If omitted, the
                 * default virtual network ID will be used.
                 */
                virtual_network_id?: string;
            }
            /**
             * The target's IPv6 address
             */
            interface IPV6 {
                /**
                 * IP address of the target
                 */
                ip_addr?: string;
                /**
                 * (optional) Private virtual network identifier for the target. If omitted, the
                 * default virtual network ID will be used.
                 */
                virtual_network_id?: string;
            }
        }
    }
}
export interface TargetGetParams {
    /**
     * Account identifier
     */
    account_id: string;
}
export declare namespace Targets {
    export { type TargetCreateResponse as TargetCreateResponse, type TargetUpdateResponse as TargetUpdateResponse, type TargetListResponse as TargetListResponse, type TargetBulkUpdateResponse as TargetBulkUpdateResponse, type TargetGetResponse as TargetGetResponse, TargetListResponsesV4PagePaginationArray as TargetListResponsesV4PagePaginationArray, TargetBulkUpdateResponsesSinglePage as TargetBulkUpdateResponsesSinglePage, type TargetCreateParams as TargetCreateParams, type TargetUpdateParams as TargetUpdateParams, type TargetListParams as TargetListParams, type TargetDeleteParams as TargetDeleteParams, type TargetBulkDeleteParams as TargetBulkDeleteParams, type TargetBulkDeleteV2Params as TargetBulkDeleteV2Params, type TargetBulkUpdateParams as TargetBulkUpdateParams, type TargetGetParams as TargetGetParams, };
}
//# sourceMappingURL=targets.d.ts.map