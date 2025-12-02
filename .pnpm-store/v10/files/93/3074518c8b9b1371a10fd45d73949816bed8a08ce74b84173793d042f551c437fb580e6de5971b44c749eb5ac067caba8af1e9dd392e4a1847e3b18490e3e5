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
exports.TunnelListResponsesV4PagePaginationArray = exports.Tunnels = void 0;
const resource_1 = require("../../../resource.js");
const CloudflaredAPI = __importStar(require("./cloudflared/cloudflared.js"));
const cloudflared_1 = require("./cloudflared/cloudflared.js");
const WARPConnectorAPI = __importStar(require("./warp-connector/warp-connector.js"));
const warp_connector_1 = require("./warp-connector/warp-connector.js");
const pagination_1 = require("../../../pagination.js");
class Tunnels extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.cloudflared = new CloudflaredAPI.Cloudflared(this._client);
        this.warpConnector = new WARPConnectorAPI.WARPConnector(this._client);
    }
    /**
     * Lists and filters all types of Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tunnelListResponse of client.zeroTrust.tunnels.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/tunnels`, TunnelListResponsesV4PagePaginationArray, { query, ...options });
    }
}
exports.Tunnels = Tunnels;
class TunnelListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.TunnelListResponsesV4PagePaginationArray = TunnelListResponsesV4PagePaginationArray;
Tunnels.TunnelListResponsesV4PagePaginationArray = TunnelListResponsesV4PagePaginationArray;
Tunnels.Cloudflared = cloudflared_1.Cloudflared;
Tunnels.CloudflaredListResponsesV4PagePaginationArray = cloudflared_1.CloudflaredListResponsesV4PagePaginationArray;
Tunnels.WARPConnector = warp_connector_1.WARPConnector;
Tunnels.WARPConnectorListResponsesV4PagePaginationArray = warp_connector_1.WARPConnectorListResponsesV4PagePaginationArray;
//# sourceMappingURL=tunnels.js.map