import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class IPLists extends APIResource {
    /**
     * Get IP Lists.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ipList of client.intel.ipLists.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    get(params: IPListGetParams, options?: Core.RequestOptions): Core.PagePromise<IPListsSinglePage, IPList>;
}
export declare class IPListsSinglePage extends SinglePage<IPList> {
}
export interface IPList {
    id?: number;
    description?: string;
    name?: string;
}
export interface IPListGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace IPLists {
    export { type IPList as IPList, IPListsSinglePage as IPListsSinglePage, type IPListGetParams as IPListGetParams, };
}
//# sourceMappingURL=ip-lists.d.ts.map