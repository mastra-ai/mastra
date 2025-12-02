import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Vtt extends APIResource {
    /**
     * Return WebVTT captions for a provided language.
     *
     * @example
     * ```ts
     * const vtt = await client.stream.captions.language.vtt.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   'tr',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier: string, language: string, params: VttGetParams, options?: Core.RequestOptions): Core.APIPromise<string>;
}
export type VttGetResponse = string;
export interface VttGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Vtt {
    export { type VttGetResponse as VttGetResponse, type VttGetParams as VttGetParams };
}
//# sourceMappingURL=vtt.d.ts.map