// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DownloadAPI from "./download.mjs";
import { Download } from "./download.mjs";
import * as OwnershipAPI from "./ownership.mjs";
import { OwnershipResource, OwnershipsSinglePage, } from "./ownership.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class PCAPs extends APIResource {
    constructor() {
        super(...arguments);
        this.ownership = new OwnershipAPI.OwnershipResource(this._client);
        this.download = new DownloadAPI.Download(this._client);
    }
    /**
     * Create new PCAP request for account.
     *
     * @example
     * ```ts
     * const pcap = await client.magicTransit.pcaps.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   packet_limit: 10000,
     *   system: 'magic-transit',
     *   time_limit: 300,
     *   type: 'simple',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pcaps`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all packet capture requests for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pcapListResponse of client.magicTransit.pcaps.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/pcaps`, PCAPListResponsesSinglePage, options);
    }
    /**
     * Get information for a PCAP request by id.
     *
     * @example
     * ```ts
     * const pcap = await client.magicTransit.pcaps.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(pcapId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pcaps/${pcapId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Stop full PCAP
     *
     * @example
     * ```ts
     * await client.magicTransit.pcaps.stop(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    stop(pcapId, params, options) {
        const { account_id } = params;
        return this._client.put(`/accounts/${account_id}/pcaps/${pcapId}/stop`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
}
export class PCAPListResponsesSinglePage extends SinglePage {
}
PCAPs.PCAPListResponsesSinglePage = PCAPListResponsesSinglePage;
PCAPs.OwnershipResource = OwnershipResource;
PCAPs.OwnershipsSinglePage = OwnershipsSinglePage;
PCAPs.Download = Download;
//# sourceMappingURL=pcaps.mjs.map