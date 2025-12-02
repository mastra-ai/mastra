// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Fallthrough extends APIResource {
    /**
     * Generate fallthrough WAF expression template from a set of API hosts
     *
     * @example
     * ```ts
     * const fallthrough =
     *   await client.apiGateway.expressionTemplate.fallthrough.create(
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       hosts: ['{zone}.domain1.tld', 'domain2.tld'],
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/api_gateway/expression-template/fallthrough`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=fallthrough.mjs.map