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
exports.DiscoveryOperationsV4PagePaginationArray = exports.Discovery = void 0;
const resource_1 = require("../../../resource.js");
const OperationsAPI = __importStar(require("./operations.js"));
const operations_1 = require("./operations.js");
const pagination_1 = require("../../../pagination.js");
class Discovery extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.operations = new OperationsAPI.Operations(this._client);
    }
    /**
     * Retrieve the most up to date view of discovered operations, rendered as OpenAPI
     * schemas
     *
     * @example
     * ```ts
     * const discovery = await client.apiGateway.discovery.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/discovery`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Discovery = Discovery;
class DiscoveryOperationsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.DiscoveryOperationsV4PagePaginationArray = DiscoveryOperationsV4PagePaginationArray;
Discovery.Operations = operations_1.Operations;
//# sourceMappingURL=discovery.js.map