import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Countries extends APIResource {
    /**
     * Retrieves countries information for all countries
     *
     * @example
     * ```ts
     * const countries =
     *   await client.cloudforceOne.threatEvents.countries.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params: CountryListParams, options?: Core.RequestOptions): Core.APIPromise<CountryListResponse>;
}
export type CountryListResponse = Array<CountryListResponse.CountryListResponseItem>;
export declare namespace CountryListResponse {
    interface CountryListResponseItem {
        result: Array<CountryListResponseItem.Result>;
        success: string;
    }
    namespace CountryListResponseItem {
        interface Result {
            alpha3: string;
            name: string;
        }
    }
}
export interface CountryListParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Countries {
    export { type CountryListResponse as CountryListResponse, type CountryListParams as CountryListParams };
}
//# sourceMappingURL=countries.d.ts.map