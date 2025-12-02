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
exports.ASN = void 0;
const resource_1 = require("../../../resource.js");
const SubnetsAPI = __importStar(require("./subnets.js"));
const subnets_1 = require("./subnets.js");
class ASN extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.subnets = new SubnetsAPI.Subnets(this._client);
    }
    /**
     * Gets an overview of the Autonomous System Number (ASN) and a list of subnets for
     * it.
     *
     * @example
     * ```ts
     * const asn = await client.intel.asn.get(0, {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(asn, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/intel/asn/${asn}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ASN = ASN;
ASN.Subnets = subnets_1.Subnets;
//# sourceMappingURL=asn.js.map