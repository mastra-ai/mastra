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
exports.CloudflaredListResponsesV4PagePaginationArray = exports.Cloudflared = void 0;
const resource_1 = require("../../../../resource.js");
const ConfigurationsAPI = __importStar(require("./configurations.js"));
const configurations_1 = require("./configurations.js");
const ConnectionsAPI = __importStar(require("./connections.js"));
const connections_1 = require("./connections.js");
const ConnectorsAPI = __importStar(require("./connectors.js"));
const connectors_1 = require("./connectors.js");
const ManagementAPI = __importStar(require("./management.js"));
const management_1 = require("./management.js");
const TokenAPI = __importStar(require("./token.js"));
const token_1 = require("./token.js");
const pagination_1 = require("../../../../pagination.js");
class Cloudflared extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.configurations = new ConfigurationsAPI.Configurations(this._client);
        this.connections = new ConnectionsAPI.Connections(this._client);
        this.token = new TokenAPI.Token(this._client);
        this.connectors = new ConnectorsAPI.Connectors(this._client);
        this.management = new ManagementAPI.Management(this._client);
    }
    /**
     * Creates a new Cloudflare Tunnel in an account.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'blog',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cfd_tunnel`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists and filters Cloudflare Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const cloudflaredListResponse of client.zeroTrust.tunnels.cloudflared.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cfd_tunnel`, CloudflaredListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a Cloudflare Tunnel from an account.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cfd_tunnel/${tunnelId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.tunnels.cloudflared.edit(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(tunnelId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cfd_tunnel/${tunnelId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cfd_tunnel/${tunnelId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Cloudflared = Cloudflared;
class CloudflaredListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.CloudflaredListResponsesV4PagePaginationArray = CloudflaredListResponsesV4PagePaginationArray;
Cloudflared.CloudflaredListResponsesV4PagePaginationArray = CloudflaredListResponsesV4PagePaginationArray;
Cloudflared.Configurations = configurations_1.Configurations;
Cloudflared.Connections = connections_1.Connections;
Cloudflared.ClientsSinglePage = connections_1.ClientsSinglePage;
Cloudflared.Token = token_1.Token;
Cloudflared.Connectors = connectors_1.Connectors;
Cloudflared.Management = management_1.Management;
//# sourceMappingURL=cloudflared.js.map