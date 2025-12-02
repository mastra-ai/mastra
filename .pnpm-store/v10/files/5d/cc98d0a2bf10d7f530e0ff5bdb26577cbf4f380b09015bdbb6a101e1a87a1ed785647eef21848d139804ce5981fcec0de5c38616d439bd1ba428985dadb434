import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { type Response } from "../../../_shims/index.js";
export declare class Download extends APIResource {
    /**
     * Download PCAP information into a file. Response is a binary PCAP file.
     *
     * @example
     * ```ts
     * const download =
     *   await client.magicTransit.pcaps.download.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     *
     * const content = await download.blob();
     * console.log(content);
     * ```
     */
    get(pcapId: string, params: DownloadGetParams, options?: Core.RequestOptions): Core.APIPromise<Response>;
}
export interface DownloadGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Download {
    export { type DownloadGetParams as DownloadGetParams };
}
//# sourceMappingURL=download.d.ts.map