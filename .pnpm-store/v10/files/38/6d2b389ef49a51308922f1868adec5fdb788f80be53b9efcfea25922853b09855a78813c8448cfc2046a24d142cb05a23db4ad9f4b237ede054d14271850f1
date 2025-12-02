import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as ConfigAPI from "./config.js";
export declare class Export extends APIResource {
    /**
     * Exports full current published Zaraz configuration for a zone, secret variables
     * included.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.export.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: ExportGetParams, options?: Core.RequestOptions): Core.APIPromise<ConfigAPI.Configuration>;
}
export interface ExportGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Export {
    export { type ExportGetParams as ExportGetParams };
}
//# sourceMappingURL=export.d.ts.map