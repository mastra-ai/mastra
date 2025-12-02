import { APIResource } from "../resource.js";
import * as Core from "../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../pagination.js";
/**
 * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
 */
export declare class RateLimits extends APIResource {
    /**
     * Creates a new rate limit for a zone. Refer to the object definition for a list
     * of required attributes.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    create(params: RateLimitCreateParams, options?: Core.RequestOptions): Core.APIPromise<RateLimit>;
    /**
     * Fetches the rate limits for a zone.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    list(params: RateLimitListParams, options?: Core.RequestOptions): Core.PagePromise<RateLimitsV4PagePaginationArray, RateLimit>;
    /**
     * Deletes an existing rate limit.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    delete(rateLimitId: string, params: RateLimitDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RateLimitDeleteResponse>;
    /**
     * Updates an existing rate limit.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    edit(rateLimitId: string, params: RateLimitEditParams, options?: Core.RequestOptions): Core.APIPromise<RateLimit>;
    /**
     * Fetches the details of a rate limit.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    get(rateLimitId: string, params: RateLimitGetParams, options?: Core.RequestOptions): Core.APIPromise<RateLimit>;
}
export declare class RateLimitsV4PagePaginationArray extends V4PagePaginationArray<RateLimit> {
}
/**
 * The action to apply to a matched request. The `log` action is only available on
 * an Enterprise plan.
 */
export type Action = 'block' | 'challenge' | 'js_challenge' | 'managed_challenge' | 'allow' | 'log' | 'bypass';
export interface RateLimit {
    /**
     * The unique identifier of the rate limit.
     */
    id?: string;
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    action?: RateLimit.Action;
    /**
     * Criteria specifying when the current rate limit should be bypassed. You can
     * specify that the rate limit should not apply to one or more URLs.
     */
    bypass?: Array<RateLimit.Bypass>;
    /**
     * An informative summary of the rule. This value is sanitized and any tags will be
     * removed.
     */
    description?: string;
    /**
     * When true, indicates that the rate limit is currently disabled.
     */
    disabled?: boolean;
    /**
     * Determines which traffic the rate limit counts towards the threshold.
     */
    match?: RateLimit.Match;
    /**
     * The time in seconds (an integer value) to count matching traffic. If the count
     * exceeds the configured threshold within this period, Cloudflare will perform the
     * configured action.
     */
    period?: number;
    /**
     * The threshold that will trigger the configured mitigation action. Configure this
     * value along with the `period` property to establish a threshold per period.
     */
    threshold?: number;
}
export declare namespace RateLimit {
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    interface Action {
        /**
         * The action to perform.
         */
        mode?: 'simulate' | 'ban' | 'challenge' | 'js_challenge' | 'managed_challenge';
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        response?: Action.Response;
        /**
         * The time in seconds during which Cloudflare will perform the mitigation action.
         * Must be an integer value greater than or equal to the period. Notes: If "mode"
         * is "challenge", "managed_challenge", or "js_challenge", Cloudflare will use the
         * zone's Challenge Passage time and you should not provide this value.
         */
        timeout?: number;
    }
    namespace Action {
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        interface Response {
            /**
             * The response body to return. The value must conform to the configured content
             * type.
             */
            body?: string;
            /**
             * The content type of the body. Must be one of the following: `text/plain`,
             * `text/xml`, or `application/json`.
             */
            content_type?: string;
        }
    }
    interface Bypass {
        name?: 'url';
        /**
         * The URL to bypass.
         */
        value?: string;
    }
    /**
     * Determines which traffic the rate limit counts towards the threshold.
     */
    interface Match {
        headers?: Array<Match.Header>;
        request?: Match.Request;
        response?: Match.Response;
    }
    namespace Match {
        interface Header {
            /**
             * The name of the response header to match.
             */
            name?: string;
            /**
             * The operator used when matching: `eq` means "equal" and `ne` means "not equal".
             */
            op?: 'eq' | 'ne';
            /**
             * The value of the response header, which must match exactly.
             */
            value?: string;
        }
        interface Request {
            /**
             * The HTTP methods to match. You can specify a subset (for example,
             * `['POST','PUT']`) or all methods (`['_ALL_']`). This field is optional when
             * creating a rate limit.
             */
            methods?: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | '_ALL_'>;
            /**
             * The HTTP schemes to match. You can specify one scheme (`['HTTPS']`), both
             * schemes (`['HTTP','HTTPS']`), or all schemes (`['_ALL_']`). This field is
             * optional.
             */
            schemes?: Array<string>;
            /**
             * The URL pattern to match, composed of a host and a path such as
             * `example.org/path*`. Normalization is applied before the pattern is matched. `*`
             * wildcards are expanded to match applicable traffic. Query strings are not
             * matched. Set the value to `*` to match all traffic to your zone.
             */
            url?: string;
        }
        interface Response {
            /**
             * When true, only the uncached traffic served from your origin servers will count
             * towards rate limiting. In this case, any cached traffic served by Cloudflare
             * will not count towards rate limiting. This field is optional. Notes: This field
             * is deprecated. Instead, use response headers and set "origin_traffic" to "false"
             * to avoid legacy behaviour interacting with the "response_headers" property.
             */
            origin_traffic?: boolean;
        }
    }
}
export interface RateLimitDeleteResponse {
    /**
     * The unique identifier of the rate limit.
     */
    id?: string;
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    action?: RateLimitDeleteResponse.Action;
    /**
     * Criteria specifying when the current rate limit should be bypassed. You can
     * specify that the rate limit should not apply to one or more URLs.
     */
    bypass?: Array<RateLimitDeleteResponse.Bypass>;
    /**
     * An informative summary of the rule. This value is sanitized and any tags will be
     * removed.
     */
    description?: string;
    /**
     * When true, indicates that the rate limit is currently disabled.
     */
    disabled?: boolean;
    /**
     * Determines which traffic the rate limit counts towards the threshold.
     */
    match?: RateLimitDeleteResponse.Match;
    /**
     * The time in seconds (an integer value) to count matching traffic. If the count
     * exceeds the configured threshold within this period, Cloudflare will perform the
     * configured action.
     */
    period?: number;
    /**
     * The threshold that will trigger the configured mitigation action. Configure this
     * value along with the `period` property to establish a threshold per period.
     */
    threshold?: number;
}
export declare namespace RateLimitDeleteResponse {
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    interface Action {
        /**
         * The action to perform.
         */
        mode?: 'simulate' | 'ban' | 'challenge' | 'js_challenge' | 'managed_challenge';
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        response?: Action.Response;
        /**
         * The time in seconds during which Cloudflare will perform the mitigation action.
         * Must be an integer value greater than or equal to the period. Notes: If "mode"
         * is "challenge", "managed_challenge", or "js_challenge", Cloudflare will use the
         * zone's Challenge Passage time and you should not provide this value.
         */
        timeout?: number;
    }
    namespace Action {
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        interface Response {
            /**
             * The response body to return. The value must conform to the configured content
             * type.
             */
            body?: string;
            /**
             * The content type of the body. Must be one of the following: `text/plain`,
             * `text/xml`, or `application/json`.
             */
            content_type?: string;
        }
    }
    interface Bypass {
        name?: 'url';
        /**
         * The URL to bypass.
         */
        value?: string;
    }
    /**
     * Determines which traffic the rate limit counts towards the threshold.
     */
    interface Match {
        headers?: Array<Match.Header>;
        request?: Match.Request;
        response?: Match.Response;
    }
    namespace Match {
        interface Header {
            /**
             * The name of the response header to match.
             */
            name?: string;
            /**
             * The operator used when matching: `eq` means "equal" and `ne` means "not equal".
             */
            op?: 'eq' | 'ne';
            /**
             * The value of the response header, which must match exactly.
             */
            value?: string;
        }
        interface Request {
            /**
             * The HTTP methods to match. You can specify a subset (for example,
             * `['POST','PUT']`) or all methods (`['_ALL_']`). This field is optional when
             * creating a rate limit.
             */
            methods?: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | '_ALL_'>;
            /**
             * The HTTP schemes to match. You can specify one scheme (`['HTTPS']`), both
             * schemes (`['HTTP','HTTPS']`), or all schemes (`['_ALL_']`). This field is
             * optional.
             */
            schemes?: Array<string>;
            /**
             * The URL pattern to match, composed of a host and a path such as
             * `example.org/path*`. Normalization is applied before the pattern is matched. `*`
             * wildcards are expanded to match applicable traffic. Query strings are not
             * matched. Set the value to `*` to match all traffic to your zone.
             */
            url?: string;
        }
        interface Response {
            /**
             * When true, only the uncached traffic served from your origin servers will count
             * towards rate limiting. In this case, any cached traffic served by Cloudflare
             * will not count towards rate limiting. This field is optional. Notes: This field
             * is deprecated. Instead, use response headers and set "origin_traffic" to "false"
             * to avoid legacy behaviour interacting with the "response_headers" property.
             */
            origin_traffic?: boolean;
        }
    }
}
export interface RateLimitCreateParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: The action to perform when the threshold of matched traffic within
     * the configured period is exceeded.
     */
    action: RateLimitCreateParams.Action;
    /**
     * Body param: Determines which traffic the rate limit counts towards the
     * threshold.
     */
    match: RateLimitCreateParams.Match;
    /**
     * Body param: The time in seconds (an integer value) to count matching traffic. If
     * the count exceeds the configured threshold within this period, Cloudflare will
     * perform the configured action.
     */
    period: number;
    /**
     * Body param: The threshold that will trigger the configured mitigation action.
     * Configure this value along with the `period` property to establish a threshold
     * per period.
     */
    threshold: number;
}
export declare namespace RateLimitCreateParams {
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    interface Action {
        /**
         * The action to perform.
         */
        mode?: 'simulate' | 'ban' | 'challenge' | 'js_challenge' | 'managed_challenge';
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        response?: Action.Response;
        /**
         * The time in seconds during which Cloudflare will perform the mitigation action.
         * Must be an integer value greater than or equal to the period. Notes: If "mode"
         * is "challenge", "managed_challenge", or "js_challenge", Cloudflare will use the
         * zone's Challenge Passage time and you should not provide this value.
         */
        timeout?: number;
    }
    namespace Action {
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        interface Response {
            /**
             * The response body to return. The value must conform to the configured content
             * type.
             */
            body?: string;
            /**
             * The content type of the body. Must be one of the following: `text/plain`,
             * `text/xml`, or `application/json`.
             */
            content_type?: string;
        }
    }
    /**
     * Determines which traffic the rate limit counts towards the threshold.
     */
    interface Match {
        headers?: Array<Match.Header>;
        request?: Match.Request;
        response?: Match.Response;
    }
    namespace Match {
        interface Header {
            /**
             * The name of the response header to match.
             */
            name?: string;
            /**
             * The operator used when matching: `eq` means "equal" and `ne` means "not equal".
             */
            op?: 'eq' | 'ne';
            /**
             * The value of the response header, which must match exactly.
             */
            value?: string;
        }
        interface Request {
            /**
             * The HTTP methods to match. You can specify a subset (for example,
             * `['POST','PUT']`) or all methods (`['_ALL_']`). This field is optional when
             * creating a rate limit.
             */
            methods?: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | '_ALL_'>;
            /**
             * The HTTP schemes to match. You can specify one scheme (`['HTTPS']`), both
             * schemes (`['HTTP','HTTPS']`), or all schemes (`['_ALL_']`). This field is
             * optional.
             */
            schemes?: Array<string>;
            /**
             * The URL pattern to match, composed of a host and a path such as
             * `example.org/path*`. Normalization is applied before the pattern is matched. `*`
             * wildcards are expanded to match applicable traffic. Query strings are not
             * matched. Set the value to `*` to match all traffic to your zone.
             */
            url?: string;
        }
        interface Response {
            /**
             * When true, only the uncached traffic served from your origin servers will count
             * towards rate limiting. In this case, any cached traffic served by Cloudflare
             * will not count towards rate limiting. This field is optional. Notes: This field
             * is deprecated. Instead, use response headers and set "origin_traffic" to "false"
             * to avoid legacy behaviour interacting with the "response_headers" property.
             */
            origin_traffic?: boolean;
        }
    }
}
export interface RateLimitListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
}
export interface RateLimitDeleteParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export interface RateLimitEditParams {
    /**
     * Path param: Defines an identifier.
     */
    zone_id: string;
    /**
     * Body param: The action to perform when the threshold of matched traffic within
     * the configured period is exceeded.
     */
    action: RateLimitEditParams.Action;
    /**
     * Body param: Determines which traffic the rate limit counts towards the
     * threshold.
     */
    match: RateLimitEditParams.Match;
    /**
     * Body param: The time in seconds (an integer value) to count matching traffic. If
     * the count exceeds the configured threshold within this period, Cloudflare will
     * perform the configured action.
     */
    period: number;
    /**
     * Body param: The threshold that will trigger the configured mitigation action.
     * Configure this value along with the `period` property to establish a threshold
     * per period.
     */
    threshold: number;
}
export declare namespace RateLimitEditParams {
    /**
     * The action to perform when the threshold of matched traffic within the
     * configured period is exceeded.
     */
    interface Action {
        /**
         * The action to perform.
         */
        mode?: 'simulate' | 'ban' | 'challenge' | 'js_challenge' | 'managed_challenge';
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        response?: Action.Response;
        /**
         * The time in seconds during which Cloudflare will perform the mitigation action.
         * Must be an integer value greater than or equal to the period. Notes: If "mode"
         * is "challenge", "managed_challenge", or "js_challenge", Cloudflare will use the
         * zone's Challenge Passage time and you should not provide this value.
         */
        timeout?: number;
    }
    namespace Action {
        /**
         * A custom content type and reponse to return when the threshold is exceeded. The
         * custom response configured in this object will override the custom error for the
         * zone. This object is optional. Notes: If you omit this object, Cloudflare will
         * use the default HTML error page. If "mode" is "challenge", "managed_challenge",
         * or "js_challenge", Cloudflare will use the zone challenge pages and you should
         * not provide the "response" object.
         */
        interface Response {
            /**
             * The response body to return. The value must conform to the configured content
             * type.
             */
            body?: string;
            /**
             * The content type of the body. Must be one of the following: `text/plain`,
             * `text/xml`, or `application/json`.
             */
            content_type?: string;
        }
    }
    /**
     * Determines which traffic the rate limit counts towards the threshold.
     */
    interface Match {
        headers?: Array<Match.Header>;
        request?: Match.Request;
        response?: Match.Response;
    }
    namespace Match {
        interface Header {
            /**
             * The name of the response header to match.
             */
            name?: string;
            /**
             * The operator used when matching: `eq` means "equal" and `ne` means "not equal".
             */
            op?: 'eq' | 'ne';
            /**
             * The value of the response header, which must match exactly.
             */
            value?: string;
        }
        interface Request {
            /**
             * The HTTP methods to match. You can specify a subset (for example,
             * `['POST','PUT']`) or all methods (`['_ALL_']`). This field is optional when
             * creating a rate limit.
             */
            methods?: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | '_ALL_'>;
            /**
             * The HTTP schemes to match. You can specify one scheme (`['HTTPS']`), both
             * schemes (`['HTTP','HTTPS']`), or all schemes (`['_ALL_']`). This field is
             * optional.
             */
            schemes?: Array<string>;
            /**
             * The URL pattern to match, composed of a host and a path such as
             * `example.org/path*`. Normalization is applied before the pattern is matched. `*`
             * wildcards are expanded to match applicable traffic. Query strings are not
             * matched. Set the value to `*` to match all traffic to your zone.
             */
            url?: string;
        }
        interface Response {
            /**
             * When true, only the uncached traffic served from your origin servers will count
             * towards rate limiting. In this case, any cached traffic served by Cloudflare
             * will not count towards rate limiting. This field is optional. Notes: This field
             * is deprecated. Instead, use response headers and set "origin_traffic" to "false"
             * to avoid legacy behaviour interacting with the "response_headers" property.
             */
            origin_traffic?: boolean;
        }
    }
}
export interface RateLimitGetParams {
    /**
     * Defines an identifier.
     */
    zone_id: string;
}
export declare namespace RateLimits {
    export { type Action as Action, type RateLimit as RateLimit, type RateLimitDeleteResponse as RateLimitDeleteResponse, RateLimitsV4PagePaginationArray as RateLimitsV4PagePaginationArray, type RateLimitCreateParams as RateLimitCreateParams, type RateLimitListParams as RateLimitListParams, type RateLimitDeleteParams as RateLimitDeleteParams, type RateLimitEditParams as RateLimitEditParams, type RateLimitGetParams as RateLimitGetParams, };
}
//# sourceMappingURL=rate-limits.d.ts.map