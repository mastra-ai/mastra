import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Publish extends APIResource {
    /**
     * Publish current Zaraz preview configuration for a zone.
     *
     * @example
     * ```ts
     * const publish = await client.zaraz.publish.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: PublishCreateParams, options?: Core.RequestOptions): Core.APIPromise<PublishCreateResponse>;
}
export type PublishCreateResponse = string;
export interface PublishCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Zaraz configuration description.
     */
    body?: string;
}
export declare namespace Publish {
    export { type PublishCreateResponse as PublishCreateResponse, type PublishCreateParams as PublishCreateParams, };
}
//# sourceMappingURL=publish.d.ts.map