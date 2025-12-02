import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Patterns extends APIResource {
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
    validate(params: PatternValidateParams, options?: Core.RequestOptions): Core.APIPromise<PatternValidateResponse>;
}
export interface PatternValidateResponse {
    valid: boolean;
}
export interface PatternValidateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    regex: string;
    /**
     * Body param: Maximum number of bytes that the regular expression can match.
     *
     * If this is `null` then there is no limit on the length. Patterns can use `*` and
     * `+`. Otherwise repeats should use a range `{m,n}` to restrict patterns to the
     * length. If this field is missing, then a default length limit is used.
     *
     * Note that the length is specified in bytes. Since regular expressions use UTF-8
     * the pattern `.` can match up to 4 bytes. Hence `.{1,256}` has a maximum length
     * of 1024 bytes.
     */
    max_match_bytes?: number | null;
}
export declare namespace Patterns {
    export { type PatternValidateResponse as PatternValidateResponse, type PatternValidateParams as PatternValidateParams, };
}
//# sourceMappingURL=patterns.d.ts.map