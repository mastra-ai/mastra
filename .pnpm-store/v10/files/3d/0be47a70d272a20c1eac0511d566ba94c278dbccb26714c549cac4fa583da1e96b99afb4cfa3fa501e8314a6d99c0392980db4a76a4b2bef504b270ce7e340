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
exports.HTTPTests = void 0;
const resource_1 = require("../../../../resource.js");
const PercentilesAPI = __importStar(require("./percentiles.js"));
const percentiles_1 = require("./percentiles.js");
class HTTPTests extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.percentiles = new PercentilesAPI.Percentiles(this._client);
    }
    /**
     * Get test details and aggregate performance metrics for an http test for a given
     * time period between 1 hour and 7 days.
     *
     * @example
     * ```ts
     * const httpDetails =
     *   await client.zeroTrust.dex.httpTests.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       from: '1689520412000',
     *       interval: 'minute',
     *       to: '1689606812000',
     *     },
     *   );
     * ```
     */
    get(testId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/http-tests/${testId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.HTTPTests = HTTPTests;
HTTPTests.Percentiles = percentiles_1.Percentiles;
//# sourceMappingURL=http-tests.js.map