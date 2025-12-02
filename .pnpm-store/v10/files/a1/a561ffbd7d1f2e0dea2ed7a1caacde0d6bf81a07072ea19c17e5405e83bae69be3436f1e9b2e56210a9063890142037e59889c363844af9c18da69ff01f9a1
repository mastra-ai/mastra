// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Patterns extends APIResource {
    /**
     * Validates whether this pattern is a valid regular expression. Rejects it if the
     * regular expression is too complex or can match an unbounded-length string. The
     * regex will be rejected if it uses `*` or `+`. Bound the maximum number of
     * characters that can be matched using a range, e.g. `{1,100}`.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.dlp.patterns.validate({
     *     account_id: 'account_id',
     *     regex: 'regex',
     *   });
     * ```
     */
    validate(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/patterns/validate`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=patterns.mjs.map