import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as BulksAPI from "./bulks.js";
import { BulkGetParams, BulkGetResponse, Bulks } from "./bulks.js";
export declare class Domains extends APIResource {
    bulks: BulksAPI.Bulks;
    /**
     * Gets security details and statistics about a domain.
     *
     * @example
     * ```ts
     * const domain = await client.intel.domains.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: DomainGetParams, options?: Core.RequestOptions): Core.APIPromise<Domain>;
}
export interface Domain {
    /**
     * Additional information related to the host name.
     */
    additional_information?: Domain.AdditionalInformation;
    /**
     * Application that the hostname belongs to.
     */
    application?: Domain.Application;
    content_categories?: Array<Domain.ContentCategory>;
    domain?: string;
    inherited_content_categories?: Array<Domain.InheritedContentCategory>;
    /**
     * Domain from which `inherited_content_categories` and `inherited_risk_types` are
     * inherited, if applicable.
     */
    inherited_from?: string;
    inherited_risk_types?: Array<Domain.InheritedRiskType>;
    /**
     * Global Cloudflare 100k ranking for the last 30 days, if available for the
     * hostname. The top ranked domain is 1, the lowest ranked domain is 100,000.
     */
    popularity_rank?: number;
    /**
     * Specifies a list of references to one or more IP addresses or domain names that
     * the domain name currently resolves to.
     */
    resolves_to_refs?: Array<Domain.ResolvesToRef>;
    /**
     * Hostname risk score, which is a value between 0 (lowest risk) to 1 (highest
     * risk).
     */
    risk_score?: number;
    risk_types?: Array<Domain.RiskType>;
}
export declare namespace Domain {
    /**
     * Additional information related to the host name.
     */
    interface AdditionalInformation {
        /**
         * Suspected DGA malware family.
         */
        suspected_malware_family?: string;
    }
    /**
     * Application that the hostname belongs to.
     */
    interface Application {
        id?: number;
        name?: string;
    }
    /**
     * Current content categories.
     */
    interface ContentCategory {
        id?: number;
        name?: string;
        super_category_id?: number;
    }
    interface InheritedContentCategory {
        id?: number;
        name?: string;
        super_category_id?: number;
    }
    interface InheritedRiskType {
        id?: number;
        name?: string;
        super_category_id?: number;
    }
    interface ResolvesToRef {
        /**
         * STIX 2.1 identifier:
         * https://docs.oasis-open.org/cti/stix/v2.1/cs02/stix-v2.1-cs02.html#_64yvzeku5a5c.
         */
        id?: string;
        /**
         * IP address or domain name.
         */
        value?: string;
    }
    interface RiskType {
        id?: number;
        name?: string;
        super_category_id?: number;
    }
}
export interface DomainGetParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param:
     */
    domain?: string;
}
export declare namespace Domains {
    export { type Domain as Domain, type DomainGetParams as DomainGetParams };
    export { Bulks as Bulks, type BulkGetResponse as BulkGetResponse, type BulkGetParams as BulkGetParams };
}
//# sourceMappingURL=domains.d.ts.map