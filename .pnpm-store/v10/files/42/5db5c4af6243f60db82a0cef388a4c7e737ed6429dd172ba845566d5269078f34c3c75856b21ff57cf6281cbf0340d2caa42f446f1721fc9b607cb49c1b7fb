import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ViewsAPI from "./views.js";
import { ViewCreateParams, ViewCreateResponse, ViewDeleteParams, ViewDeleteResponse, ViewEditParams, ViewEditResponse, ViewGetParams, ViewGetResponse, ViewListParams, ViewListResponse, ViewListResponsesV4PagePaginationArray, Views } from "./views.js";
export declare class Account extends APIResource {
    views: ViewsAPI.Views;
    /**
     * Update DNS settings for an account
     *
     * @example
     * ```ts
     * const response = await client.dns.settings.account.edit({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params: AccountEditParams, options?: Core.RequestOptions): Core.APIPromise<AccountEditResponse>;
    /**
     * Show DNS settings for an account
     *
     * @example
     * ```ts
     * const account = await client.dns.settings.account.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: AccountGetParams, options?: Core.RequestOptions): Core.APIPromise<AccountGetResponse>;
}
export interface AccountEditResponse {
    zone_defaults?: AccountEditResponse.ZoneDefaults;
}
export declare namespace AccountEditResponse {
    interface ZoneDefaults {
        /**
         * Whether to flatten all CNAME records in the zone. Note that, due to DNS
         * limitations, a CNAME record at the zone apex will always be flattened.
         */
        flatten_all_cnames?: boolean;
        /**
         * Whether to enable Foundation DNS Advanced Nameservers on the zone.
         */
        foundation_dns?: boolean;
        /**
         * Settings for this internal zone.
         */
        internal_dns?: ZoneDefaults.InternalDNS;
        /**
         * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
         * zone even when non-Cloudflare NS records exist, and to respect NS records at the
         * zone apex during outbound zone transfers.
         */
        multi_provider?: boolean;
        /**
         * Settings determining the nameservers through which the zone should be available.
         */
        nameservers?: ZoneDefaults.Nameservers;
        /**
         * The time to live (TTL) of the zone's nameserver (NS) records.
         */
        ns_ttl?: number;
        /**
         * Allows a Secondary DNS zone to use (proxied) override records and CNAME
         * flattening at the zone apex.
         */
        secondary_overrides?: boolean;
        /**
         * Components of the zone's SOA record.
         */
        soa?: ZoneDefaults.SOA;
        /**
         * Whether the zone mode is a regular or CDN/DNS only zone.
         */
        zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
    }
    namespace ZoneDefaults {
        /**
         * Settings for this internal zone.
         */
        interface InternalDNS {
            /**
             * The ID of the zone to fallback to.
             */
            reference_zone_id?: string;
        }
        /**
         * Settings determining the nameservers through which the zone should be available.
         */
        interface Nameservers {
            /**
             * Nameserver type
             */
            type: 'cloudflare.standard' | 'cloudflare.standard.random' | 'custom.account' | 'custom.tenant';
        }
        /**
         * Components of the zone's SOA record.
         */
        interface SOA {
            /**
             * Time in seconds of being unable to query the primary server after which
             * secondary servers should stop serving the zone.
             */
            expire: number;
            /**
             * The time to live (TTL) for negative caching of records within the zone.
             */
            min_ttl: number;
            /**
             * The primary nameserver, which may be used for outbound zone transfers.
             */
            mname: string;
            /**
             * Time in seconds after which secondary servers should re-check the SOA record to
             * see if the zone has been updated.
             */
            refresh: number;
            /**
             * Time in seconds after which secondary servers should retry queries after the
             * primary server was unresponsive.
             */
            retry: number;
            /**
             * The email address of the zone administrator, with the first label representing
             * the local part of the email address.
             */
            rname: string;
            /**
             * The time to live (TTL) of the SOA record itself.
             */
            ttl: number;
        }
    }
}
export interface AccountGetResponse {
    zone_defaults?: AccountGetResponse.ZoneDefaults;
}
export declare namespace AccountGetResponse {
    interface ZoneDefaults {
        /**
         * Whether to flatten all CNAME records in the zone. Note that, due to DNS
         * limitations, a CNAME record at the zone apex will always be flattened.
         */
        flatten_all_cnames?: boolean;
        /**
         * Whether to enable Foundation DNS Advanced Nameservers on the zone.
         */
        foundation_dns?: boolean;
        /**
         * Settings for this internal zone.
         */
        internal_dns?: ZoneDefaults.InternalDNS;
        /**
         * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
         * zone even when non-Cloudflare NS records exist, and to respect NS records at the
         * zone apex during outbound zone transfers.
         */
        multi_provider?: boolean;
        /**
         * Settings determining the nameservers through which the zone should be available.
         */
        nameservers?: ZoneDefaults.Nameservers;
        /**
         * The time to live (TTL) of the zone's nameserver (NS) records.
         */
        ns_ttl?: number;
        /**
         * Allows a Secondary DNS zone to use (proxied) override records and CNAME
         * flattening at the zone apex.
         */
        secondary_overrides?: boolean;
        /**
         * Components of the zone's SOA record.
         */
        soa?: ZoneDefaults.SOA;
        /**
         * Whether the zone mode is a regular or CDN/DNS only zone.
         */
        zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
    }
    namespace ZoneDefaults {
        /**
         * Settings for this internal zone.
         */
        interface InternalDNS {
            /**
             * The ID of the zone to fallback to.
             */
            reference_zone_id?: string;
        }
        /**
         * Settings determining the nameservers through which the zone should be available.
         */
        interface Nameservers {
            /**
             * Nameserver type
             */
            type: 'cloudflare.standard' | 'cloudflare.standard.random' | 'custom.account' | 'custom.tenant';
        }
        /**
         * Components of the zone's SOA record.
         */
        interface SOA {
            /**
             * Time in seconds of being unable to query the primary server after which
             * secondary servers should stop serving the zone.
             */
            expire: number;
            /**
             * The time to live (TTL) for negative caching of records within the zone.
             */
            min_ttl: number;
            /**
             * The primary nameserver, which may be used for outbound zone transfers.
             */
            mname: string;
            /**
             * Time in seconds after which secondary servers should re-check the SOA record to
             * see if the zone has been updated.
             */
            refresh: number;
            /**
             * Time in seconds after which secondary servers should retry queries after the
             * primary server was unresponsive.
             */
            retry: number;
            /**
             * The email address of the zone administrator, with the first label representing
             * the local part of the email address.
             */
            rname: string;
            /**
             * The time to live (TTL) of the SOA record itself.
             */
            ttl: number;
        }
    }
}
export interface AccountEditParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    zone_defaults?: AccountEditParams.ZoneDefaults;
}
export declare namespace AccountEditParams {
    interface ZoneDefaults {
        /**
         * Whether to flatten all CNAME records in the zone. Note that, due to DNS
         * limitations, a CNAME record at the zone apex will always be flattened.
         */
        flatten_all_cnames?: boolean;
        /**
         * Whether to enable Foundation DNS Advanced Nameservers on the zone.
         */
        foundation_dns?: boolean;
        /**
         * Settings for this internal zone.
         */
        internal_dns?: ZoneDefaults.InternalDNS;
        /**
         * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
         * zone even when non-Cloudflare NS records exist, and to respect NS records at the
         * zone apex during outbound zone transfers.
         */
        multi_provider?: boolean;
        /**
         * Settings determining the nameservers through which the zone should be available.
         */
        nameservers?: ZoneDefaults.Nameservers;
        /**
         * The time to live (TTL) of the zone's nameserver (NS) records.
         */
        ns_ttl?: number;
        /**
         * Allows a Secondary DNS zone to use (proxied) override records and CNAME
         * flattening at the zone apex.
         */
        secondary_overrides?: boolean;
        /**
         * Components of the zone's SOA record.
         */
        soa?: ZoneDefaults.SOA;
        /**
         * Whether the zone mode is a regular or CDN/DNS only zone.
         */
        zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
    }
    namespace ZoneDefaults {
        /**
         * Settings for this internal zone.
         */
        interface InternalDNS {
            /**
             * The ID of the zone to fallback to.
             */
            reference_zone_id?: string;
        }
        /**
         * Settings determining the nameservers through which the zone should be available.
         */
        interface Nameservers {
            /**
             * Nameserver type
             */
            type: 'cloudflare.standard' | 'cloudflare.standard.random' | 'custom.account' | 'custom.tenant';
        }
        /**
         * Components of the zone's SOA record.
         */
        interface SOA {
            /**
             * Time in seconds of being unable to query the primary server after which
             * secondary servers should stop serving the zone.
             */
            expire: number;
            /**
             * The time to live (TTL) for negative caching of records within the zone.
             */
            min_ttl: number;
            /**
             * The primary nameserver, which may be used for outbound zone transfers.
             */
            mname: string;
            /**
             * Time in seconds after which secondary servers should re-check the SOA record to
             * see if the zone has been updated.
             */
            refresh: number;
            /**
             * Time in seconds after which secondary servers should retry queries after the
             * primary server was unresponsive.
             */
            retry: number;
            /**
             * The email address of the zone administrator, with the first label representing
             * the local part of the email address.
             */
            rname: string;
            /**
             * The time to live (TTL) of the SOA record itself.
             */
            ttl: number;
        }
    }
}
export interface AccountGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Account {
    export { type AccountEditResponse as AccountEditResponse, type AccountGetResponse as AccountGetResponse, type AccountEditParams as AccountEditParams, type AccountGetParams as AccountGetParams, };
    export { Views as Views, type ViewCreateResponse as ViewCreateResponse, type ViewListResponse as ViewListResponse, type ViewDeleteResponse as ViewDeleteResponse, type ViewEditResponse as ViewEditResponse, type ViewGetResponse as ViewGetResponse, ViewListResponsesV4PagePaginationArray as ViewListResponsesV4PagePaginationArray, type ViewCreateParams as ViewCreateParams, type ViewListParams as ViewListParams, type ViewDeleteParams as ViewDeleteParams, type ViewEditParams as ViewEditParams, type ViewGetParams as ViewGetParams, };
}
//# sourceMappingURL=account.d.ts.map