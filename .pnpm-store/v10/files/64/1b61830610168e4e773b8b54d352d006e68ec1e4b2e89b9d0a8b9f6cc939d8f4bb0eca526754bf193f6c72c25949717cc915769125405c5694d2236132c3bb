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
exports.HostnamesSinglePage = exports.Hostnames = void 0;
const resource_1 = require("../../../resource.js");
const IPFSUniversalPathsAPI = __importStar(require("./ipfs-universal-paths/ipfs-universal-paths.js"));
const ipfs_universal_paths_1 = require("./ipfs-universal-paths/ipfs-universal-paths.js");
const pagination_1 = require("../../../pagination.js");
class Hostnames extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.ipfsUniversalPaths = new IPFSUniversalPathsAPI.IPFSUniversalPaths(this._client);
    }
    /**
     * Create Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'gateway.example.com',
     *   target: 'ipfs',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/web3/hostnames`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Web3 Hostnames
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const hostname of client.web3.hostnames.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/web3/hostnames`, HostnamesSinglePage, options);
    }
    /**
     * Delete Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/web3/hostnames/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(identifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/web3/hostnames/${identifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Web3 Hostname Details
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Hostnames = Hostnames;
class HostnamesSinglePage extends pagination_1.SinglePage {
}
exports.HostnamesSinglePage = HostnamesSinglePage;
Hostnames.HostnamesSinglePage = HostnamesSinglePage;
Hostnames.IPFSUniversalPaths = ipfs_universal_paths_1.IPFSUniversalPaths;
//# sourceMappingURL=hostnames.js.map