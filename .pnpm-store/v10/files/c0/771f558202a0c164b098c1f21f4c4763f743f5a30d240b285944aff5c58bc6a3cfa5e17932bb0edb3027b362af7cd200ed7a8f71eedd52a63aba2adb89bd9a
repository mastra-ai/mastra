"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokens = void 0;
const resource_1 = require("../../../resource.js");
class Tokens extends resource_1.APIResource {
    /**
     * Generate authentication token for VPC flow logs export.
     *
     * @example
     * ```ts
     * const token =
     *   await client.magicNetworkMonitoring.vpcFlows.tokens.create(
     *     { account_id: '6f91088a406011ed95aed352566e8d4c' },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/mnm/vpc-flows/token`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Tokens = Tokens;
//# sourceMappingURL=tokens.js.map