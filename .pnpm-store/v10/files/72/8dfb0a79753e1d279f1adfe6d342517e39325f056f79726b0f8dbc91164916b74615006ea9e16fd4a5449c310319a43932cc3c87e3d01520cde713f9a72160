import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as WorkersAPI from "../../../../workers/workers.js";
import * as ScriptsAPI from "../../../../workers/scripts/scripts.js";
import { type Response } from "../../../../../_shims/index.js";
export declare class Content extends APIResource {
    /**
     * Put script content for a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const script =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.update(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       metadata: {},
     *     },
     *   );
     * ```
     */
    update(dispatchNamespace: string, scriptName: string, params: ContentUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ScriptsAPI.Script>;
    /**
     * Fetch script content from a script uploaded to a Workers for Platforms
     * namespace.
     *
     * @example
     * ```ts
     * const content =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     *
     * const data = await content.blob();
     * console.log(data);
     * ```
     */
    get(dispatchNamespace: string, scriptName: string, params: ContentGetParams, options?: Core.RequestOptions): Core.APIPromise<Response>;
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