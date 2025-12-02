// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import { V4PagePagination, type V4PagePaginationParams } from '../../../../pagination';

export class Events extends APIResource {
  /**
   * Retrieves the BGP hijack events.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const eventListResponse of client.radar.bgp.hijacks.events.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    query?: EventListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<EventListResponsesV4PagePagination, EventListResponse>;
  list(
    options?: Core.RequestOptions,
  ): Core.PagePromise<EventListResponsesV4PagePagination, EventListResponse>;
  list(
    query: EventListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<EventListResponsesV4PagePagination, EventListResponse> {
    if (isRequestOptions(query)) {
      return this.list({}, query);
    }
    return this._client.getAPIList('/radar/bgp/hijacks/events', EventListResponsesV4PagePagination, {
      query,
      ...options,
    });
  }
}

export class EventListResponsesV4PagePagination extends V4PagePagination<EventListResponse> {}

export interface EventListResponse {
  asn_info: Array<EventListResponse.ASNInfo>;

  events: Array<EventListResponse.Event>;

  total_monitors: number;
}

export namespace EventListResponse {
  export interface ASNInfo {
    asn: number;

    country_code: string;

    org_name: string;
  }

  export interface Event {
    id: number;

    confidence_score: number;

    duration: number;

    event_type: number;

    hijack_msgs_count: number;

    hijacker_asn: number;

    hijacker_country: string;

    is_stale: boolean;

    max_hijack_ts: string;

    max_msg_ts: string;

    min_hijack_ts: string;

    on_going_count: number;

    peer_asns: Array<number>;

    peer_ip_count: number;

    prefixes: Array<string>;

    tags: Array<Event.Tag>;

    victim_asns: Array<number>;

    victim_countries: Array<string>;
  }

  export namespace Event {
    export interface Tag {
      name: string;

      score: number;
    }
  }
}

export interface EventListParams extends V4PagePaginationParams {
  /**
   * End of the date range (inclusive).
   */
  dateEnd?: string;

  /**
   * Filters results by date range.
   */
  dateRange?: string;

  /**
   * Start of the date range (inclusive).
   */
  dateStart?: string;

  /**
   * The unique identifier of a event.
   */
  eventId?: number;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * The potential hijacker AS of a BGP hijack event.
   */
  hijackerAsn?: number;

  /**
   * The potential hijacker or victim AS of a BGP hijack event.
   */
  involvedAsn?: number;

  /**
   * The country code of the potential hijacker or victim AS of a BGP hijack event.
   */
  involvedCountry?: string;

  /**
   * Filters events by maximum confidence score (1-4 low, 5-7 mid, 8+ high).
   */
  maxConfidence?: number;

  /**
   * Filters events by minimum confidence score (1-4 low, 5-7 mid, 8+ high).
   */
  minConfidence?: number;

  /**
   * Network prefix, IPv4 or IPv6.
   */
  prefix?: string;

  /**
   * Sorts results by the specified field.
   */
  sortBy?: 'ID' | 'TIME' | 'CONFIDENCE';

  /**
   * Sort order.
   */
  sortOrder?: 'ASC' | 'DESC';

  /**
   * The potential victim AS of a BGP hijack event.
   */
  victimAsn?: number;
}

Events.EventListResponsesV4PagePagination = EventListResponsesV4PagePagination;

export declare namespace Events {
  export {
    type EventListResponse as EventListResponse,
    EventListResponsesV4PagePagination as EventListResponsesV4PagePagination,
    type EventListParams as EventListParams,
  };
}
