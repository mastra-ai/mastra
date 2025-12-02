import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as WorkersAPI from "../workers.js";
import * as ScriptsAPI from "./scripts.js";
import { type Response } from "../../../_shims/index.js";
export declare class Content extends APIResource {
    /**
     * Put script content without touching config or metadata.
     *
     * @example
     * ```ts
     * const script = await client.workers.scripts.content.update(
     *   'this-is_my_script-01',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     metadata: {},
     *   },
     * );
     * ```
     */
    update(scriptName: string, params: ContentUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ScriptsAPI.Script>;
    /**
     * Fetch script content only.
     *
     * @example
     * ```ts
     * const content = await client.workers.scripts.content.get(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     *
     * const data = await content.blob();
     * console.log(data);
     * ```
     */
    get(scriptName: string, params: ContentGetParams, options?: Core.RequestOptions): Core.APIPromise<Response>;
}
export interface ContentUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: JSON encoded metadata about the uploaded parts and Worker
     * configuration.
     */
    metadata: WorkersAPI.WorkerMetadataParam;
    /**
     * Header param: The multipart name of a script upload part containing script
     * content in service worker format. Alternative to including in a metadata part.
     */
    'CF-WORKER-BODY-PART'?: string;
    /**
     * Header param: The multipart name of a script upload part containing script
     * content in es module format. Alternative to including in a metadata part.
     */
    'CF-WORKER-MAIN-MODULE-PART'?: string;
    [k: string]: Array<Core.Uploadable> | string | WorkersAPI.WorkerMetadataParam | undefined;
}
export interface ContentGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Content {
    export { type ContentUpdateParams as ContentUpdateParams, type ContentGetParams as ContentGetParams };
}
//# sourceMappingURL=content.d.ts.map