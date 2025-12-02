"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PCAPListResponsesSinglePage = exports.PCAPs = void 0;
const resource_1 = require("../../../resource.js");
const DownloadAPI = __importStar(require("./download.js"));
const download_1 = require("./download.js");
const OwnershipAPI = __importStar(require("./ownership.js"));
const ownership_1 = require("./ownership.js");
const pagination_1 = require("../../../pagination.js");
class PCAPs extends resource_1.APIResource {
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
exports.PCAPs = PCAPs;
class PCAPListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PCAPListResponsesSinglePage = PCAPListResponsesSinglePage;
PCAPs.PCAPListResponsesSinglePage = PCAPListResponsesSinglePage;
PCAPs.OwnershipResource = ownership_1.OwnershipResource;
PCAPs.OwnershipsSinglePage = ownership_1.OwnershipsSinglePage;
PCAPs.Download = download_1.Download;
//# sourceMappingURL=pcaps.js.map