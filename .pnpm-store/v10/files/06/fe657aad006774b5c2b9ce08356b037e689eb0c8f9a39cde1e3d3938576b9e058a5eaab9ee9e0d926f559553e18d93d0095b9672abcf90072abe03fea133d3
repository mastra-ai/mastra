import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Whois extends APIResource {
    /**
     * Get WHOIS Record
     *
     * @example
     * ```ts
     * const whois = await client.intel.whois.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: WhoisGetParams, options?: Core.RequestOptions): Core.APIPromise<WhoisGetResponse>;
}
export interface Whois {
    created_date?: string;
    domain?: string;
    nameservers?: Array<string>;
    registrant?: string;
    registrant_country?: string;
    registrant_email?: string;
    registrant_org?: string;
    registrar?: string;
    updated_date?: string;
}
export interface WhoisGetResponse {
    dnssec: boolean;
    domain: string;
    extension: string;
    found: boolean;
    nameservers: Array<string>;
    punycode: string;
    registrant: string;
    registrar: string;
    id?: string;
    administrative_city?: string;
    administrative_country?: string;
    administrative_email?: string;
    administrative_fax?: string;
    administrative_fax_ext?: string;
    administrative_id?: string;
    administrative_name?: string;
    administrative_org?: string;
    administrative_phone?: string;
    administrative_phone_ext?: string;
    administrative_postal_code?: string;
    administrative_province?: string;
    administrative_referral_url?: string;
    administrative_street?: string;
    billing_city?: string;
    billing_country?: string;
    billing_email?: string;
    billing_fax?: string;
    billing_fax_ext?: string;
    billing_id?: string;
    billing_name?: string;
    billing_org?: string;
    billing_phone?: string;
    billing_phone_ext?: string;
    billing_postal_code?: string;
    billing_province?: string;
    billing_referral_url?: string;
    billing_street?: string;
    created_date?: string;
    created_date_raw?: string;
    expiration_date?: string;
    expiration_date_raw?: string;
    registrant_city?: string;
    registrant_country?: string;
    registrant_email?: string;
    registrant_fax?: string;
    registrant_fax_ext?: string;
    registrant_id?: string;
    registrant_name?: string;
    registrant_org?: string;
    registrant_phone?: string;
    registrant_phone_ext?: string;
    registrant_postal_code?: string;
    registrant_province?: string;
    registrant_referral_url?: string;
    registrant_street?: string;
    registrar_city?: string;
    registrar_country?: string;
    registrar_email?: string;
    registrar_fax?: string;
    registrar_fax_ext?: string;
    registrar_id?: string;
    registrar_name?: string;
    registrar_org?: string;
    registrar_phone?: string;
    registrar_phone_ext?: string;
    registrar_postal_code?: string;
    registrar_province?: string;
    registrar_referral_url?: string;
    registrar_street?: string;
    status?: Array<string>;
    technical_city?: string;
    technical_country?: string;
    technical_email?: string;
    technical_fax?: string;
    technical_fax_ext?: string;
    technical_id?: string;
    technical_name?: string;
    technical_org?: string;
    technical_phone?: string;
    technical_phone_ext?: string;
    technical_postal_code?: string;
    technical_province?: string;
    technical_referral_url?: string;
    technical_street?: string;
    updated_date?: string;
    updated_date_raw?: string;
    whois_server?: string;
}
export interface WhoisGetParams {
    /**
     * Path param: Use to uniquely identify or reference the resource.
     */
    account_id: string;
    /**
     * Query param:
     */
    domain?: string;
}
export declare namespace Whois {
    export { type Whois as Whois, type WhoisGetResponse as WhoisGetResponse, type WhoisGetParams as WhoisGetParams, };
}
//# sourceMappingURL=whois.d.ts.map