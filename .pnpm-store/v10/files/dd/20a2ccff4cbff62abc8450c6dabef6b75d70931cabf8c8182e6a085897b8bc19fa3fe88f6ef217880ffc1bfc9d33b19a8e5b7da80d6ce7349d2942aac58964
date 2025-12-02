import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Tags extends APIResource {
    /**
     * Creates a new tag
     *
     * @example
     * ```ts
     * const tag =
     *   await client.cloudforceOne.threatEvents.tags.create({
     *     account_id: 'account_id',
     *     name: 'name',
     *   });
     * ```
     */
    create(params: TagCreateParams, options?: Core.RequestOptions): Core.APIPromise<TagCreateResponse>;
}
export interface TagCreateResponse {
    name: string;
    uuid: string;
}
export interface TagCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    name: string;
}
export declare namespace Tags {
    export { type TagCreateResponse as TagCreateResponse, type TagCreateParams as TagCreateParams };
}
//# sourceMappingURL=tags.d.ts.map