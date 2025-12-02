// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Advertisements extends APIResource {
    /**
     * Update advertisement for rule.
     *
     * @example
     * ```ts
     * const advertisement =
     *   await client.magicNetworkMonitoring.rules.advertisements.edit(
     *     '2890e6fa406311ed9b5a23f70f6fb8cf',
     *     {
     *       account_id: '6f91088a406011ed95aed352566e8d4c',
     *       body: {},
     *     },
     *   );
     * ```
     */
    edit(ruleId, params, options) {
        const { account_id, body } = params;
        return this._client.patch(`/accounts/${account_id}/mnm/rules/${ruleId}/advertisement`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=advertisements.mjs.map