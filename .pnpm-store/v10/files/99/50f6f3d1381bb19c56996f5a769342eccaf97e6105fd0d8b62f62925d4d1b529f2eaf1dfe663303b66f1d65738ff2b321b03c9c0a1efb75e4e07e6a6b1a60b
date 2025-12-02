import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Advertisements extends APIResource {
    /**
     * Update advertisement for rule.
     *
     * @example
     * ```ts
     * const advertisement =
     *   await client.magicNetworkMonitoring.rules.advertisements.edit(
     *     '2890e6fa406311ed9b5a23f70f6fb8cf',
     *     {
     *       account_id: '6f91088a406011ed95aed352566e8d4c',
     *       body: {},
     *     },
     *   );
     * ```
     */
    edit(ruleId: string, params: AdvertisementEditParams, options?: Core.RequestOptions): Core.APIPromise<Advertisement | null>;
}
export interface Advertisement {
    /**
     * Toggle on if you would like Cloudflare to automatically advertise the IP
     * Prefixes within the rule via Magic Transit when the rule is triggered. Only
     * available for users of Magic Transit.
     */
    automatic_advertisement: boolean | null;
}
export interface AdvertisementEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export declare namespace Advertisements {
    export { type Advertisement as Advertisement, type AdvertisementEditParams as AdvertisementEditParams };
}
//# sourceMappingURL=advertisements.d.ts.map