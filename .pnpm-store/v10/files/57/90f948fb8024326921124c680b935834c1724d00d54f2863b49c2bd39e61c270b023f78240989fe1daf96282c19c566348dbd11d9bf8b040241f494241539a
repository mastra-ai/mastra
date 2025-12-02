import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Health extends APIResource {
    /**
     * Benchmark Durable Object warmup
     *
     * @example
     * ```ts
     * const health =
     *   await client.cloudforceOne.threatEvents.datasets.health.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(datasetId: string, params: HealthGetParams, options?: Core.RequestOptions): Core.APIPromise<HealthGetResponse>;
}
export interface HealthGetResponse {
    items: HealthGetResponse.Items;
    type: string;
}
export declare namespace HealthGetResponse {
    interface Items {
        type: string;
    }
}
export interface HealthGetParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace Health {
    export { type HealthGetResponse as HealthGetResponse, type HealthGetParams as HealthGetParams };
}
//# sourceMappingURL=health.d.ts.map