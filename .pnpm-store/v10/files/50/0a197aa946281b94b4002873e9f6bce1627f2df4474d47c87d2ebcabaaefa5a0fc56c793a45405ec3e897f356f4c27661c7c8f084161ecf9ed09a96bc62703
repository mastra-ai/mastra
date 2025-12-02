// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import { isRequestOptions } from '../../core';
import * as Core from '../../core';
import * as PageAPI from './page';
import { Page, PagePreviewParams, PagePreviewResponse } from './page';
import * as RulesAPI from './rules';
import {
  RuleCreateParams,
  RuleDeleteParams,
  RuleEditParams,
  RuleGetParams,
  RuleUpdateParams,
  Rules,
  WaitingRoomRule,
  WaitingRoomRulesSinglePage,
} from './rules';
import * as SettingsAPI from './settings';
import {
  Setting,
  SettingEditParams,
  SettingEditResponse,
  SettingGetParams,
  SettingGetResponse,
  SettingUpdateParams,
  SettingUpdateResponse,
  Settings,
} from './settings';
import * as StatusesAPI from './statuses';
import { StatusGetParams, StatusGetResponse, Statuses } from './statuses';
import * as EventsAPI from './events/events';
import {
  Event,
  EventCreateParams,
  EventDeleteParams,
  EventDeleteResponse,
  EventEditParams,
  EventGetParams,
  EventListParams,
  EventUpdateParams,
  Events,
  EventsV4PagePaginationArray,
} from './events/events';
import { CloudflareError } from '../../error';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class WaitingRooms extends APIResource {
  page: PageAPI.Page = new PageAPI.Page(this._client);
  events: EventsAPI.Events = new EventsAPI.Events(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
  statuses: StatusesAPI.Statuses = new StatusesAPI.Statuses(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);

  /**
   * Creates a new waiting room.
   *
   * @example
   * ```ts
   * const waitingRoom = await client.waitingRooms.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   host: 'shop.example.com',
   *   name: 'production_webinar',
   *   new_users_per_minute: 200,
   *   total_active_users: 200,
   * });
   * ```
   */
  create(params: WaitingRoomCreateParams, options?: Core.RequestOptions): Core.APIPromise<WaitingRoom> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/waiting_rooms`, { body, ...options }) as Core.APIPromise<{
        result: WaitingRoom;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a configured waiting room.
   *
   * @example
   * ```ts
   * const waitingRoom = await client.waitingRooms.update(
   *   '699d98642c564d2e855e9661899b7252',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     host: 'shop.example.com',
   *     name: 'production_webinar',
   *     new_users_per_minute: 200,
   *     total_active_users: 200,
   *   },
   * );
   * ```
   */
  update(
    waitingRoomId: string,
    params: WaitingRoomUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WaitingRoom> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: WaitingRoom }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists waiting rooms for account or zone.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const waitingRoom of client.waitingRooms.list({
   *   account_id: 'account_id',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params?: WaitingRoomListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomsV4PagePaginationArray, WaitingRoom>;
  list(options?: Core.RequestOptions): Core.PagePromise<WaitingRoomsV4PagePaginationArray, WaitingRoom>;
  list(
    params: WaitingRoomListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<WaitingRoomsV4PagePaginationArray, WaitingRoom> {
    if (isRequestOptions(params)) {
      return this.list({}, params);
    }
    const { account_id, zone_id, ...query } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return this._client.getAPIList(
      `/${accountOrZone}/${accountOrZoneId}/waiting_rooms`,
      WaitingRoomsV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Deletes a waiting room.
   *
   * @example
   * ```ts
   * const waitingRoom = await client.waitingRooms.delete(
   *   '699d98642c564d2e855e9661899b7252',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    waitingRoomId: string,
    params: WaitingRoomDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WaitingRoomDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, options) as Core.APIPromise<{
        result: WaitingRoomDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Patches a configured waiting room.
   *
   * @example
   * ```ts
   * const waitingRoom = await client.waitingRooms.edit(
   *   '699d98642c564d2e855e9661899b7252',
   *   {
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     host: 'shop.example.com',
   *     name: 'production_webinar',
   *     new_users_per_minute: 200,
   *     total_active_users: 200,
   *   },
   * );
   * ```
   */
  edit(
    waitingRoomId: string,
    params: WaitingRoomEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WaitingRoom> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: WaitingRoom }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single configured waiting room.
   *
   * @example
   * ```ts
   * const waitingRoom = await client.waitingRooms.get(
   *   '699d98642c564d2e855e9661899b7252',
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    waitingRoomId: string,
    params: WaitingRoomGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<WaitingRoom> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, options) as Core.APIPromise<{
        result: WaitingRoom;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class WaitingRoomsV4PagePaginationArray extends V4PagePaginationArray<WaitingRoom> {}

export interface AdditionalRoutes {
  /**
   * The hostname to which this waiting room will be applied (no wildcards). The
   * hostname must be the primary domain, subdomain, or custom hostname (if using SSL
   * for SaaS) of this zone. Please do not include the scheme (http:// or https://).
   */
  host?: string;

  /**
   * Sets the path within the host to enable the waiting room on. The waiting room
   * will be enabled for all subpaths as well. If there are two waiting rooms on the
   * same subpath, the waiting room for the most specific path will be chosen.
   * Wildcards and query parameters are not supported.
   */
  path?: string;
}

export interface AdditionalRoutesParam {
  /**
   * The hostname to which this waiting room will be applied (no wildcards). The
   * hostname must be the primary domain, subdomain, or custom hostname (if using SSL
   * for SaaS) of this zone. Please do not include the scheme (http:// or https://).
   */
  host?: string;

  /**
   * Sets the path within the host to enable the waiting room on. The waiting room
   * will be enabled for all subpaths as well. If there are two waiting rooms on the
   * same subpath, the waiting room for the most specific path will be chosen.
   * Wildcards and query parameters are not supported.
   */
  path?: string;
}

/**
 * Configures cookie attributes for the waiting room cookie. This encrypted cookie
 * stores a user's status in the waiting room, such as queue position.
 */
export interface CookieAttributes {
  /**
   * Configures the SameSite attribute on the waiting room cookie. Value `auto` will
   * be translated to `lax` or `none` depending if **Always Use HTTPS** is enabled.
   * Note that when using value `none`, the secure attribute cannot be set to
   * `never`.
   */
  samesite?: 'auto' | 'lax' | 'none' | 'strict';

  /**
   * Configures the Secure attribute on the waiting room cookie. Value `always`
   * indicates that the Secure attribute will be set in the Set-Cookie header,
   * `never` indicates that the Secure attribute will not be set, and `auto` will set
   * the Secure attribute depending if **Always Use HTTPS** is enabled.
   */
  secure?: 'auto' | 'always' | 'never';
}

/**
 * Configures cookie attributes for the waiting room cookie. This encrypted cookie
 * stores a user's status in the waiting room, such as queue position.
 */
export interface CookieAttributesParam {
  /**
   * Configures the SameSite attribute on the waiting room cookie. Value `auto` will
   * be translated to `lax` or `none` depending if **Always Use HTTPS** is enabled.
   * Note that when using value `none`, the secure attribute cannot be set to
   * `never`.
   */
  samesite?: 'auto' | 'lax' | 'none' | 'strict';

  /**
   * Configures the Secure attribute on the waiting room cookie. Value `always`
   * indicates that the Secure attribute will be set in the Set-Cookie header,
   * `never` indicates that the Secure attribute will not be set, and `auto` will set
   * the Secure attribute depending if **Always Use HTTPS** is enabled.
   */
  secure?: 'auto' | 'always' | 'never';
}

export interface Query {
  /**
   * The host name to which the waiting room will be applied (no wildcards). Please
   * do not include the scheme (http:// or https://). The host and path combination
   * must be unique.
   */
  host: string;

  /**
   * A unique name to identify the waiting room. Only alphanumeric characters,
   * hyphens and underscores are allowed.
   */
  name: string;

  /**
   * Sets the number of new users that will be let into the route every minute. This
   * value is used as baseline for the number of users that are let in per minute. So
   * it is possible that there is a little more or little less traffic coming to the
   * route based on the traffic patterns at that time around the world.
   */
  new_users_per_minute: number;

  /**
   * Sets the total number of active user sessions on the route at a point in time. A
   * route is a combination of host and path on which a waiting room is available.
   * This value is used as a baseline for the total number of active user sessions on
   * the route. It is possible to have a situation where there are more or less
   * active users sessions on the route based on the traffic patterns at that time
   * around the world.
   */
  total_active_users: number;

  /**
   * Only available for the Waiting Room Advanced subscription. Additional hostname
   * and path combinations to which this waiting room will be applied. There is an
   * implied wildcard at the end of the path. The hostname and path combination must
   * be unique to this and all other waiting rooms.
   */
  additional_routes?: Array<AdditionalRoutes>;

  /**
   * Configures cookie attributes for the waiting room cookie. This encrypted cookie
   * stores a user's status in the waiting room, such as queue position.
   */
  cookie_attributes?: CookieAttributes;

  /**
   * Appends a '\_' + a custom suffix to the end of Cloudflare Waiting Room's cookie
   * name(**cf_waitingroom). If `cookie_suffix` is "abcd", the cookie name will be
   * `**cf_waitingroom_abcd`. This field is required if using `additional_routes`.
   */
  cookie_suffix?: string;

  /**
   * Only available for the Waiting Room Advanced subscription. This is a template
   * html file that will be rendered at the edge. If no custom_page_html is provided,
   * the default waiting room will be used. The template is based on mustache (
   * https://mustache.github.io/ ). There are several variables that are evaluated by
   * the Cloudflare edge:
   *
   * 1. {{`waitTimeKnown`}} Acts like a boolean value that indicates the behavior to
   *    take when wait time is not available, for instance when queue_all is
   *    **true**.
   * 2. {{`waitTimeFormatted`}} Estimated wait time for the user. For example, five
   *    minutes. Alternatively, you can use:
   * 3. {{`waitTime`}} Number of minutes of estimated wait for a user.
   * 4. {{`waitTimeHours`}} Number of hours of estimated wait for a user
   *    (`Math.floor(waitTime/60)`).
   * 5. {{`waitTimeHourMinutes`}} Number of minutes above the `waitTimeHours` value
   *    (`waitTime%60`).
   * 6. {{`queueIsFull`}} Changes to **true** when no more people can be added to the
   *    queue.
   *
   * To view the full list of variables, look at the `cfWaitingRoom` object described
   * under the `json_response_enabled` property in other Waiting Room API calls.
   */
  custom_page_html?: string;

  /**
   * The language of the default page template. If no default_template_language is
   * provided, then `en-US` (English) will be used.
   */
  default_template_language?:
    | 'en-US'
    | 'es-ES'
    | 'de-DE'
    | 'fr-FR'
    | 'it-IT'
    | 'ja-JP'
    | 'ko-KR'
    | 'pt-BR'
    | 'zh-CN'
    | 'zh-TW'
    | 'nl-NL'
    | 'pl-PL'
    | 'id-ID'
    | 'tr-TR'
    | 'ar-EG'
    | 'ru-RU'
    | 'fa-IR'
    | 'bg-BG'
    | 'hr-HR'
    | 'cs-CZ'
    | 'da-DK'
    | 'fi-FI'
    | 'lt-LT'
    | 'ms-MY'
    | 'nb-NO'
    | 'ro-RO'
    | 'el-GR'
    | 'he-IL'
    | 'hi-IN'
    | 'hu-HU'
    | 'sr-BA'
    | 'sk-SK'
    | 'sl-SI'
    | 'sv-SE'
    | 'tl-PH'
    | 'th-TH'
    | 'uk-UA'
    | 'vi-VN';

  /**
   * A note that you can use to add more details about the waiting room.
   */
  description?: string;

  /**
   * Only available for the Waiting Room Advanced subscription. Disables automatic
   * renewal of session cookies. If `true`, an accepted user will have
   * session_duration minutes to browse the site. After that, they will have to go
   * through the waiting room again. If `false`, a user's session cookie will be
   * automatically renewed on every request.
   */
  disable_session_renewal?: boolean;

  /**
   * A list of enabled origin commands.
   */
  enabled_origin_commands?: Array<'revoke'>;

  /**
   * Only available for the Waiting Room Advanced subscription. If `true`, requests
   * to the waiting room with the header `Accept: application/json` will receive a
   * JSON response object with information on the user's status in the waiting room
   * as opposed to the configured static HTML page. This JSON response object has one
   * property `cfWaitingRoom` which is an object containing the following fields:
   *
   * 1. `inWaitingRoom`: Boolean indicating if the user is in the waiting room
   *    (always **true**).
   * 2. `waitTimeKnown`: Boolean indicating if the current estimated wait times are
   *    accurate. If **false**, they are not available.
   * 3. `waitTime`: Valid only when `waitTimeKnown` is **true**. Integer indicating
   *    the current estimated time in minutes the user will wait in the waiting room.
   *    When `queueingMethod` is **random**, this is set to `waitTime50Percentile`.
   * 4. `waitTime25Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 25% of users that gain entry the fastest (25th percentile).
   * 5. `waitTime50Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 50% of users that gain entry the fastest (50th percentile).
   *    In other words, half of the queued users are expected to let into the origin
   *    website before `waitTime50Percentile` and half are expected to be let in
   *    after it.
   * 6. `waitTime75Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 75% of users that gain entry the fastest (75th percentile).
   * 7. `waitTimeFormatted`: String displaying the `waitTime` formatted in English
   *    for users. If `waitTimeKnown` is **false**, `waitTimeFormatted` will display
   *    **unavailable**.
   * 8. `queueIsFull`: Boolean indicating if the waiting room's queue is currently
   *    full and not accepting new users at the moment.
   * 9. `queueAll`: Boolean indicating if all users will be queued in the waiting
   *    room and no one will be let into the origin website.
   * 10. `lastUpdated`: String displaying the timestamp as an ISO 8601 string of the
   *     user's last attempt to leave the waiting room and be let into the origin
   *     website. The user is able to make another attempt after
   *     `refreshIntervalSeconds` past this time. If the user makes a request too
   *     soon, it will be ignored and `lastUpdated` will not change.
   * 11. `refreshIntervalSeconds`: Integer indicating the number of seconds after
   *     `lastUpdated` until the user is able to make another attempt to leave the
   *     waiting room and be let into the origin website. When the `queueingMethod`
   *     is `reject`, there is no specified refresh time —\_it will always be
   *     **zero**.
   * 12. `queueingMethod`: The queueing method currently used by the waiting room. It
   *     is either **fifo**, **random**, **passthrough**, or **reject**.
   * 13. `isFIFOQueue`: Boolean indicating if the waiting room uses a FIFO
   *     (First-In-First-Out) queue.
   * 14. `isRandomQueue`: Boolean indicating if the waiting room uses a Random queue
   *     where users gain access randomly.
   * 15. `isPassthroughQueue`: Boolean indicating if the waiting room uses a
   *     passthrough queue. Keep in mind that when passthrough is enabled, this JSON
   *     response will only exist when `queueAll` is **true** or `isEventPrequeueing`
   *     is **true** because in all other cases requests will go directly to the
   *     origin.
   * 16. `isRejectQueue`: Boolean indicating if the waiting room uses a reject queue.
   * 17. `isEventActive`: Boolean indicating if an event is currently occurring.
   *     Events are able to change a waiting room's behavior during a specified
   *     period of time. For additional information, look at the event properties
   *     `prequeue_start_time`, `event_start_time`, and `event_end_time` in the
   *     documentation for creating waiting room events. Events are considered active
   *     between these start and end times, as well as during the prequeueing period
   *     if it exists.
   * 18. `isEventPrequeueing`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if an event is currently prequeueing users before it starts.
   * 19. `timeUntilEventStart`: Valid only when `isEventPrequeueing` is **true**.
   *     Integer indicating the number of minutes until the event starts.
   * 20. `timeUntilEventStartFormatted`: String displaying the `timeUntilEventStart`
   *     formatted in English for users. If `isEventPrequeueing` is **false**,
   *     `timeUntilEventStartFormatted` will display **unavailable**.
   * 21. `timeUntilEventEnd`: Valid only when `isEventActive` is **true**. Integer
   *     indicating the number of minutes until the event ends.
   * 22. `timeUntilEventEndFormatted`: String displaying the `timeUntilEventEnd`
   *     formatted in English for users. If `isEventActive` is **false**,
   *     `timeUntilEventEndFormatted` will display **unavailable**.
   * 23. `shuffleAtEventStart`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if the users in the prequeue are shuffled randomly when the event
   *     starts.
   * 24. `turnstile`: Empty when turnstile isn't enabled. String displaying an html
   *     tag to display the Turnstile widget. Please add the `{{{turnstile}}}` tag to
   *     the `custom_html` template to ensure the Turnstile widget appears.
   * 25. `infiniteQueue`: Boolean indicating whether the response is for a user in
   *     the infinite queue.
   *
   * An example cURL to a waiting room could be:
   *
   *     curl -X GET "https://example.com/waitingroom" \
   *     	-H "Accept: application/json"
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **fifo** and no event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 0,
   *     		"waitTime50Percentile": 0,
   *     		"waitTime75Percentile": 0,
   *     		"waitTimeFormatted": "10 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "fifo",
   *     		"isFIFOQueue": true,
   *     		"isRandomQueue": false,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": false,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 0,
   *     		"timeUntilEventEndFormatted": "unavailable",
   *     		"shuffleAtEventStart": false
   *     	}
   *     }
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **random** and an event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 5,
   *     		"waitTime50Percentile": 10,
   *     		"waitTime75Percentile": 15,
   *     		"waitTimeFormatted": "5 minutes to 15 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "random",
   *     		"isFIFOQueue": false,
   *     		"isRandomQueue": true,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": true,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 15,
   *     		"timeUntilEventEndFormatted": "15 minutes",
   *     		"shuffleAtEventStart": true
   *     	}
   *     }
   */
  json_response_enabled?: boolean;

  /**
   * Sets the path within the host to enable the waiting room on. The waiting room
   * will be enabled for all subpaths as well. If there are two waiting rooms on the
   * same subpath, the waiting room for the most specific path will be chosen.
   * Wildcards and query parameters are not supported.
   */
  path?: string;

  /**
   * If queue_all is `true`, all the traffic that is coming to a route will be sent
   * to the waiting room. No new traffic can get to the route once this field is set
   * and estimated time will become unavailable.
   */
  queue_all?: boolean;

  /**
   * Sets the queueing method used by the waiting room. Changing this parameter from
   * the **default** queueing method is only available for the Waiting Room Advanced
   * subscription. Regardless of the queueing method, if `queue_all` is enabled or an
   * event is prequeueing, users in the waiting room will not be accepted to the
   * origin. These users will always see a waiting room page that refreshes
   * automatically. The valid queueing methods are:
   *
   * 1. `fifo` **(default)**: First-In-First-Out queue where customers gain access in
   *    the order they arrived.
   * 2. `random`: Random queue where customers gain access randomly, regardless of
   *    arrival time.
   * 3. `passthrough`: Users will pass directly through the waiting room and into the
   *    origin website. As a result, any configured limits will not be respected
   *    while this is enabled. This method can be used as an alternative to disabling
   *    a waiting room (with `suspended`) so that analytics are still reported. This
   *    can be used if you wish to allow all traffic normally, but want to restrict
   *    traffic during a waiting room event, or vice versa.
   * 4. `reject`: Users will be immediately rejected from the waiting room. As a
   *    result, no users will reach the origin website while this is enabled. This
   *    can be used if you wish to reject all traffic while performing maintenance,
   *    block traffic during a specified period of time (an event), or block traffic
   *    while events are not occurring. Consider a waiting room used for vaccine
   *    distribution that only allows traffic during sign-up events, and otherwise
   *    blocks all traffic. For this case, the waiting room uses `reject`, and its
   *    events override this with `fifo`, `random`, or `passthrough`. When this
   *    queueing method is enabled and neither `queueAll` is enabled nor an event is
   *    prequeueing, the waiting room page **will not refresh automatically**.
   */
  queueing_method?: 'fifo' | 'random' | 'passthrough' | 'reject';

  /**
   * HTTP status code returned to a user while in the queue.
   */
  queueing_status_code?: 200 | 202 | 429;

  /**
   * Lifetime of a cookie (in minutes) set by Cloudflare for users who get access to
   * the route. If a user is not seen by Cloudflare again in that time period, they
   * will be treated as a new user that visits the route.
   */
  session_duration?: number;

  /**
   * Suspends or allows traffic going to the waiting room. If set to `true`, the
   * traffic will not go to the waiting room.
   */
  suspended?: boolean;

  /**
   * Which action to take when a bot is detected using Turnstile. `log` will have no
   * impact on queueing behavior, simply keeping track of how many bots are detected
   * in Waiting Room Analytics. `infinite_queue` will send bots to a false queueing
   * state, where they will never reach your origin. `infinite_queue` requires
   * Advanced Waiting Room.
   */
  turnstile_action?: 'log' | 'infinite_queue';

  /**
   * Which Turnstile widget type to use for detecting bot traffic. See
   * [the Turnstile documentation](https://developers.cloudflare.com/turnstile/concepts/widget/#widget-types)
   * for the definitions of these widget types. Set to `off` to disable the Turnstile
   * integration entirely. Setting this to anything other than `off` or `invisible`
   * requires Advanced Waiting Room.
   */
  turnstile_mode?: 'off' | 'invisible' | 'visible_non_interactive' | 'visible_managed';
}

export interface WaitingRoom {
  id?: string;

  /**
   * Only available for the Waiting Room Advanced subscription. Additional hostname
   * and path combinations to which this waiting room will be applied. There is an
   * implied wildcard at the end of the path. The hostname and path combination must
   * be unique to this and all other waiting rooms.
   */
  additional_routes?: Array<AdditionalRoutes>;

  /**
   * Configures cookie attributes for the waiting room cookie. This encrypted cookie
   * stores a user's status in the waiting room, such as queue position.
   */
  cookie_attributes?: CookieAttributes;

  /**
   * Appends a '\_' + a custom suffix to the end of Cloudflare Waiting Room's cookie
   * name(**cf_waitingroom). If `cookie_suffix` is "abcd", the cookie name will be
   * `**cf_waitingroom_abcd`. This field is required if using `additional_routes`.
   */
  cookie_suffix?: string;

  created_on?: string;

  /**
   * Only available for the Waiting Room Advanced subscription. This is a template
   * html file that will be rendered at the edge. If no custom_page_html is provided,
   * the default waiting room will be used. The template is based on mustache (
   * https://mustache.github.io/ ). There are several variables that are evaluated by
   * the Cloudflare edge:
   *
   * 1. {{`waitTimeKnown`}} Acts like a boolean value that indicates the behavior to
   *    take when wait time is not available, for instance when queue_all is
   *    **true**.
   * 2. {{`waitTimeFormatted`}} Estimated wait time for the user. For example, five
   *    minutes. Alternatively, you can use:
   * 3. {{`waitTime`}} Number of minutes of estimated wait for a user.
   * 4. {{`waitTimeHours`}} Number of hours of estimated wait for a user
   *    (`Math.floor(waitTime/60)`).
   * 5. {{`waitTimeHourMinutes`}} Number of minutes above the `waitTimeHours` value
   *    (`waitTime%60`).
   * 6. {{`queueIsFull`}} Changes to **true** when no more people can be added to the
   *    queue.
   *
   * To view the full list of variables, look at the `cfWaitingRoom` object described
   * under the `json_response_enabled` property in other Waiting Room API calls.
   */
  custom_page_html?: string;

  /**
   * The language of the default page template. If no default_template_language is
   * provided, then `en-US` (English) will be used.
   */
  default_template_language?:
    | 'en-US'
    | 'es-ES'
    | 'de-DE'
    | 'fr-FR'
    | 'it-IT'
    | 'ja-JP'
    | 'ko-KR'
    | 'pt-BR'
    | 'zh-CN'
    | 'zh-TW'
    | 'nl-NL'
    | 'pl-PL'
    | 'id-ID'
    | 'tr-TR'
    | 'ar-EG'
    | 'ru-RU'
    | 'fa-IR'
    | 'bg-BG'
    | 'hr-HR'
    | 'cs-CZ'
    | 'da-DK'
    | 'fi-FI'
    | 'lt-LT'
    | 'ms-MY'
    | 'nb-NO'
    | 'ro-RO'
    | 'el-GR'
    | 'he-IL'
    | 'hi-IN'
    | 'hu-HU'
    | 'sr-BA'
    | 'sk-SK'
    | 'sl-SI'
    | 'sv-SE'
    | 'tl-PH'
    | 'th-TH'
    | 'uk-UA'
    | 'vi-VN';

  /**
   * A note that you can use to add more details about the waiting room.
   */
  description?: string;

  /**
   * Only available for the Waiting Room Advanced subscription. Disables automatic
   * renewal of session cookies. If `true`, an accepted user will have
   * session_duration minutes to browse the site. After that, they will have to go
   * through the waiting room again. If `false`, a user's session cookie will be
   * automatically renewed on every request.
   */
  disable_session_renewal?: boolean;

  /**
   * A list of enabled origin commands.
   */
  enabled_origin_commands?: Array<'revoke'>;

  /**
   * The host name to which the waiting room will be applied (no wildcards). Please
   * do not include the scheme (http:// or https://). The host and path combination
   * must be unique.
   */
  host?: string;

  /**
   * Only available for the Waiting Room Advanced subscription. If `true`, requests
   * to the waiting room with the header `Accept: application/json` will receive a
   * JSON response object with information on the user's status in the waiting room
   * as opposed to the configured static HTML page. This JSON response object has one
   * property `cfWaitingRoom` which is an object containing the following fields:
   *
   * 1. `inWaitingRoom`: Boolean indicating if the user is in the waiting room
   *    (always **true**).
   * 2. `waitTimeKnown`: Boolean indicating if the current estimated wait times are
   *    accurate. If **false**, they are not available.
   * 3. `waitTime`: Valid only when `waitTimeKnown` is **true**. Integer indicating
   *    the current estimated time in minutes the user will wait in the waiting room.
   *    When `queueingMethod` is **random**, this is set to `waitTime50Percentile`.
   * 4. `waitTime25Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 25% of users that gain entry the fastest (25th percentile).
   * 5. `waitTime50Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 50% of users that gain entry the fastest (50th percentile).
   *    In other words, half of the queued users are expected to let into the origin
   *    website before `waitTime50Percentile` and half are expected to be let in
   *    after it.
   * 6. `waitTime75Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 75% of users that gain entry the fastest (75th percentile).
   * 7. `waitTimeFormatted`: String displaying the `waitTime` formatted in English
   *    for users. If `waitTimeKnown` is **false**, `waitTimeFormatted` will display
   *    **unavailable**.
   * 8. `queueIsFull`: Boolean indicating if the waiting room's queue is currently
   *    full and not accepting new users at the moment.
   * 9. `queueAll`: Boolean indicating if all users will be queued in the waiting
   *    room and no one will be let into the origin website.
   * 10. `lastUpdated`: String displaying the timestamp as an ISO 8601 string of the
   *     user's last attempt to leave the waiting room and be let into the origin
   *     website. The user is able to make another attempt after
   *     `refreshIntervalSeconds` past this time. If the user makes a request too
   *     soon, it will be ignored and `lastUpdated` will not change.
   * 11. `refreshIntervalSeconds`: Integer indicating the number of seconds after
   *     `lastUpdated` until the user is able to make another attempt to leave the
   *     waiting room and be let into the origin website. When the `queueingMethod`
   *     is `reject`, there is no specified refresh time —\_it will always be
   *     **zero**.
   * 12. `queueingMethod`: The queueing method currently used by the waiting room. It
   *     is either **fifo**, **random**, **passthrough**, or **reject**.
   * 13. `isFIFOQueue`: Boolean indicating if the waiting room uses a FIFO
   *     (First-In-First-Out) queue.
   * 14. `isRandomQueue`: Boolean indicating if the waiting room uses a Random queue
   *     where users gain access randomly.
   * 15. `isPassthroughQueue`: Boolean indicating if the waiting room uses a
   *     passthrough queue. Keep in mind that when passthrough is enabled, this JSON
   *     response will only exist when `queueAll` is **true** or `isEventPrequeueing`
   *     is **true** because in all other cases requests will go directly to the
   *     origin.
   * 16. `isRejectQueue`: Boolean indicating if the waiting room uses a reject queue.
   * 17. `isEventActive`: Boolean indicating if an event is currently occurring.
   *     Events are able to change a waiting room's behavior during a specified
   *     period of time. For additional information, look at the event properties
   *     `prequeue_start_time`, `event_start_time`, and `event_end_time` in the
   *     documentation for creating waiting room events. Events are considered active
   *     between these start and end times, as well as during the prequeueing period
   *     if it exists.
   * 18. `isEventPrequeueing`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if an event is currently prequeueing users before it starts.
   * 19. `timeUntilEventStart`: Valid only when `isEventPrequeueing` is **true**.
   *     Integer indicating the number of minutes until the event starts.
   * 20. `timeUntilEventStartFormatted`: String displaying the `timeUntilEventStart`
   *     formatted in English for users. If `isEventPrequeueing` is **false**,
   *     `timeUntilEventStartFormatted` will display **unavailable**.
   * 21. `timeUntilEventEnd`: Valid only when `isEventActive` is **true**. Integer
   *     indicating the number of minutes until the event ends.
   * 22. `timeUntilEventEndFormatted`: String displaying the `timeUntilEventEnd`
   *     formatted in English for users. If `isEventActive` is **false**,
   *     `timeUntilEventEndFormatted` will display **unavailable**.
   * 23. `shuffleAtEventStart`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if the users in the prequeue are shuffled randomly when the event
   *     starts.
   * 24. `turnstile`: Empty when turnstile isn't enabled. String displaying an html
   *     tag to display the Turnstile widget. Please add the `{{{turnstile}}}` tag to
   *     the `custom_html` template to ensure the Turnstile widget appears.
   * 25. `infiniteQueue`: Boolean indicating whether the response is for a user in
   *     the infinite queue.
   *
   * An example cURL to a waiting room could be:
   *
   *     curl -X GET "https://example.com/waitingroom" \
   *     	-H "Accept: application/json"
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **fifo** and no event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 0,
   *     		"waitTime50Percentile": 0,
   *     		"waitTime75Percentile": 0,
   *     		"waitTimeFormatted": "10 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "fifo",
   *     		"isFIFOQueue": true,
   *     		"isRandomQueue": false,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": false,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 0,
   *     		"timeUntilEventEndFormatted": "unavailable",
   *     		"shuffleAtEventStart": false
   *     	}
   *     }
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **random** and an event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 5,
   *     		"waitTime50Percentile": 10,
   *     		"waitTime75Percentile": 15,
   *     		"waitTimeFormatted": "5 minutes to 15 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "random",
   *     		"isFIFOQueue": false,
   *     		"isRandomQueue": true,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": true,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 15,
   *     		"timeUntilEventEndFormatted": "15 minutes",
   *     		"shuffleAtEventStart": true
   *     	}
   *     }
   */
  json_response_enabled?: boolean;

  modified_on?: string;

  /**
   * A unique name to identify the waiting room. Only alphanumeric characters,
   * hyphens and underscores are allowed.
   */
  name?: string;

  /**
   * Sets the number of new users that will be let into the route every minute. This
   * value is used as baseline for the number of users that are let in per minute. So
   * it is possible that there is a little more or little less traffic coming to the
   * route based on the traffic patterns at that time around the world.
   */
  new_users_per_minute?: number;

  /**
   * An ISO 8601 timestamp that marks when the next event will begin queueing.
   */
  next_event_prequeue_start_time?: string | null;

  /**
   * An ISO 8601 timestamp that marks when the next event will start.
   */
  next_event_start_time?: string | null;

  /**
   * Sets the path within the host to enable the waiting room on. The waiting room
   * will be enabled for all subpaths as well. If there are two waiting rooms on the
   * same subpath, the waiting room for the most specific path will be chosen.
   * Wildcards and query parameters are not supported.
   */
  path?: string;

  /**
   * If queue_all is `true`, all the traffic that is coming to a route will be sent
   * to the waiting room. No new traffic can get to the route once this field is set
   * and estimated time will become unavailable.
   */
  queue_all?: boolean;

  /**
   * Sets the queueing method used by the waiting room. Changing this parameter from
   * the **default** queueing method is only available for the Waiting Room Advanced
   * subscription. Regardless of the queueing method, if `queue_all` is enabled or an
   * event is prequeueing, users in the waiting room will not be accepted to the
   * origin. These users will always see a waiting room page that refreshes
   * automatically. The valid queueing methods are:
   *
   * 1. `fifo` **(default)**: First-In-First-Out queue where customers gain access in
   *    the order they arrived.
   * 2. `random`: Random queue where customers gain access randomly, regardless of
   *    arrival time.
   * 3. `passthrough`: Users will pass directly through the waiting room and into the
   *    origin website. As a result, any configured limits will not be respected
   *    while this is enabled. This method can be used as an alternative to disabling
   *    a waiting room (with `suspended`) so that analytics are still reported. This
   *    can be used if you wish to allow all traffic normally, but want to restrict
   *    traffic during a waiting room event, or vice versa.
   * 4. `reject`: Users will be immediately rejected from the waiting room. As a
   *    result, no users will reach the origin website while this is enabled. This
   *    can be used if you wish to reject all traffic while performing maintenance,
   *    block traffic during a specified period of time (an event), or block traffic
   *    while events are not occurring. Consider a waiting room used for vaccine
   *    distribution that only allows traffic during sign-up events, and otherwise
   *    blocks all traffic. For this case, the waiting room uses `reject`, and its
   *    events override this with `fifo`, `random`, or `passthrough`. When this
   *    queueing method is enabled and neither `queueAll` is enabled nor an event is
   *    prequeueing, the waiting room page **will not refresh automatically**.
   */
  queueing_method?: 'fifo' | 'random' | 'passthrough' | 'reject';

  /**
   * HTTP status code returned to a user while in the queue.
   */
  queueing_status_code?: 200 | 202 | 429;

  /**
   * Lifetime of a cookie (in minutes) set by Cloudflare for users who get access to
   * the route. If a user is not seen by Cloudflare again in that time period, they
   * will be treated as a new user that visits the route.
   */
  session_duration?: number;

  /**
   * Suspends or allows traffic going to the waiting room. If set to `true`, the
   * traffic will not go to the waiting room.
   */
  suspended?: boolean;

  /**
   * Sets the total number of active user sessions on the route at a point in time. A
   * route is a combination of host and path on which a waiting room is available.
   * This value is used as a baseline for the total number of active user sessions on
   * the route. It is possible to have a situation where there are more or less
   * active users sessions on the route based on the traffic patterns at that time
   * around the world.
   */
  total_active_users?: number;

  /**
   * Which action to take when a bot is detected using Turnstile. `log` will have no
   * impact on queueing behavior, simply keeping track of how many bots are detected
   * in Waiting Room Analytics. `infinite_queue` will send bots to a false queueing
   * state, where they will never reach your origin. `infinite_queue` requires
   * Advanced Waiting Room.
   */
  turnstile_action?: 'log' | 'infinite_queue';

  /**
   * Which Turnstile widget type to use for detecting bot traffic. See
   * [the Turnstile documentation](https://developers.cloudflare.com/turnstile/concepts/widget/#widget-types)
   * for the definitions of these widget types. Set to `off` to disable the Turnstile
   * integration entirely. Setting this to anything other than `off` or `invisible`
   * requires Advanced Waiting Room.
   */
  turnstile_mode?: 'off' | 'invisible' | 'visible_non_interactive' | 'visible_managed';
}

export interface WaitingRoomDeleteResponse {
  id?: string;
}

export interface WaitingRoomCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The host name to which the waiting room will be applied (no
   * wildcards). Please do not include the scheme (http:// or https://). The host and
   * path combination must be unique.
   */
  host: string;

  /**
   * Body param: A unique name to identify the waiting room. Only alphanumeric
   * characters, hyphens and underscores are allowed.
   */
  name: string;

  /**
   * Body param: Sets the number of new users that will be let into the route every
   * minute. This value is used as baseline for the number of users that are let in
   * per minute. So it is possible that there is a little more or little less traffic
   * coming to the route based on the traffic patterns at that time around the world.
   */
  new_users_per_minute: number;

  /**
   * Body param: Sets the total number of active user sessions on the route at a
   * point in time. A route is a combination of host and path on which a waiting room
   * is available. This value is used as a baseline for the total number of active
   * user sessions on the route. It is possible to have a situation where there are
   * more or less active users sessions on the route based on the traffic patterns at
   * that time around the world.
   */
  total_active_users: number;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription.
   * Additional hostname and path combinations to which this waiting room will be
   * applied. There is an implied wildcard at the end of the path. The hostname and
   * path combination must be unique to this and all other waiting rooms.
   */
  additional_routes?: Array<AdditionalRoutesParam>;

  /**
   * Body param: Configures cookie attributes for the waiting room cookie. This
   * encrypted cookie stores a user's status in the waiting room, such as queue
   * position.
   */
  cookie_attributes?: CookieAttributesParam;

  /**
   * Body param: Appends a '\_' + a custom suffix to the end of Cloudflare Waiting
   * Room's cookie name(**cf_waitingroom). If `cookie_suffix` is "abcd", the cookie
   * name will be
   * `**cf_waitingroom_abcd`. This field is required if using `additional_routes`.
   */
  cookie_suffix?: string;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. This is a
   * template html file that will be rendered at the edge. If no custom_page_html is
   * provided, the default waiting room will be used. The template is based on
   * mustache ( https://mustache.github.io/ ). There are several variables that are
   * evaluated by the Cloudflare edge:
   *
   * 1. {{`waitTimeKnown`}} Acts like a boolean value that indicates the behavior to
   *    take when wait time is not available, for instance when queue_all is
   *    **true**.
   * 2. {{`waitTimeFormatted`}} Estimated wait time for the user. For example, five
   *    minutes. Alternatively, you can use:
   * 3. {{`waitTime`}} Number of minutes of estimated wait for a user.
   * 4. {{`waitTimeHours`}} Number of hours of estimated wait for a user
   *    (`Math.floor(waitTime/60)`).
   * 5. {{`waitTimeHourMinutes`}} Number of minutes above the `waitTimeHours` value
   *    (`waitTime%60`).
   * 6. {{`queueIsFull`}} Changes to **true** when no more people can be added to the
   *    queue.
   *
   * To view the full list of variables, look at the `cfWaitingRoom` object described
   * under the `json_response_enabled` property in other Waiting Room API calls.
   */
  custom_page_html?: string;

  /**
   * Body param: The language of the default page template. If no
   * default_template_language is provided, then `en-US` (English) will be used.
   */
  default_template_language?:
    | 'en-US'
    | 'es-ES'
    | 'de-DE'
    | 'fr-FR'
    | 'it-IT'
    | 'ja-JP'
    | 'ko-KR'
    | 'pt-BR'
    | 'zh-CN'
    | 'zh-TW'
    | 'nl-NL'
    | 'pl-PL'
    | 'id-ID'
    | 'tr-TR'
    | 'ar-EG'
    | 'ru-RU'
    | 'fa-IR'
    | 'bg-BG'
    | 'hr-HR'
    | 'cs-CZ'
    | 'da-DK'
    | 'fi-FI'
    | 'lt-LT'
    | 'ms-MY'
    | 'nb-NO'
    | 'ro-RO'
    | 'el-GR'
    | 'he-IL'
    | 'hi-IN'
    | 'hu-HU'
    | 'sr-BA'
    | 'sk-SK'
    | 'sl-SI'
    | 'sv-SE'
    | 'tl-PH'
    | 'th-TH'
    | 'uk-UA'
    | 'vi-VN';

  /**
   * Body param: A note that you can use to add more details about the waiting room.
   */
  description?: string;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. Disables
   * automatic renewal of session cookies. If `true`, an accepted user will have
   * session_duration minutes to browse the site. After that, they will have to go
   * through the waiting room again. If `false`, a user's session cookie will be
   * automatically renewed on every request.
   */
  disable_session_renewal?: boolean;

  /**
   * Body param: A list of enabled origin commands.
   */
  enabled_origin_commands?: Array<'revoke'>;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. If
   * `true`, requests to the waiting room with the header `Accept: application/json`
   * will receive a JSON response object with information on the user's status in the
   * waiting room as opposed to the configured static HTML page. This JSON response
   * object has one property `cfWaitingRoom` which is an object containing the
   * following fields:
   *
   * 1. `inWaitingRoom`: Boolean indicating if the user is in the waiting room
   *    (always **true**).
   * 2. `waitTimeKnown`: Boolean indicating if the current estimated wait times are
   *    accurate. If **false**, they are not available.
   * 3. `waitTime`: Valid only when `waitTimeKnown` is **true**. Integer indicating
   *    the current estimated time in minutes the user will wait in the waiting room.
   *    When `queueingMethod` is **random**, this is set to `waitTime50Percentile`.
   * 4. `waitTime25Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 25% of users that gain entry the fastest (25th percentile).
   * 5. `waitTime50Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 50% of users that gain entry the fastest (50th percentile).
   *    In other words, half of the queued users are expected to let into the origin
   *    website before `waitTime50Percentile` and half are expected to be let in
   *    after it.
   * 6. `waitTime75Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 75% of users that gain entry the fastest (75th percentile).
   * 7. `waitTimeFormatted`: String displaying the `waitTime` formatted in English
   *    for users. If `waitTimeKnown` is **false**, `waitTimeFormatted` will display
   *    **unavailable**.
   * 8. `queueIsFull`: Boolean indicating if the waiting room's queue is currently
   *    full and not accepting new users at the moment.
   * 9. `queueAll`: Boolean indicating if all users will be queued in the waiting
   *    room and no one will be let into the origin website.
   * 10. `lastUpdated`: String displaying the timestamp as an ISO 8601 string of the
   *     user's last attempt to leave the waiting room and be let into the origin
   *     website. The user is able to make another attempt after
   *     `refreshIntervalSeconds` past this time. If the user makes a request too
   *     soon, it will be ignored and `lastUpdated` will not change.
   * 11. `refreshIntervalSeconds`: Integer indicating the number of seconds after
   *     `lastUpdated` until the user is able to make another attempt to leave the
   *     waiting room and be let into the origin website. When the `queueingMethod`
   *     is `reject`, there is no specified refresh time —\_it will always be
   *     **zero**.
   * 12. `queueingMethod`: The queueing method currently used by the waiting room. It
   *     is either **fifo**, **random**, **passthrough**, or **reject**.
   * 13. `isFIFOQueue`: Boolean indicating if the waiting room uses a FIFO
   *     (First-In-First-Out) queue.
   * 14. `isRandomQueue`: Boolean indicating if the waiting room uses a Random queue
   *     where users gain access randomly.
   * 15. `isPassthroughQueue`: Boolean indicating if the waiting room uses a
   *     passthrough queue. Keep in mind that when passthrough is enabled, this JSON
   *     response will only exist when `queueAll` is **true** or `isEventPrequeueing`
   *     is **true** because in all other cases requests will go directly to the
   *     origin.
   * 16. `isRejectQueue`: Boolean indicating if the waiting room uses a reject queue.
   * 17. `isEventActive`: Boolean indicating if an event is currently occurring.
   *     Events are able to change a waiting room's behavior during a specified
   *     period of time. For additional information, look at the event properties
   *     `prequeue_start_time`, `event_start_time`, and `event_end_time` in the
   *     documentation for creating waiting room events. Events are considered active
   *     between these start and end times, as well as during the prequeueing period
   *     if it exists.
   * 18. `isEventPrequeueing`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if an event is currently prequeueing users before it starts.
   * 19. `timeUntilEventStart`: Valid only when `isEventPrequeueing` is **true**.
   *     Integer indicating the number of minutes until the event starts.
   * 20. `timeUntilEventStartFormatted`: String displaying the `timeUntilEventStart`
   *     formatted in English for users. If `isEventPrequeueing` is **false**,
   *     `timeUntilEventStartFormatted` will display **unavailable**.
   * 21. `timeUntilEventEnd`: Valid only when `isEventActive` is **true**. Integer
   *     indicating the number of minutes until the event ends.
   * 22. `timeUntilEventEndFormatted`: String displaying the `timeUntilEventEnd`
   *     formatted in English for users. If `isEventActive` is **false**,
   *     `timeUntilEventEndFormatted` will display **unavailable**.
   * 23. `shuffleAtEventStart`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if the users in the prequeue are shuffled randomly when the event
   *     starts.
   * 24. `turnstile`: Empty when turnstile isn't enabled. String displaying an html
   *     tag to display the Turnstile widget. Please add the `{{{turnstile}}}` tag to
   *     the `custom_html` template to ensure the Turnstile widget appears.
   * 25. `infiniteQueue`: Boolean indicating whether the response is for a user in
   *     the infinite queue.
   *
   * An example cURL to a waiting room could be:
   *
   *     curl -X GET "https://example.com/waitingroom" \
   *     	-H "Accept: application/json"
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **fifo** and no event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 0,
   *     		"waitTime50Percentile": 0,
   *     		"waitTime75Percentile": 0,
   *     		"waitTimeFormatted": "10 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "fifo",
   *     		"isFIFOQueue": true,
   *     		"isRandomQueue": false,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": false,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 0,
   *     		"timeUntilEventEndFormatted": "unavailable",
   *     		"shuffleAtEventStart": false
   *     	}
   *     }
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **random** and an event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 5,
   *     		"waitTime50Percentile": 10,
   *     		"waitTime75Percentile": 15,
   *     		"waitTimeFormatted": "5 minutes to 15 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "random",
   *     		"isFIFOQueue": false,
   *     		"isRandomQueue": true,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": true,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 15,
   *     		"timeUntilEventEndFormatted": "15 minutes",
   *     		"shuffleAtEventStart": true
   *     	}
   *     }
   */
  json_response_enabled?: boolean;

  /**
   * Body param: Sets the path within the host to enable the waiting room on. The
   * waiting room will be enabled for all subpaths as well. If there are two waiting
   * rooms on the same subpath, the waiting room for the most specific path will be
   * chosen. Wildcards and query parameters are not supported.
   */
  path?: string;

  /**
   * Body param: If queue_all is `true`, all the traffic that is coming to a route
   * will be sent to the waiting room. No new traffic can get to the route once this
   * field is set and estimated time will become unavailable.
   */
  queue_all?: boolean;

  /**
   * Body param: Sets the queueing method used by the waiting room. Changing this
   * parameter from the **default** queueing method is only available for the Waiting
   * Room Advanced subscription. Regardless of the queueing method, if `queue_all` is
   * enabled or an event is prequeueing, users in the waiting room will not be
   * accepted to the origin. These users will always see a waiting room page that
   * refreshes automatically. The valid queueing methods are:
   *
   * 1. `fifo` **(default)**: First-In-First-Out queue where customers gain access in
   *    the order they arrived.
   * 2. `random`: Random queue where customers gain access randomly, regardless of
   *    arrival time.
   * 3. `passthrough`: Users will pass directly through the waiting room and into the
   *    origin website. As a result, any configured limits will not be respected
   *    while this is enabled. This method can be used as an alternative to disabling
   *    a waiting room (with `suspended`) so that analytics are still reported. This
   *    can be used if you wish to allow all traffic normally, but want to restrict
   *    traffic during a waiting room event, or vice versa.
   * 4. `reject`: Users will be immediately rejected from the waiting room. As a
   *    result, no users will reach the origin website while this is enabled. This
   *    can be used if you wish to reject all traffic while performing maintenance,
   *    block traffic during a specified period of time (an event), or block traffic
   *    while events are not occurring. Consider a waiting room used for vaccine
   *    distribution that only allows traffic during sign-up events, and otherwise
   *    blocks all traffic. For this case, the waiting room uses `reject`, and its
   *    events override this with `fifo`, `random`, or `passthrough`. When this
   *    queueing method is enabled and neither `queueAll` is enabled nor an event is
   *    prequeueing, the waiting room page **will not refresh automatically**.
   */
  queueing_method?: 'fifo' | 'random' | 'passthrough' | 'reject';

  /**
   * Body param: HTTP status code returned to a user while in the queue.
   */
  queueing_status_code?: 200 | 202 | 429;

  /**
   * Body param: Lifetime of a cookie (in minutes) set by Cloudflare for users who
   * get access to the route. If a user is not seen by Cloudflare again in that time
   * period, they will be treated as a new user that visits the route.
   */
  session_duration?: number;

  /**
   * Body param: Suspends or allows traffic going to the waiting room. If set to
   * `true`, the traffic will not go to the waiting room.
   */
  suspended?: boolean;

  /**
   * Body param: Which action to take when a bot is detected using Turnstile. `log`
   * will have no impact on queueing behavior, simply keeping track of how many bots
   * are detected in Waiting Room Analytics. `infinite_queue` will send bots to a
   * false queueing state, where they will never reach your origin. `infinite_queue`
   * requires Advanced Waiting Room.
   */
  turnstile_action?: 'log' | 'infinite_queue';

  /**
   * Body param: Which Turnstile widget type to use for detecting bot traffic. See
   * [the Turnstile documentation](https://developers.cloudflare.com/turnstile/concepts/widget/#widget-types)
   * for the definitions of these widget types. Set to `off` to disable the Turnstile
   * integration entirely. Setting this to anything other than `off` or `invisible`
   * requires Advanced Waiting Room.
   */
  turnstile_mode?: 'off' | 'invisible' | 'visible_non_interactive' | 'visible_managed';
}

export interface WaitingRoomUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The host name to which the waiting room will be applied (no
   * wildcards). Please do not include the scheme (http:// or https://). The host and
   * path combination must be unique.
   */
  host: string;

  /**
   * Body param: A unique name to identify the waiting room. Only alphanumeric
   * characters, hyphens and underscores are allowed.
   */
  name: string;

  /**
   * Body param: Sets the number of new users that will be let into the route every
   * minute. This value is used as baseline for the number of users that are let in
   * per minute. So it is possible that there is a little more or little less traffic
   * coming to the route based on the traffic patterns at that time around the world.
   */
  new_users_per_minute: number;

  /**
   * Body param: Sets the total number of active user sessions on the route at a
   * point in time. A route is a combination of host and path on which a waiting room
   * is available. This value is used as a baseline for the total number of active
   * user sessions on the route. It is possible to have a situation where there are
   * more or less active users sessions on the route based on the traffic patterns at
   * that time around the world.
   */
  total_active_users: number;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription.
   * Additional hostname and path combinations to which this waiting room will be
   * applied. There is an implied wildcard at the end of the path. The hostname and
   * path combination must be unique to this and all other waiting rooms.
   */
  additional_routes?: Array<AdditionalRoutesParam>;

  /**
   * Body param: Configures cookie attributes for the waiting room cookie. This
   * encrypted cookie stores a user's status in the waiting room, such as queue
   * position.
   */
  cookie_attributes?: CookieAttributesParam;

  /**
   * Body param: Appends a '\_' + a custom suffix to the end of Cloudflare Waiting
   * Room's cookie name(**cf_waitingroom). If `cookie_suffix` is "abcd", the cookie
   * name will be
   * `**cf_waitingroom_abcd`. This field is required if using `additional_routes`.
   */
  cookie_suffix?: string;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. This is a
   * template html file that will be rendered at the edge. If no custom_page_html is
   * provided, the default waiting room will be used. The template is based on
   * mustache ( https://mustache.github.io/ ). There are several variables that are
   * evaluated by the Cloudflare edge:
   *
   * 1. {{`waitTimeKnown`}} Acts like a boolean value that indicates the behavior to
   *    take when wait time is not available, for instance when queue_all is
   *    **true**.
   * 2. {{`waitTimeFormatted`}} Estimated wait time for the user. For example, five
   *    minutes. Alternatively, you can use:
   * 3. {{`waitTime`}} Number of minutes of estimated wait for a user.
   * 4. {{`waitTimeHours`}} Number of hours of estimated wait for a user
   *    (`Math.floor(waitTime/60)`).
   * 5. {{`waitTimeHourMinutes`}} Number of minutes above the `waitTimeHours` value
   *    (`waitTime%60`).
   * 6. {{`queueIsFull`}} Changes to **true** when no more people can be added to the
   *    queue.
   *
   * To view the full list of variables, look at the `cfWaitingRoom` object described
   * under the `json_response_enabled` property in other Waiting Room API calls.
   */
  custom_page_html?: string;

  /**
   * Body param: The language of the default page template. If no
   * default_template_language is provided, then `en-US` (English) will be used.
   */
  default_template_language?:
    | 'en-US'
    | 'es-ES'
    | 'de-DE'
    | 'fr-FR'
    | 'it-IT'
    | 'ja-JP'
    | 'ko-KR'
    | 'pt-BR'
    | 'zh-CN'
    | 'zh-TW'
    | 'nl-NL'
    | 'pl-PL'
    | 'id-ID'
    | 'tr-TR'
    | 'ar-EG'
    | 'ru-RU'
    | 'fa-IR'
    | 'bg-BG'
    | 'hr-HR'
    | 'cs-CZ'
    | 'da-DK'
    | 'fi-FI'
    | 'lt-LT'
    | 'ms-MY'
    | 'nb-NO'
    | 'ro-RO'
    | 'el-GR'
    | 'he-IL'
    | 'hi-IN'
    | 'hu-HU'
    | 'sr-BA'
    | 'sk-SK'
    | 'sl-SI'
    | 'sv-SE'
    | 'tl-PH'
    | 'th-TH'
    | 'uk-UA'
    | 'vi-VN';

  /**
   * Body param: A note that you can use to add more details about the waiting room.
   */
  description?: string;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. Disables
   * automatic renewal of session cookies. If `true`, an accepted user will have
   * session_duration minutes to browse the site. After that, they will have to go
   * through the waiting room again. If `false`, a user's session cookie will be
   * automatically renewed on every request.
   */
  disable_session_renewal?: boolean;

  /**
   * Body param: A list of enabled origin commands.
   */
  enabled_origin_commands?: Array<'revoke'>;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. If
   * `true`, requests to the waiting room with the header `Accept: application/json`
   * will receive a JSON response object with information on the user's status in the
   * waiting room as opposed to the configured static HTML page. This JSON response
   * object has one property `cfWaitingRoom` which is an object containing the
   * following fields:
   *
   * 1. `inWaitingRoom`: Boolean indicating if the user is in the waiting room
   *    (always **true**).
   * 2. `waitTimeKnown`: Boolean indicating if the current estimated wait times are
   *    accurate. If **false**, they are not available.
   * 3. `waitTime`: Valid only when `waitTimeKnown` is **true**. Integer indicating
   *    the current estimated time in minutes the user will wait in the waiting room.
   *    When `queueingMethod` is **random**, this is set to `waitTime50Percentile`.
   * 4. `waitTime25Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 25% of users that gain entry the fastest (25th percentile).
   * 5. `waitTime50Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 50% of users that gain entry the fastest (50th percentile).
   *    In other words, half of the queued users are expected to let into the origin
   *    website before `waitTime50Percentile` and half are expected to be let in
   *    after it.
   * 6. `waitTime75Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 75% of users that gain entry the fastest (75th percentile).
   * 7. `waitTimeFormatted`: String displaying the `waitTime` formatted in English
   *    for users. If `waitTimeKnown` is **false**, `waitTimeFormatted` will display
   *    **unavailable**.
   * 8. `queueIsFull`: Boolean indicating if the waiting room's queue is currently
   *    full and not accepting new users at the moment.
   * 9. `queueAll`: Boolean indicating if all users will be queued in the waiting
   *    room and no one will be let into the origin website.
   * 10. `lastUpdated`: String displaying the timestamp as an ISO 8601 string of the
   *     user's last attempt to leave the waiting room and be let into the origin
   *     website. The user is able to make another attempt after
   *     `refreshIntervalSeconds` past this time. If the user makes a request too
   *     soon, it will be ignored and `lastUpdated` will not change.
   * 11. `refreshIntervalSeconds`: Integer indicating the number of seconds after
   *     `lastUpdated` until the user is able to make another attempt to leave the
   *     waiting room and be let into the origin website. When the `queueingMethod`
   *     is `reject`, there is no specified refresh time —\_it will always be
   *     **zero**.
   * 12. `queueingMethod`: The queueing method currently used by the waiting room. It
   *     is either **fifo**, **random**, **passthrough**, or **reject**.
   * 13. `isFIFOQueue`: Boolean indicating if the waiting room uses a FIFO
   *     (First-In-First-Out) queue.
   * 14. `isRandomQueue`: Boolean indicating if the waiting room uses a Random queue
   *     where users gain access randomly.
   * 15. `isPassthroughQueue`: Boolean indicating if the waiting room uses a
   *     passthrough queue. Keep in mind that when passthrough is enabled, this JSON
   *     response will only exist when `queueAll` is **true** or `isEventPrequeueing`
   *     is **true** because in all other cases requests will go directly to the
   *     origin.
   * 16. `isRejectQueue`: Boolean indicating if the waiting room uses a reject queue.
   * 17. `isEventActive`: Boolean indicating if an event is currently occurring.
   *     Events are able to change a waiting room's behavior during a specified
   *     period of time. For additional information, look at the event properties
   *     `prequeue_start_time`, `event_start_time`, and `event_end_time` in the
   *     documentation for creating waiting room events. Events are considered active
   *     between these start and end times, as well as during the prequeueing period
   *     if it exists.
   * 18. `isEventPrequeueing`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if an event is currently prequeueing users before it starts.
   * 19. `timeUntilEventStart`: Valid only when `isEventPrequeueing` is **true**.
   *     Integer indicating the number of minutes until the event starts.
   * 20. `timeUntilEventStartFormatted`: String displaying the `timeUntilEventStart`
   *     formatted in English for users. If `isEventPrequeueing` is **false**,
   *     `timeUntilEventStartFormatted` will display **unavailable**.
   * 21. `timeUntilEventEnd`: Valid only when `isEventActive` is **true**. Integer
   *     indicating the number of minutes until the event ends.
   * 22. `timeUntilEventEndFormatted`: String displaying the `timeUntilEventEnd`
   *     formatted in English for users. If `isEventActive` is **false**,
   *     `timeUntilEventEndFormatted` will display **unavailable**.
   * 23. `shuffleAtEventStart`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if the users in the prequeue are shuffled randomly when the event
   *     starts.
   * 24. `turnstile`: Empty when turnstile isn't enabled. String displaying an html
   *     tag to display the Turnstile widget. Please add the `{{{turnstile}}}` tag to
   *     the `custom_html` template to ensure the Turnstile widget appears.
   * 25. `infiniteQueue`: Boolean indicating whether the response is for a user in
   *     the infinite queue.
   *
   * An example cURL to a waiting room could be:
   *
   *     curl -X GET "https://example.com/waitingroom" \
   *     	-H "Accept: application/json"
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **fifo** and no event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 0,
   *     		"waitTime50Percentile": 0,
   *     		"waitTime75Percentile": 0,
   *     		"waitTimeFormatted": "10 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "fifo",
   *     		"isFIFOQueue": true,
   *     		"isRandomQueue": false,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": false,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 0,
   *     		"timeUntilEventEndFormatted": "unavailable",
   *     		"shuffleAtEventStart": false
   *     	}
   *     }
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **random** and an event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 5,
   *     		"waitTime50Percentile": 10,
   *     		"waitTime75Percentile": 15,
   *     		"waitTimeFormatted": "5 minutes to 15 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "random",
   *     		"isFIFOQueue": false,
   *     		"isRandomQueue": true,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": true,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 15,
   *     		"timeUntilEventEndFormatted": "15 minutes",
   *     		"shuffleAtEventStart": true
   *     	}
   *     }
   */
  json_response_enabled?: boolean;

  /**
   * Body param: Sets the path within the host to enable the waiting room on. The
   * waiting room will be enabled for all subpaths as well. If there are two waiting
   * rooms on the same subpath, the waiting room for the most specific path will be
   * chosen. Wildcards and query parameters are not supported.
   */
  path?: string;

  /**
   * Body param: If queue_all is `true`, all the traffic that is coming to a route
   * will be sent to the waiting room. No new traffic can get to the route once this
   * field is set and estimated time will become unavailable.
   */
  queue_all?: boolean;

  /**
   * Body param: Sets the queueing method used by the waiting room. Changing this
   * parameter from the **default** queueing method is only available for the Waiting
   * Room Advanced subscription. Regardless of the queueing method, if `queue_all` is
   * enabled or an event is prequeueing, users in the waiting room will not be
   * accepted to the origin. These users will always see a waiting room page that
   * refreshes automatically. The valid queueing methods are:
   *
   * 1. `fifo` **(default)**: First-In-First-Out queue where customers gain access in
   *    the order they arrived.
   * 2. `random`: Random queue where customers gain access randomly, regardless of
   *    arrival time.
   * 3. `passthrough`: Users will pass directly through the waiting room and into the
   *    origin website. As a result, any configured limits will not be respected
   *    while this is enabled. This method can be used as an alternative to disabling
   *    a waiting room (with `suspended`) so that analytics are still reported. This
   *    can be used if you wish to allow all traffic normally, but want to restrict
   *    traffic during a waiting room event, or vice versa.
   * 4. `reject`: Users will be immediately rejected from the waiting room. As a
   *    result, no users will reach the origin website while this is enabled. This
   *    can be used if you wish to reject all traffic while performing maintenance,
   *    block traffic during a specified period of time (an event), or block traffic
   *    while events are not occurring. Consider a waiting room used for vaccine
   *    distribution that only allows traffic during sign-up events, and otherwise
   *    blocks all traffic. For this case, the waiting room uses `reject`, and its
   *    events override this with `fifo`, `random`, or `passthrough`. When this
   *    queueing method is enabled and neither `queueAll` is enabled nor an event is
   *    prequeueing, the waiting room page **will not refresh automatically**.
   */
  queueing_method?: 'fifo' | 'random' | 'passthrough' | 'reject';

  /**
   * Body param: HTTP status code returned to a user while in the queue.
   */
  queueing_status_code?: 200 | 202 | 429;

  /**
   * Body param: Lifetime of a cookie (in minutes) set by Cloudflare for users who
   * get access to the route. If a user is not seen by Cloudflare again in that time
   * period, they will be treated as a new user that visits the route.
   */
  session_duration?: number;

  /**
   * Body param: Suspends or allows traffic going to the waiting room. If set to
   * `true`, the traffic will not go to the waiting room.
   */
  suspended?: boolean;

  /**
   * Body param: Which action to take when a bot is detected using Turnstile. `log`
   * will have no impact on queueing behavior, simply keeping track of how many bots
   * are detected in Waiting Room Analytics. `infinite_queue` will send bots to a
   * false queueing state, where they will never reach your origin. `infinite_queue`
   * requires Advanced Waiting Room.
   */
  turnstile_action?: 'log' | 'infinite_queue';

  /**
   * Body param: Which Turnstile widget type to use for detecting bot traffic. See
   * [the Turnstile documentation](https://developers.cloudflare.com/turnstile/concepts/widget/#widget-types)
   * for the definitions of these widget types. Set to `off` to disable the Turnstile
   * integration entirely. Setting this to anything other than `off` or `invisible`
   * requires Advanced Waiting Room.
   */
  turnstile_mode?: 'off' | 'invisible' | 'visible_non_interactive' | 'visible_managed';
}

export interface WaitingRoomListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
   * Zone ID.
   */
  account_id?: string;

  /**
   * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
   * Account ID.
   */
  zone_id?: string;
}

export interface WaitingRoomDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface WaitingRoomEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: The host name to which the waiting room will be applied (no
   * wildcards). Please do not include the scheme (http:// or https://). The host and
   * path combination must be unique.
   */
  host: string;

  /**
   * Body param: A unique name to identify the waiting room. Only alphanumeric
   * characters, hyphens and underscores are allowed.
   */
  name: string;

  /**
   * Body param: Sets the number of new users that will be let into the route every
   * minute. This value is used as baseline for the number of users that are let in
   * per minute. So it is possible that there is a little more or little less traffic
   * coming to the route based on the traffic patterns at that time around the world.
   */
  new_users_per_minute: number;

  /**
   * Body param: Sets the total number of active user sessions on the route at a
   * point in time. A route is a combination of host and path on which a waiting room
   * is available. This value is used as a baseline for the total number of active
   * user sessions on the route. It is possible to have a situation where there are
   * more or less active users sessions on the route based on the traffic patterns at
   * that time around the world.
   */
  total_active_users: number;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription.
   * Additional hostname and path combinations to which this waiting room will be
   * applied. There is an implied wildcard at the end of the path. The hostname and
   * path combination must be unique to this and all other waiting rooms.
   */
  additional_routes?: Array<AdditionalRoutesParam>;

  /**
   * Body param: Configures cookie attributes for the waiting room cookie. This
   * encrypted cookie stores a user's status in the waiting room, such as queue
   * position.
   */
  cookie_attributes?: CookieAttributesParam;

  /**
   * Body param: Appends a '\_' + a custom suffix to the end of Cloudflare Waiting
   * Room's cookie name(**cf_waitingroom). If `cookie_suffix` is "abcd", the cookie
   * name will be
   * `**cf_waitingroom_abcd`. This field is required if using `additional_routes`.
   */
  cookie_suffix?: string;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. This is a
   * template html file that will be rendered at the edge. If no custom_page_html is
   * provided, the default waiting room will be used. The template is based on
   * mustache ( https://mustache.github.io/ ). There are several variables that are
   * evaluated by the Cloudflare edge:
   *
   * 1. {{`waitTimeKnown`}} Acts like a boolean value that indicates the behavior to
   *    take when wait time is not available, for instance when queue_all is
   *    **true**.
   * 2. {{`waitTimeFormatted`}} Estimated wait time for the user. For example, five
   *    minutes. Alternatively, you can use:
   * 3. {{`waitTime`}} Number of minutes of estimated wait for a user.
   * 4. {{`waitTimeHours`}} Number of hours of estimated wait for a user
   *    (`Math.floor(waitTime/60)`).
   * 5. {{`waitTimeHourMinutes`}} Number of minutes above the `waitTimeHours` value
   *    (`waitTime%60`).
   * 6. {{`queueIsFull`}} Changes to **true** when no more people can be added to the
   *    queue.
   *
   * To view the full list of variables, look at the `cfWaitingRoom` object described
   * under the `json_response_enabled` property in other Waiting Room API calls.
   */
  custom_page_html?: string;

  /**
   * Body param: The language of the default page template. If no
   * default_template_language is provided, then `en-US` (English) will be used.
   */
  default_template_language?:
    | 'en-US'
    | 'es-ES'
    | 'de-DE'
    | 'fr-FR'
    | 'it-IT'
    | 'ja-JP'
    | 'ko-KR'
    | 'pt-BR'
    | 'zh-CN'
    | 'zh-TW'
    | 'nl-NL'
    | 'pl-PL'
    | 'id-ID'
    | 'tr-TR'
    | 'ar-EG'
    | 'ru-RU'
    | 'fa-IR'
    | 'bg-BG'
    | 'hr-HR'
    | 'cs-CZ'
    | 'da-DK'
    | 'fi-FI'
    | 'lt-LT'
    | 'ms-MY'
    | 'nb-NO'
    | 'ro-RO'
    | 'el-GR'
    | 'he-IL'
    | 'hi-IN'
    | 'hu-HU'
    | 'sr-BA'
    | 'sk-SK'
    | 'sl-SI'
    | 'sv-SE'
    | 'tl-PH'
    | 'th-TH'
    | 'uk-UA'
    | 'vi-VN';

  /**
   * Body param: A note that you can use to add more details about the waiting room.
   */
  description?: string;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. Disables
   * automatic renewal of session cookies. If `true`, an accepted user will have
   * session_duration minutes to browse the site. After that, they will have to go
   * through the waiting room again. If `false`, a user's session cookie will be
   * automatically renewed on every request.
   */
  disable_session_renewal?: boolean;

  /**
   * Body param: A list of enabled origin commands.
   */
  enabled_origin_commands?: Array<'revoke'>;

  /**
   * Body param: Only available for the Waiting Room Advanced subscription. If
   * `true`, requests to the waiting room with the header `Accept: application/json`
   * will receive a JSON response object with information on the user's status in the
   * waiting room as opposed to the configured static HTML page. This JSON response
   * object has one property `cfWaitingRoom` which is an object containing the
   * following fields:
   *
   * 1. `inWaitingRoom`: Boolean indicating if the user is in the waiting room
   *    (always **true**).
   * 2. `waitTimeKnown`: Boolean indicating if the current estimated wait times are
   *    accurate. If **false**, they are not available.
   * 3. `waitTime`: Valid only when `waitTimeKnown` is **true**. Integer indicating
   *    the current estimated time in minutes the user will wait in the waiting room.
   *    When `queueingMethod` is **random**, this is set to `waitTime50Percentile`.
   * 4. `waitTime25Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 25% of users that gain entry the fastest (25th percentile).
   * 5. `waitTime50Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 50% of users that gain entry the fastest (50th percentile).
   *    In other words, half of the queued users are expected to let into the origin
   *    website before `waitTime50Percentile` and half are expected to be let in
   *    after it.
   * 6. `waitTime75Percentile`: Valid only when `queueingMethod` is **random** and
   *    `waitTimeKnown` is **true**. Integer indicating the current estimated maximum
   *    wait time for the 75% of users that gain entry the fastest (75th percentile).
   * 7. `waitTimeFormatted`: String displaying the `waitTime` formatted in English
   *    for users. If `waitTimeKnown` is **false**, `waitTimeFormatted` will display
   *    **unavailable**.
   * 8. `queueIsFull`: Boolean indicating if the waiting room's queue is currently
   *    full and not accepting new users at the moment.
   * 9. `queueAll`: Boolean indicating if all users will be queued in the waiting
   *    room and no one will be let into the origin website.
   * 10. `lastUpdated`: String displaying the timestamp as an ISO 8601 string of the
   *     user's last attempt to leave the waiting room and be let into the origin
   *     website. The user is able to make another attempt after
   *     `refreshIntervalSeconds` past this time. If the user makes a request too
   *     soon, it will be ignored and `lastUpdated` will not change.
   * 11. `refreshIntervalSeconds`: Integer indicating the number of seconds after
   *     `lastUpdated` until the user is able to make another attempt to leave the
   *     waiting room and be let into the origin website. When the `queueingMethod`
   *     is `reject`, there is no specified refresh time —\_it will always be
   *     **zero**.
   * 12. `queueingMethod`: The queueing method currently used by the waiting room. It
   *     is either **fifo**, **random**, **passthrough**, or **reject**.
   * 13. `isFIFOQueue`: Boolean indicating if the waiting room uses a FIFO
   *     (First-In-First-Out) queue.
   * 14. `isRandomQueue`: Boolean indicating if the waiting room uses a Random queue
   *     where users gain access randomly.
   * 15. `isPassthroughQueue`: Boolean indicating if the waiting room uses a
   *     passthrough queue. Keep in mind that when passthrough is enabled, this JSON
   *     response will only exist when `queueAll` is **true** or `isEventPrequeueing`
   *     is **true** because in all other cases requests will go directly to the
   *     origin.
   * 16. `isRejectQueue`: Boolean indicating if the waiting room uses a reject queue.
   * 17. `isEventActive`: Boolean indicating if an event is currently occurring.
   *     Events are able to change a waiting room's behavior during a specified
   *     period of time. For additional information, look at the event properties
   *     `prequeue_start_time`, `event_start_time`, and `event_end_time` in the
   *     documentation for creating waiting room events. Events are considered active
   *     between these start and end times, as well as during the prequeueing period
   *     if it exists.
   * 18. `isEventPrequeueing`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if an event is currently prequeueing users before it starts.
   * 19. `timeUntilEventStart`: Valid only when `isEventPrequeueing` is **true**.
   *     Integer indicating the number of minutes until the event starts.
   * 20. `timeUntilEventStartFormatted`: String displaying the `timeUntilEventStart`
   *     formatted in English for users. If `isEventPrequeueing` is **false**,
   *     `timeUntilEventStartFormatted` will display **unavailable**.
   * 21. `timeUntilEventEnd`: Valid only when `isEventActive` is **true**. Integer
   *     indicating the number of minutes until the event ends.
   * 22. `timeUntilEventEndFormatted`: String displaying the `timeUntilEventEnd`
   *     formatted in English for users. If `isEventActive` is **false**,
   *     `timeUntilEventEndFormatted` will display **unavailable**.
   * 23. `shuffleAtEventStart`: Valid only when `isEventActive` is **true**. Boolean
   *     indicating if the users in the prequeue are shuffled randomly when the event
   *     starts.
   * 24. `turnstile`: Empty when turnstile isn't enabled. String displaying an html
   *     tag to display the Turnstile widget. Please add the `{{{turnstile}}}` tag to
   *     the `custom_html` template to ensure the Turnstile widget appears.
   * 25. `infiniteQueue`: Boolean indicating whether the response is for a user in
   *     the infinite queue.
   *
   * An example cURL to a waiting room could be:
   *
   *     curl -X GET "https://example.com/waitingroom" \
   *     	-H "Accept: application/json"
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **fifo** and no event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 0,
   *     		"waitTime50Percentile": 0,
   *     		"waitTime75Percentile": 0,
   *     		"waitTimeFormatted": "10 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "fifo",
   *     		"isFIFOQueue": true,
   *     		"isRandomQueue": false,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": false,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 0,
   *     		"timeUntilEventEndFormatted": "unavailable",
   *     		"shuffleAtEventStart": false
   *     	}
   *     }
   *
   * If `json_response_enabled` is **true** and the request hits the waiting room, an
   * example JSON response when `queueingMethod` is **random** and an event is active
   * could be:
   *
   *     {
   *     	"cfWaitingRoom": {
   *     		"inWaitingRoom": true,
   *     		"waitTimeKnown": true,
   *     		"waitTime": 10,
   *     		"waitTime25Percentile": 5,
   *     		"waitTime50Percentile": 10,
   *     		"waitTime75Percentile": 15,
   *     		"waitTimeFormatted": "5 minutes to 15 minutes",
   *     		"queueIsFull": false,
   *     		"queueAll": false,
   *     		"lastUpdated": "2020-08-03T23:46:00.000Z",
   *     		"refreshIntervalSeconds": 20,
   *     		"queueingMethod": "random",
   *     		"isFIFOQueue": false,
   *     		"isRandomQueue": true,
   *     		"isPassthroughQueue": false,
   *     		"isRejectQueue": false,
   *     		"isEventActive": true,
   *     		"isEventPrequeueing": false,
   *     		"timeUntilEventStart": 0,
   *     		"timeUntilEventStartFormatted": "unavailable",
   *     		"timeUntilEventEnd": 15,
   *     		"timeUntilEventEndFormatted": "15 minutes",
   *     		"shuffleAtEventStart": true
   *     	}
   *     }
   */
  json_response_enabled?: boolean;

  /**
   * Body param: Sets the path within the host to enable the waiting room on. The
   * waiting room will be enabled for all subpaths as well. If there are two waiting
   * rooms on the same subpath, the waiting room for the most specific path will be
   * chosen. Wildcards and query parameters are not supported.
   */
  path?: string;

  /**
   * Body param: If queue_all is `true`, all the traffic that is coming to a route
   * will be sent to the waiting room. No new traffic can get to the route once this
   * field is set and estimated time will become unavailable.
   */
  queue_all?: boolean;

  /**
   * Body param: Sets the queueing method used by the waiting room. Changing this
   * parameter from the **default** queueing method is only available for the Waiting
   * Room Advanced subscription. Regardless of the queueing method, if `queue_all` is
   * enabled or an event is prequeueing, users in the waiting room will not be
   * accepted to the origin. These users will always see a waiting room page that
   * refreshes automatically. The valid queueing methods are:
   *
   * 1. `fifo` **(default)**: First-In-First-Out queue where customers gain access in
   *    the order they arrived.
   * 2. `random`: Random queue where customers gain access randomly, regardless of
   *    arrival time.
   * 3. `passthrough`: Users will pass directly through the waiting room and into the
   *    origin website. As a result, any configured limits will not be respected
   *    while this is enabled. This method can be used as an alternative to disabling
   *    a waiting room (with `suspended`) so that analytics are still reported. This
   *    can be used if you wish to allow all traffic normally, but want to restrict
   *    traffic during a waiting room event, or vice versa.
   * 4. `reject`: Users will be immediately rejected from the waiting room. As a
   *    result, no users will reach the origin website while this is enabled. This
   *    can be used if you wish to reject all traffic while performing maintenance,
   *    block traffic during a specified period of time (an event), or block traffic
   *    while events are not occurring. Consider a waiting room used for vaccine
   *    distribution that only allows traffic during sign-up events, and otherwise
   *    blocks all traffic. For this case, the waiting room uses `reject`, and its
   *    events override this with `fifo`, `random`, or `passthrough`. When this
   *    queueing method is enabled and neither `queueAll` is enabled nor an event is
   *    prequeueing, the waiting room page **will not refresh automatically**.
   */
  queueing_method?: 'fifo' | 'random' | 'passthrough' | 'reject';

  /**
   * Body param: HTTP status code returned to a user while in the queue.
   */
  queueing_status_code?: 200 | 202 | 429;

  /**
   * Body param: Lifetime of a cookie (in minutes) set by Cloudflare for users who
   * get access to the route. If a user is not seen by Cloudflare again in that time
   * period, they will be treated as a new user that visits the route.
   */
  session_duration?: number;

  /**
   * Body param: Suspends or allows traffic going to the waiting room. If set to
   * `true`, the traffic will not go to the waiting room.
   */
  suspended?: boolean;

  /**
   * Body param: Which action to take when a bot is detected using Turnstile. `log`
   * will have no impact on queueing behavior, simply keeping track of how many bots
   * are detected in Waiting Room Analytics. `infinite_queue` will send bots to a
   * false queueing state, where they will never reach your origin. `infinite_queue`
   * requires Advanced Waiting Room.
   */
  turnstile_action?: 'log' | 'infinite_queue';

  /**
   * Body param: Which Turnstile widget type to use for detecting bot traffic. See
   * [the Turnstile documentation](https://developers.cloudflare.com/turnstile/concepts/widget/#widget-types)
   * for the definitions of these widget types. Set to `off` to disable the Turnstile
   * integration entirely. Setting this to anything other than `off` or `invisible`
   * requires Advanced Waiting Room.
   */
  turnstile_mode?: 'off' | 'invisible' | 'visible_non_interactive' | 'visible_managed';
}

export interface WaitingRoomGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

WaitingRooms.WaitingRoomsV4PagePaginationArray = WaitingRoomsV4PagePaginationArray;
WaitingRooms.Page = Page;
WaitingRooms.Events = Events;
WaitingRooms.EventsV4PagePaginationArray = EventsV4PagePaginationArray;
WaitingRooms.Rules = Rules;
WaitingRooms.WaitingRoomRulesSinglePage = WaitingRoomRulesSinglePage;
WaitingRooms.Statuses = Statuses;
WaitingRooms.Settings = Settings;

export declare namespace WaitingRooms {
  export {
    type AdditionalRoutes as AdditionalRoutes,
    type CookieAttributes as CookieAttributes,
    type Query as Query,
    type WaitingRoom as WaitingRoom,
    type WaitingRoomDeleteResponse as WaitingRoomDeleteResponse,
    WaitingRoomsV4PagePaginationArray as WaitingRoomsV4PagePaginationArray,
    type WaitingRoomCreateParams as WaitingRoomCreateParams,
    type WaitingRoomUpdateParams as WaitingRoomUpdateParams,
    type WaitingRoomListParams as WaitingRoomListParams,
    type WaitingRoomDeleteParams as WaitingRoomDeleteParams,
    type WaitingRoomEditParams as WaitingRoomEditParams,
    type WaitingRoomGetParams as WaitingRoomGetParams,
  };

  export {
    Page as Page,
    type PagePreviewResponse as PagePreviewResponse,
    type PagePreviewParams as PagePreviewParams,
  };

  export {
    Events as Events,
    type Event as Event,
    type EventDeleteResponse as EventDeleteResponse,
    EventsV4PagePaginationArray as EventsV4PagePaginationArray,
    type EventCreateParams as EventCreateParams,
    type EventUpdateParams as EventUpdateParams,
    type EventListParams as EventListParams,
    type EventDeleteParams as EventDeleteParams,
    type EventEditParams as EventEditParams,
    type EventGetParams as EventGetParams,
  };

  export {
    Rules as Rules,
    type WaitingRoomRule as WaitingRoomRule,
    WaitingRoomRulesSinglePage as WaitingRoomRulesSinglePage,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleEditParams as RuleEditParams,
    type RuleGetParams as RuleGetParams,
  };

  export {
    Statuses as Statuses,
    type StatusGetResponse as StatusGetResponse,
    type StatusGetParams as StatusGetParams,
  };

  export {
    Settings as Settings,
    type Setting as Setting,
    type SettingUpdateResponse as SettingUpdateResponse,
    type SettingEditResponse as SettingEditResponse,
    type SettingGetResponse as SettingGetResponse,
    type SettingUpdateParams as SettingUpdateParams,
    type SettingEditParams as SettingEditParams,
    type SettingGetParams as SettingGetParams,
  };
}
