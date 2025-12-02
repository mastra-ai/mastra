// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import { V4PagePagination, type V4PagePaginationParams } from '../../../../pagination';

export class Events extends APIResource {
  /**
   * Retrieves the BGP route leak events.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const eventListResponse of client.radar.bgp.leaks.events.list()) {
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
    return this._client.getAPIList('/radar/bgp/leaks/events', EventListResponsesV4PagePagination, {
      query,
      ...options,
    });
  }
}

export class EventListResponsesV4PagePagination extends V4PagePagination<EventListResponse> {}

export interface EventListResponse {
  asn_info: Array<EventListResponse.ASNInfo>;

  events: Array<EventListResponse.Event>;
}

export namespace EventListResponse {
  export interface ASNInfo {
    asn: number;

    country_code: string;

    org_name: string;
  }

  export interface Event {
    id: number;

    countries: Array<string>;

    detected_ts: string;

    finished: boolean;

    leak_asn: number;

    leak_count: number;

    leak_seg: Array<number>;

    leak_type: number;

    max_ts: string;

    min_ts: string;

    origin_count: number;

    peer_count: number;

    prefix_count: number;
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
   * ASN that is causing or affected by a route leak event.
   */
  involvedAsn?: number;

  /**
   * Country code of a involved ASN in a route leak event.
   */
  involvedCountry?: string;

  /**
   * The leaking AS of a route leak event.
   */
  leakAsn?: number;

  /**
   * Sorts results by the specified field.
   */
  sortBy?: 'ID' | 'LEAKS' | 'PEERS' | 'PREFIXES' | 'ORIGINS' | 'TIME';

  /**
   * Sort order.
   */
  sortOrder?: 'ASC' | 'DESC';
}

Events.EventListResponsesV4PagePagination = EventListResponsesV4PagePagination;

export declare namespace Events {
  export {
    type EventListResponse as EventListResponse,
    EventListResponsesV4PagePagination as EventListResponsesV4PagePagination,
    type EventListParams as EventListParams,
  };
}
