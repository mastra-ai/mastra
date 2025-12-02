import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { type Response } from "../../../../_shims/index.js";
export declare class Downloads extends APIResource {
    /**
     * Downloads artifacts for an executed command. Bulk downloads are not supported
     *
     * @example
     * ```ts
     * const download =
     *   await client.zeroTrust.dex.commands.downloads.get(
     *     '5758fefe-ae7e-4538-a39b-1fef6abcb909',
     *     'filename',
     *     { account_id: '01a7362d577a6c3019a474fd6f485823' },
     *   );
     *
     * const content = await download.blob();
     * console.log(content);
     * ```
     */
    get(commandId: string, filename: string, params: DownloadGetParams, options?: Core.RequestOptions): Core.APIPromise<Response>;
}
export interface DownloadGetParams {
    /**
     * unique identifier linked to an account in the API request path
     */
    account_id: string;
}
export declare namespace Downloads {
    export { type DownloadGetParams as DownloadGetParams };
}
//# sourceMappingURL=downloads.d.ts.map