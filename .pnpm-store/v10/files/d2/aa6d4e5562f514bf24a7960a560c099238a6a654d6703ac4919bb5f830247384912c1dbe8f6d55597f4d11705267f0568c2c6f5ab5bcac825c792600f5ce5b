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
exports.ContentLists = void 0;
const resource_1 = require("../../../../../resource.js");
const EntriesAPI = __importStar(require("./entries.js"));
const entries_1 = require("./entries.js");
class ContentLists extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.entries = new EntriesAPI.Entries(this._client);
    }
    /**
     * Update IPFS Universal Path Gateway Content List
     *
     * @example
     * ```ts
     * const contentList =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       action: 'block',
     *       entries: [{}],
     *     },
     *   );
     * ```
     */
    update(identifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * IPFS Universal Path Gateway Content List Details
     *
     * @example
     * ```ts
     * const contentList =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(identifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ContentLists = ContentLists;
ContentLists.Entries = entries_1.Entries;
//# sourceMappingURL=content-lists.js.map