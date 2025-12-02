// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Tokens extends APIResource {
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
//# sourceMappingURL=tokens.mjs.map