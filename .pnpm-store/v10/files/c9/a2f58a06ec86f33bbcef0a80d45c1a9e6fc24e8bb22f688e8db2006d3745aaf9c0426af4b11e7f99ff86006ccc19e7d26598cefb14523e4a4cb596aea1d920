import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Attackers extends APIResource {
    /**
     * Lists attackers
     *
     * @example
     * ```ts
     * const attackers =
     *   await client.cloudforceOne.threatEvents.attackers.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params: AttackerListParams, options?: Core.RequestOptions): Core.APIPromise<AttackerListResponse>;
}
export interface AttackerListResponse {
    items: AttackerListResponse.Items;
    type: string;
}
export declare namespace AttackerListResponse {
    interface Items {
        type: string;
    }
}
export interface AttackerListParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Attackers {
    export { type AttackerListResponse as AttackerListResponse, type AttackerListParams as AttackerListParams };
}
//# sourceMappingURL=attackers.d.ts.map