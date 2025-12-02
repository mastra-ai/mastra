// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Download extends APIResource {
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
    get(pcapId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pcaps/${pcapId}/download`, {
            ...options,
            headers: { Accept: 'application/vnd.tcpdump.pcap', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=download.mjs.map