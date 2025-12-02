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
exports.SubnetListResponsesV4PagePaginationArray = exports.Subnets = void 0;
const resource_1 = require("../../../../resource.js");
const CloudflareSourceAPI = __importStar(require("./cloudflare-source.js"));
const cloudflare_source_1 = require("./cloudflare-source.js");
const pagination_1 = require("../../../../pagination.js");
class Subnets extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.cloudflareSource = new CloudflareSourceAPI.CloudflareSource(this._client);
    }
    /**
     * Lists and filters subnets in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const subnetListResponse of client.zeroTrust.networks.subnets.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/zerotrust/subnets`, SubnetListResponsesV4PagePaginationArray, { query, ...options });
    }
}
exports.Subnets = Subnets;
class SubnetListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.SubnetListResponsesV4PagePaginationArray = SubnetListResponsesV4PagePaginationArray;
Subnets.SubnetListResponsesV4PagePaginationArray = SubnetListResponsesV4PagePaginationArray;
Subnets.CloudflareSource = cloudflare_source_1.CloudflareSource;
//# sourceMappingURL=subnets.js.map