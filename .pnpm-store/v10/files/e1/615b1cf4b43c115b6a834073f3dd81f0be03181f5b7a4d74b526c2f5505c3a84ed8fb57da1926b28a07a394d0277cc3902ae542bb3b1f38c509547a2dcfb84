import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Embed extends APIResource {
    /**
     * Fetches an HTML code snippet to embed a video in a web page delivered through
     * Cloudflare. On success, returns an HTML fragment for use on web pages to display
     * a video. On failure, returns a JSON response body.
     *
     * @example
     * ```ts
     * const embed = await client.stream.embed.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier: string, params: EmbedGetParams, options?: Core.RequestOptions): Core.APIPromise<string>;
}
export type EmbedGetResponse = string;
export interface EmbedGetParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export declare namespace Embed {
    export { type EmbedGetResponse as EmbedGetResponse, type EmbedGetParams as EmbedGetParams };
}
//# sourceMappingURL=embed.d.ts.map