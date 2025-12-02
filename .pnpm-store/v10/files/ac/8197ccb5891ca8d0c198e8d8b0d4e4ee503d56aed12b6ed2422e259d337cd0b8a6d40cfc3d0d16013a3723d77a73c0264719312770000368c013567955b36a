import { APIResource } from "../../../resource.js";
import * as ZoneAPI from "./zone.js";
import { Zone, ZoneEditParams, ZoneEditResponse, ZoneGetParams, ZoneGetResponse } from "./zone.js";
import * as AccountAPI from "./account/account.js";
import { Account, AccountEditParams, AccountEditResponse, AccountGetParams, AccountGetResponse } from "./account/account.js";
export declare class Settings extends APIResource {
    zone: ZoneAPI.Zone;
    account: AccountAPI.Account;
}
export interface DNSSetting {
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
    internal_dns?: DNSSetting.InternalDNS;
    /**
     * Whether to enable multi-provider DNS, which causes Cloudflare to activate the
     * zone even when non-Cloudflare NS records exist, and to respect NS records at the
     * zone apex during outbound zone transfers.
     */
    multi_provider?: boolean;
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
    soa?: DNSSetting.SOA;
    /**
     * Whether the zone mode is a regular or CDN/DNS only zone.
     */
    zone_mode?: 'standard' | 'cdn_only' | 'dns_only';
}
export declare namespace DNSSetting {
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
export declare namespace Settings {
    export { type DNSSetting as DNSSetting };
    export { Zone as Zone, type ZoneEditResponse as ZoneEditResponse, type ZoneGetResponse as ZoneGetResponse, type ZoneEditParams as ZoneEditParams, type ZoneGetParams as ZoneGetParams, };
    export { Account as Account, type AccountEditResponse as AccountEditResponse, type AccountGetResponse as AccountGetResponse, type AccountEditParams as AccountEditParams, type AccountGetParams as AccountGetParams, };
}
//# sourceMappingURL=settings.d.ts.map