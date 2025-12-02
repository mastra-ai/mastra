// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class BotManagement extends APIResource {
  /**
   * Updates the Bot Management configuration for a zone.
   *
   * This API is used to update:
   *
   * - **Bot Fight Mode**
   * - **Super Bot Fight Mode**
   * - **Bot Management for Enterprise**
   *
   * See [Bot Plans](https://developers.cloudflare.com/bots/plans/) for more
   * information on the different plans \
   * If you recently upgraded or downgraded your plan, refer to the following examples
   * to clean up old configurations. Copy and paste the example body to remove old zone
   * configurations based on your current plan.
   *
   * #### Clean up configuration for Bot Fight Mode plan
   *
   * ```json
   * {
   *   "sbfm_likely_automated": "allow",
   *   "sbfm_definitely_automated": "allow",
   *   "sbfm_verified_bots": "allow",
   *   "sbfm_static_resource_protection": false,
   *   "optimize_wordpress": false,
   *   "suppress_session_score": false
   * }
   * ```
   *
   * #### Clean up configuration for SBFM Pro plan
   *
   * ```json
   * {
   *   "sbfm_likely_automated": "allow",
   *   "fight_mode": false
   * }
   * ```
   *
   * #### Clean up configuration for SBFM Biz plan
   *
   * ```json
   * {
   *   "fight_mode": false
   * }
   * ```
   *
   * #### Clean up configuration for BM Enterprise Subscription plan
   *
   * It is strongly recommended that you ensure you have
   * [custom rules](https://developers.cloudflare.com/waf/custom-rules/) in place to
   * protect your zone before disabling the SBFM rules. Without these protections,
   * your zone is vulnerable to attacks.
   *
   * ```json
   * {
   *   "sbfm_likely_automated": "allow",
   *   "sbfm_definitely_automated": "allow",
   *   "sbfm_verified_bots": "allow",
   *   "sbfm_static_resource_protection": false,
   *   "optimize_wordpress": false,
   *   "fight_mode": false
   * }
   * ```
   *
   * @example
   * ```ts
   * const botManagement = await client.botManagement.update({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   ai_bots_protection: 'disabled',
   *   crawler_protection: 'disabled',
   *   enable_js: true,
   *   fight_mode: true,
   * });
   * ```
   */
  update(
    params: BotManagementUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BotManagementUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/bot_management`, { body, ...options }) as Core.APIPromise<{
        result: BotManagementUpdateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieve a zone's Bot Management Config
   *
   * @example
   * ```ts
   * const botManagement = await client.botManagement.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(
    params: BotManagementGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BotManagementGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/bot_management`, options) as Core.APIPromise<{
        result: BotManagementGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface BotFightModeConfiguration {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to enable Bot Fight Mode.
   */
  fight_mode?: boolean;

  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  stale_zone_configuration?: BotFightModeConfiguration.StaleZoneConfiguration;

  /**
   * A read-only field that indicates whether the zone currently is running the
   * latest ML model.
   */
  using_latest_model?: boolean;
}

export namespace BotFightModeConfiguration {
  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  export interface StaleZoneConfiguration {
    /**
     * Indicates that the zone's wordpress optimization for SBFM is turned on.
     */
    optimize_wordpress?: boolean;

    /**
     * Indicates that the zone's definitely automated requests are being blocked or
     * challenged.
     */
    sbfm_definitely_automated?: string;

    /**
     * Indicates that the zone's likely automated requests are being blocked or
     * challenged.
     */
    sbfm_likely_automated?: string;

    /**
     * Indicates that the zone's static resource protection is turned on.
     */
    sbfm_static_resource_protection?: string;

    /**
     * Indicates that the zone's verified bot requests are being blocked.
     */
    sbfm_verified_bots?: string;

    /**
     * Indicates that the zone's session score tracking is disabled.
     */
    suppress_session_score?: boolean;
  }
}

export interface BotFightModeConfigurationParam {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to enable Bot Fight Mode.
   */
  fight_mode?: boolean;
}

export interface SubscriptionConfiguration {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Automatically update to the newest bot detection models created by Cloudflare as
   * they are released.
   * [Learn more.](https://developers.cloudflare.com/bots/reference/machine-learning-models#model-versions-and-release-notes)
   */
  auto_update_model?: boolean;

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  stale_zone_configuration?: SubscriptionConfiguration.StaleZoneConfiguration;

  /**
   * Whether to disable tracking the highest bot score for a session in the Bot
   * Management cookie.
   */
  suppress_session_score?: boolean;

  /**
   * A read-only field that indicates whether the zone currently is running the
   * latest ML model.
   */
  using_latest_model?: boolean;
}

export namespace SubscriptionConfiguration {
  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  export interface StaleZoneConfiguration {
    /**
     * Indicates that the zone's Bot Fight Mode is turned on.
     */
    fight_mode?: boolean;

    /**
     * Indicates that the zone's wordpress optimization for SBFM is turned on.
     */
    optimize_wordpress?: boolean;

    /**
     * Indicates that the zone's definitely automated requests are being blocked or
     * challenged.
     */
    sbfm_definitely_automated?: string;

    /**
     * Indicates that the zone's likely automated requests are being blocked or
     * challenged.
     */
    sbfm_likely_automated?: string;

    /**
     * Indicates that the zone's static resource protection is turned on.
     */
    sbfm_static_resource_protection?: string;

    /**
     * Indicates that the zone's verified bot requests are being blocked.
     */
    sbfm_verified_bots?: string;
  }
}

export interface SubscriptionConfigurationParam {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Automatically update to the newest bot detection models created by Cloudflare as
   * they are released.
   * [Learn more.](https://developers.cloudflare.com/bots/reference/machine-learning-models#model-versions-and-release-notes)
   */
  auto_update_model?: boolean;

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to disable tracking the highest bot score for a session in the Bot
   * Management cookie.
   */
  suppress_session_score?: boolean;
}

export interface SuperBotFightModeDefinitelyConfiguration {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to optimize Super Bot Fight Mode protections for Wordpress.
   */
  optimize_wordpress?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on definitely automated requests.
   */
  sbfm_definitely_automated?: 'allow' | 'block' | 'managed_challenge';

  /**
   * Super Bot Fight Mode (SBFM) to enable static resource protection. Enable if
   * static resources on your application need bot protection. Note: Static resource
   * protection can also result in legitimate traffic being blocked.
   */
  sbfm_static_resource_protection?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on verified bots requests.
   */
  sbfm_verified_bots?: 'allow' | 'block';

  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  stale_zone_configuration?: SuperBotFightModeDefinitelyConfiguration.StaleZoneConfiguration;

  /**
   * A read-only field that indicates whether the zone currently is running the
   * latest ML model.
   */
  using_latest_model?: boolean;
}

export namespace SuperBotFightModeDefinitelyConfiguration {
  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  export interface StaleZoneConfiguration {
    /**
     * Indicates that the zone's Bot Fight Mode is turned on.
     */
    fight_mode?: boolean;

    /**
     * Indicates that the zone's likely automated requests are being blocked or
     * challenged.
     */
    sbfm_likely_automated?: string;
  }
}

export interface SuperBotFightModeDefinitelyConfigurationParam {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to optimize Super Bot Fight Mode protections for Wordpress.
   */
  optimize_wordpress?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on definitely automated requests.
   */
  sbfm_definitely_automated?: 'allow' | 'block' | 'managed_challenge';

  /**
   * Super Bot Fight Mode (SBFM) to enable static resource protection. Enable if
   * static resources on your application need bot protection. Note: Static resource
   * protection can also result in legitimate traffic being blocked.
   */
  sbfm_static_resource_protection?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on verified bots requests.
   */
  sbfm_verified_bots?: 'allow' | 'block';
}

export interface SuperBotFightModeLikelyConfiguration {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to optimize Super Bot Fight Mode protections for Wordpress.
   */
  optimize_wordpress?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on definitely automated requests.
   */
  sbfm_definitely_automated?: 'allow' | 'block' | 'managed_challenge';

  /**
   * Super Bot Fight Mode (SBFM) action to take on likely automated requests.
   */
  sbfm_likely_automated?: 'allow' | 'block' | 'managed_challenge';

  /**
   * Super Bot Fight Mode (SBFM) to enable static resource protection. Enable if
   * static resources on your application need bot protection. Note: Static resource
   * protection can also result in legitimate traffic being blocked.
   */
  sbfm_static_resource_protection?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on verified bots requests.
   */
  sbfm_verified_bots?: 'allow' | 'block';

  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  stale_zone_configuration?: SuperBotFightModeLikelyConfiguration.StaleZoneConfiguration;

  /**
   * A read-only field that indicates whether the zone currently is running the
   * latest ML model.
   */
  using_latest_model?: boolean;
}

export namespace SuperBotFightModeLikelyConfiguration {
  /**
   * A read-only field that shows which unauthorized settings are currently active on
   * the zone. These settings typically result from upgrades or downgrades.
   */
  export interface StaleZoneConfiguration {
    /**
     * Indicates that the zone's Bot Fight Mode is turned on.
     */
    fight_mode?: boolean;
  }
}

export interface SuperBotFightModeLikelyConfigurationParam {
  /**
   * Enable rule to block AI Scrapers and Crawlers. Please note the value
   * `only_on_ad_pages` is currently not available for Enterprise customers.
   */
  ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

  /**
   * Enable rule to punish AI Scrapers and Crawlers via a link maze.
   */
  crawler_protection?: 'enabled' | 'disabled';

  /**
   * Use lightweight, invisible JavaScript detections to improve Bot Management.
   * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
   */
  enable_js?: boolean;

  /**
   * Whether to optimize Super Bot Fight Mode protections for Wordpress.
   */
  optimize_wordpress?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on definitely automated requests.
   */
  sbfm_definitely_automated?: 'allow' | 'block' | 'managed_challenge';

  /**
   * Super Bot Fight Mode (SBFM) action to take on likely automated requests.
   */
  sbfm_likely_automated?: 'allow' | 'block' | 'managed_challenge';

  /**
   * Super Bot Fight Mode (SBFM) to enable static resource protection. Enable if
   * static resources on your application need bot protection. Note: Static resource
   * protection can also result in legitimate traffic being blocked.
   */
  sbfm_static_resource_protection?: boolean;

  /**
   * Super Bot Fight Mode (SBFM) action to take on verified bots requests.
   */
  sbfm_verified_bots?: 'allow' | 'block';
}

export type BotManagementUpdateResponse =
  | BotFightModeConfiguration
  | SuperBotFightModeDefinitelyConfiguration
  | SuperBotFightModeLikelyConfiguration
  | SubscriptionConfiguration;

export type BotManagementGetResponse =
  | BotFightModeConfiguration
  | SuperBotFightModeDefinitelyConfiguration
  | SuperBotFightModeLikelyConfiguration
  | SubscriptionConfiguration;

export type BotManagementUpdateParams =
  | BotManagementUpdateParams.BotFightModeConfiguration
  | BotManagementUpdateParams.SuperBotFightModeDefinitelyConfiguration
  | BotManagementUpdateParams.SuperBotFightModeLikelyConfiguration
  | BotManagementUpdateParams.SubscriptionConfiguration;

export declare namespace BotManagementUpdateParams {
  export interface BotFightModeConfiguration {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: Enable rule to block AI Scrapers and Crawlers. Please note the value
     * `only_on_ad_pages` is currently not available for Enterprise customers.
     */
    ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

    /**
     * Body param: Enable rule to punish AI Scrapers and Crawlers via a link maze.
     */
    crawler_protection?: 'enabled' | 'disabled';

    /**
     * Body param: Use lightweight, invisible JavaScript detections to improve Bot
     * Management.
     * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
     */
    enable_js?: boolean;

    /**
     * Body param: Whether to enable Bot Fight Mode.
     */
    fight_mode?: boolean;
  }

  export interface SuperBotFightModeDefinitelyConfiguration {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: Enable rule to block AI Scrapers and Crawlers. Please note the value
     * `only_on_ad_pages` is currently not available for Enterprise customers.
     */
    ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

    /**
     * Body param: Enable rule to punish AI Scrapers and Crawlers via a link maze.
     */
    crawler_protection?: 'enabled' | 'disabled';

    /**
     * Body param: Use lightweight, invisible JavaScript detections to improve Bot
     * Management.
     * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
     */
    enable_js?: boolean;

    /**
     * Body param: Whether to optimize Super Bot Fight Mode protections for Wordpress.
     */
    optimize_wordpress?: boolean;

    /**
     * Body param: Super Bot Fight Mode (SBFM) action to take on definitely automated
     * requests.
     */
    sbfm_definitely_automated?: 'allow' | 'block' | 'managed_challenge';

    /**
     * Body param: Super Bot Fight Mode (SBFM) to enable static resource protection.
     * Enable if static resources on your application need bot protection. Note: Static
     * resource protection can also result in legitimate traffic being blocked.
     */
    sbfm_static_resource_protection?: boolean;

    /**
     * Body param: Super Bot Fight Mode (SBFM) action to take on verified bots
     * requests.
     */
    sbfm_verified_bots?: 'allow' | 'block';
  }

  export interface SuperBotFightModeLikelyConfiguration {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: Enable rule to block AI Scrapers and Crawlers. Please note the value
     * `only_on_ad_pages` is currently not available for Enterprise customers.
     */
    ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

    /**
     * Body param: Enable rule to punish AI Scrapers and Crawlers via a link maze.
     */
    crawler_protection?: 'enabled' | 'disabled';

    /**
     * Body param: Use lightweight, invisible JavaScript detections to improve Bot
     * Management.
     * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
     */
    enable_js?: boolean;

    /**
     * Body param: Whether to optimize Super Bot Fight Mode protections for Wordpress.
     */
    optimize_wordpress?: boolean;

    /**
     * Body param: Super Bot Fight Mode (SBFM) action to take on definitely automated
     * requests.
     */
    sbfm_definitely_automated?: 'allow' | 'block' | 'managed_challenge';

    /**
     * Body param: Super Bot Fight Mode (SBFM) action to take on likely automated
     * requests.
     */
    sbfm_likely_automated?: 'allow' | 'block' | 'managed_challenge';

    /**
     * Body param: Super Bot Fight Mode (SBFM) to enable static resource protection.
     * Enable if static resources on your application need bot protection. Note: Static
     * resource protection can also result in legitimate traffic being blocked.
     */
    sbfm_static_resource_protection?: boolean;

    /**
     * Body param: Super Bot Fight Mode (SBFM) action to take on verified bots
     * requests.
     */
    sbfm_verified_bots?: 'allow' | 'block';
  }

  export interface SubscriptionConfiguration {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: Enable rule to block AI Scrapers and Crawlers. Please note the value
     * `only_on_ad_pages` is currently not available for Enterprise customers.
     */
    ai_bots_protection?: 'block' | 'disabled' | 'only_on_ad_pages';

    /**
     * Body param: Automatically update to the newest bot detection models created by
     * Cloudflare as they are released.
     * [Learn more.](https://developers.cloudflare.com/bots/reference/machine-learning-models#model-versions-and-release-notes)
     */
    auto_update_model?: boolean;

    /**
     * Body param: Enable rule to punish AI Scrapers and Crawlers via a link maze.
     */
    crawler_protection?: 'enabled' | 'disabled';

    /**
     * Body param: Use lightweight, invisible JavaScript detections to improve Bot
     * Management.
     * [Learn more about JavaScript Detections](https://developers.cloudflare.com/bots/reference/javascript-detections/).
     */
    enable_js?: boolean;

    /**
     * Body param: Whether to disable tracking the highest bot score for a session in
     * the Bot Management cookie.
     */
    suppress_session_score?: boolean;
  }
}

export interface BotManagementGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace BotManagement {
  export {
    type BotFightModeConfiguration as BotFightModeConfiguration,
    type SubscriptionConfiguration as SubscriptionConfiguration,
    type SuperBotFightModeDefinitelyConfiguration as SuperBotFightModeDefinitelyConfiguration,
    type SuperBotFightModeLikelyConfiguration as SuperBotFightModeLikelyConfiguration,
    type BotManagementUpdateResponse as BotManagementUpdateResponse,
    type BotManagementGetResponse as BotManagementGetResponse,
    type BotManagementUpdateParams as BotManagementUpdateParams,
    type BotManagementGetParams as BotManagementGetParams,
  };
}
