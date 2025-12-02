import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Widgets extends APIResource {
    /**
     * Lists challenge widgets.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   domains: [
     *     '203.0.113.1',
     *     'cloudflare.com',
     *     'blog.example.com',
     *   ],
     *   mode: 'invisible',
     *   name: 'blog.cloudflare.com login form',
     * });
     * ```
     */
    create(params: WidgetCreateParams, options?: Core.RequestOptions): Core.APIPromise<Widget>;
    /**
     * Update the configuration of a widget.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.update(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     domains: [
     *       '203.0.113.1',
     *       'cloudflare.com',
     *       'blog.example.com',
     *     ],
     *     mode: 'invisible',
     *     name: 'blog.cloudflare.com login form',
     *   },
     * );
     * ```
     */
    update(sitekey: string, params: WidgetUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Widget>;
    /**
     * Lists all turnstile widgets of an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const widgetListResponse of client.turnstile.widgets.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: WidgetListParams, options?: Core.RequestOptions): Core.PagePromise<WidgetListResponsesV4PagePaginationArray, WidgetListResponse>;
    /**
     * Destroy a Turnstile Widget.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.delete(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(sitekey: string, params: WidgetDeleteParams, options?: Core.RequestOptions): Core.APIPromise<Widget>;
    /**
     * Show a single challenge widget configuration.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.get(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(sitekey: string, params: WidgetGetParams, options?: Core.RequestOptions): Core.APIPromise<Widget>;
    /**
     * Generate a new secret key for this widget. If `invalidate_immediately` is set to
     * `false`, the previous secret remains valid for 2 hours.
     *
     * Note that secrets cannot be rotated again during the grace period.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.rotateSecret(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    rotateSecret(sitekey: string, params: WidgetRotateSecretParams, options?: Core.RequestOptions): Core.APIPromise<Widget>;
}
export declare class WidgetListResponsesV4PagePaginationArray extends V4PagePaginationArray<WidgetListResponse> {
}
/**
 * A Turnstile widget's detailed configuration
 */
export interface Widget {
    /**
     * If bot_fight_mode is set to `true`, Cloudflare issues computationally expensive
     * challenges in response to malicious bots (ENT only).
     */
    bot_fight_mode: boolean;
    /**
     * If Turnstile is embedded on a Cloudflare site and the widget should grant
     * challenge clearance, this setting can determine the clearance level to be set
     */
    clearance_level: 'no_clearance' | 'jschallenge' | 'managed' | 'interactive';
    /**
     * When the widget was created.
     */
    created_on: string;
    domains: Array<WidgetDomain>;
    /**
     * Return the Ephemeral ID in /siteverify (ENT only).
     */
    ephemeral_id: boolean;
    /**
     * Widget Mode
     */
    mode: 'non-interactive' | 'invisible' | 'managed';
    /**
     * When the widget was modified.
     */
    modified_on: string;
    /**
     * Human readable widget name. Not unique. Cloudflare suggests that you set this to
     * a meaningful string to make it easier to identify your widget, and where it is
     * used.
     */
    name: string;
    /**
     * Do not show any Cloudflare branding on the widget (ENT only).
     */
    offlabel: boolean;
    /**
     * Region where this widget can be used. This cannot be changed after creation.
     */
    region: 'world' | 'china';
    /**
     * Secret key for this widget.
     */
    secret: string;
    /**
     * Widget item identifier tag.
     */
    sitekey: string;
}
/**
 * Hosts as a hostname or IPv4/IPv6 address represented by strings. The widget will
 * only work on these domains, and their subdomains.
 */
export type WidgetDomain = string;
/**
 * Hosts as a hostname or IPv4/IPv6 address represented by strings. The widget will
 * only work on these domains, and their subdomains.
 */
export type WidgetDomainParam = string;
/**
 * A Turnstile Widgets configuration as it appears in listings
 */
export interface WidgetListResponse {
    /**
     * If bot_fight_mode is set to `true`, Cloudflare issues computationally expensive
     * challenges in response to malicious bots (ENT only).
     */
    bot_fight_mode: boolean;
    /**
     * If Turnstile is embedded on a Cloudflare site and the widget should grant
     * challenge clearance, this setting can determine the clearance level to be set
     */
    clearance_level: 'no_clearance' | 'jschallenge' | 'managed' | 'interactive';
    /**
     * When the widget was created.
     */
    created_on: string;
    domains: Array<WidgetDomain>;
    /**
     * Return the Ephemeral ID in /siteverify (ENT only).
     */
    ephemeral_id: boolean;
    /**
     * Widget Mode
     */
    mode: 'non-interactive' | 'invisible' | 'managed';
    /**
     * When the widget was modified.
     */
    modified_on: string;
    /**
     * Human readable widget name. Not unique. Cloudflare suggests that you set this to
     * a meaningful string to make it easier to identify your widget, and where it is
     * used.
     */
    name: string;
    /**
     * Do not show any Cloudflare branding on the widget (ENT only).
     */
    offlabel: boolean;
    /**
     * Region where this widget can be used. This cannot be changed after creation.
     */
    region: 'world' | 'china';
    /**
     * Widget item identifier tag.
     */
    sitekey: string;
}
export interface WidgetCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    domains: Array<WidgetDomainParam>;
    /**
     * Body param: Widget Mode
     */
    mode: 'non-interactive' | 'invisible' | 'managed';
    /**
     * Body param: Human readable widget name. Not unique. Cloudflare suggests that you
     * set this to a meaningful string to make it easier to identify your widget, and
     * where it is used.
     */
    name: string;
    /**
     * Query param: Direction to order widgets.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Field to order widgets by.
     */
    order?: 'id' | 'sitekey' | 'name' | 'created_on' | 'modified_on';
    /**
     * Query param: Page number of paginated results.
     */
    page?: number;
    /**
     * Query param: Number of items per page.
     */
    per_page?: number;
    /**
     * Body param: If bot_fight_mode is set to `true`, Cloudflare issues
     * computationally expensive challenges in response to malicious bots (ENT only).
     */
    bot_fight_mode?: boolean;
    /**
     * Body param: If Turnstile is embedded on a Cloudflare site and the widget should
     * grant challenge clearance, this setting can determine the clearance level to be
     * set
     */
    clearance_level?: 'no_clearance' | 'jschallenge' | 'managed' | 'interactive';
    /**
     * Body param: Return the Ephemeral ID in /siteverify (ENT only).
     */
    ephemeral_id?: boolean;
    /**
     * Body param: Do not show any Cloudflare branding on the widget (ENT only).
     */
    offlabel?: boolean;
    /**
     * Body param: Region where this widget can be used. This cannot be changed after
     * creation.
     */
    region?: 'world' | 'china';
}
export interface WidgetUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    domains: Array<WidgetDomainParam>;
    /**
     * Body param: Widget Mode
     */
    mode: 'non-interactive' | 'invisible' | 'managed';
    /**
     * Body param: Human readable widget name. Not unique. Cloudflare suggests that you
     * set this to a meaningful string to make it easier to identify your widget, and
     * where it is used.
     */
    name: string;
    /**
     * Body param: If bot_fight_mode is set to `true`, Cloudflare issues
     * computationally expensive challenges in response to malicious bots (ENT only).
     */
    bot_fight_mode?: boolean;
    /**
     * Body param: If Turnstile is embedded on a Cloudflare site and the widget should
     * grant challenge clearance, this setting can determine the clearance level to be
     * set
     */
    clearance_level?: 'no_clearance' | 'jschallenge' | 'managed' | 'interactive';
    /**
     * Body param: Return the Ephemeral ID in /siteverify (ENT only).
     */
    ephemeral_id?: boolean;
    /**
     * Body param: Do not show any Cloudflare branding on the widget (ENT only).
     */
    offlabel?: boolean;
    /**
     * Body param: Region where this widget can be used. This cannot be changed after
     * creation.
     */
    region?: 'world' | 'china';
}
export interface WidgetListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Query param: Direction to order widgets.
     */
    direction?: 'asc' | 'desc';
    /**
     * Query param: Field to order widgets by.
     */
    order?: 'id' | 'sitekey' | 'name' | 'created_on' | 'modified_on';
}
export interface WidgetDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface WidgetGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface WidgetRotateSecretParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: If `invalidate_immediately` is set to `false`, the previous secret
     * will remain valid for two hours. Otherwise, the secret is immediately
     * invalidated, and requests using it will be rejected.
     */
    invalidate_immediately?: boolean;
}
export declare namespace Widgets {
    export { type Widget as Widget, type WidgetDomain as WidgetDomain, type WidgetListResponse as WidgetListResponse, WidgetListResponsesV4PagePaginationArray as WidgetListResponsesV4PagePaginationArray, type WidgetCreateParams as WidgetCreateParams, type WidgetUpdateParams as WidgetUpdateParams, type WidgetListParams as WidgetListParams, type WidgetDeleteParams as WidgetDeleteParams, type WidgetGetParams as WidgetGetParams, type WidgetRotateSecretParams as WidgetRotateSecretParams, };
}
//# sourceMappingURL=widgets.d.ts.map