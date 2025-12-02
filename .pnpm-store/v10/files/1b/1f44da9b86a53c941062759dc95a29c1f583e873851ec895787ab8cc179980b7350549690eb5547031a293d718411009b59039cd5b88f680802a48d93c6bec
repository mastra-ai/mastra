import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Relate extends APIResource {
    /**
     * Removes an event reference
     *
     * @example
     * ```ts
     * const relate =
     *   await client.cloudforceOne.threatEvents.relate.delete(
     *     'event_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(eventId: string, params: RelateDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RelateDeleteResponse>;
}
export interface RelateDeleteResponse {
    success: boolean;
}
export interface RelateDeleteParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Relate {
    export { type RelateDeleteResponse as RelateDeleteResponse, type RelateDeleteParams as RelateDeleteParams };
}
//# sourceMappingURL=relate.d.ts.map