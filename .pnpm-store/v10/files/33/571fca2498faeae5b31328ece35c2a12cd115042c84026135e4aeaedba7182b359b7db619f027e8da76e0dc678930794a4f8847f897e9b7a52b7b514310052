import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class ActivationCheck extends APIResource {
    /**
     * Triggeres a new activation check for a PENDING Zone. This can be triggered every
     * 5 min for paygo/ent customers, every hour for FREE Zones.
     *
     * @example
     * ```ts
     * const response = await client.zones.activationCheck.trigger(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    trigger(params: ActivationCheckTriggerParams, options?: Core.RequestOptions): Core.APIPromise<ActivationCheckTriggerResponse>;
}
export interface ActivationCheckTriggerResponse {
    /**
     * Identifier.
     */
    id?: string;
}
export interface ActivationCheckTriggerParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace ActivationCheck {
    export { type ActivationCheckTriggerResponse as ActivationCheckTriggerResponse, type ActivationCheckTriggerParams as ActivationCheckTriggerParams, };
}
//# sourceMappingURL=activation-check.d.ts.map