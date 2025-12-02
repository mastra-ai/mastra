import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class ForceAXFRResource extends APIResource {
    /**
     * Sends AXFR zone transfer request to primary nameserver(s).
     *
     * @example
     * ```ts
     * const forceAXFR =
     *   await client.dns.zoneTransfers.forceAXFR.create({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     body: {},
     *   });
     * ```
     */
    create(params: ForceAXFRCreateParams, options?: Core.RequestOptions): Core.APIPromise<ForceAXFR>;
}
/**
 * When force_axfr query parameter is set to true, the response is a simple string
 */
export type ForceAXFR = string;
export interface ForceAXFRCreateParams {
    /**
     * Path param:
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export declare namespace ForceAXFRResource {
    export { type ForceAXFR as ForceAXFR, type ForceAXFRCreateParams as ForceAXFRCreateParams };
}
//# sourceMappingURL=force-axfr.d.ts.map