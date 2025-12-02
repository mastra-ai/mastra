import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Token extends APIResource {
    /**
     * Creates a signed URL token for a video. If a body is not provided in the
     * request, a token is created with default values.
     *
     * @example
     * ```ts
     * const token = await client.stream.token.create(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(identifier: string, params: TokenCreateParams, options?: Core.RequestOptions): Core.APIPromise<TokenCreateResponse>;
}
export interface TokenCreateResponse {
    /**
     * The signed token used with the signed URLs feature.
     */
    token?: string;
}
export interface TokenCreateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: The optional ID of a Stream signing key. If present, the `pem` field
     * is also required.
     */
    id?: string;
    /**
     * Body param: The optional list of access rule constraints on the token. Access
     * can be blocked or allowed based on an IP, IP range, or by country. Access rules
     * are evaluated from first to last. If a rule matches, the associated action is
     * applied and no further rules are evaluated.
     */
    accessRules?: Array<TokenCreateParams.AccessRule>;
    /**
     * Body param: The optional boolean value that enables using signed tokens to
     * access MP4 download links for a video.
     */
    downloadable?: boolean;
    /**
     * Body param: The optional unix epoch timestamp that specficies the time after a
     * token is not accepted. The maximum time specification is 24 hours from issuing
     * time. If this field is not set, the default is one hour after issuing.
     */
    exp?: number;
    /**
     * Body param: The optional unix epoch timestamp that specifies the time before a
     * the token is not accepted. If this field is not set, the default is one hour
     * before issuing.
     */
    nbf?: number;
    /**
     * Body param: The optional base64 encoded private key in PEM format associated
     * with a Stream signing key. If present, the `id` field is also required.
     */
    pem?: string;
}
export declare namespace TokenCreateParams {
    /**
     * Defines rules for fine-grained control over content than signed URL tokens
     * alone. Access rules primarily make tokens conditionally valid based on user
     * information. Access Rules are specified on token payloads as the `accessRules`
     * property containing an array of Rule objects.
     */
    interface AccessRule {
        /**
         * The action to take when a request matches a rule. If the action is `block`, the
         * signed token blocks views for viewers matching the rule.
         */
        action?: 'allow' | 'block';
        /**
         * An array of 2-letter country codes in ISO 3166-1 Alpha-2 format used to match
         * requests.
         */
        country?: Array<string>;
        /**
         * An array of IPv4 or IPV6 addresses or CIDRs used to match requests.
         */
        ip?: Array<string>;
        /**
         * Lists available rule types to match for requests. An `any` type matches all
         * requests and can be used as a wildcard to apply default actions after other
         * rules.
         */
        type?: 'any' | 'ip.src' | 'ip.geoip.country';
    }
}
export declare namespace Token {
    export { type TokenCreateResponse as TokenCreateResponse, type TokenCreateParams as TokenCreateParams };
}
//# sourceMappingURL=token.d.ts.map