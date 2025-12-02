import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class DomainHistoryResource extends APIResource {
    /**
     * Gets historical security threat and content categories currently and previously
     * assigned to a domain.
     *
     * @example
     * ```ts
     * const domainHistories =
     *   await client.intel.domainHistory.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params: DomainHistoryGetParams, options?: Core.RequestOptions): Core.APIPromise<DomainHistoryGetResponse | null>;
}
export interface DomainHistory {
    categorizations?: Array<DomainHistory.Categorization>;
    domain?: string;
}
export declare namespace DomainHistory {
    interface Categorization {
        categories?: Array<Categorization.Category>;
        end?: string;
        start?: string;
    }
    namespace Categorization {
        interface Category {
            id?: number;
            name?: string;
        }
    }
}
export type DomainHistoryGetResponse = Array<DomainHistory>;
export interface DomainHistoryGetParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param:
     */
    domain?: string;
}
export declare namespace DomainHistoryResource {
    export { type DomainHistory as DomainHistory, type DomainHistoryGetResponse as DomainHistoryGetResponse, type DomainHistoryGetParams as DomainHistoryGetParams, };
}
//# sourceMappingURL=domain-history.d.ts.map