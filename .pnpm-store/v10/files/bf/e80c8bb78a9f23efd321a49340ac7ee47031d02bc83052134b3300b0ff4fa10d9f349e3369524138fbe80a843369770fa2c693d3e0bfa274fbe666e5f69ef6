// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as CORSAPI from './cors';
import {
  CORS,
  CORSDeleteParams,
  CORSDeleteResponse,
  CORSGetParams,
  CORSGetResponse,
  CORSUpdateParams,
  CORSUpdateResponse,
} from './cors';
import * as EventNotificationsAPI from './event-notifications';
import {
  EventNotificationDeleteParams,
  EventNotificationDeleteResponse,
  EventNotificationGetParams,
  EventNotificationGetResponse,
  EventNotificationListParams,
  EventNotificationListResponse,
  EventNotificationUpdateParams,
  EventNotificationUpdateResponse,
  EventNotifications,
} from './event-notifications';
import * as LifecycleAPI from './lifecycle';
import {
  Lifecycle,
  LifecycleGetParams,
  LifecycleGetResponse,
  LifecycleUpdateParams,
  LifecycleUpdateResponse,
} from './lifecycle';
import * as LocksAPI from './locks';
import { LockGetParams, LockGetResponse, LockUpdateParams, LockUpdateResponse, Locks } from './locks';
import * as MetricsAPI from './metrics';
import { MetricListParams, MetricListResponse, Metrics } from './metrics';
import * as SippyAPI from './sippy';
import {
  Provider,
  Sippy,
  SippyDeleteParams,
  SippyDeleteResponse,
  SippyGetParams,
  SippyResource,
  SippyUpdateParams,
} from './sippy';
import * as DomainsAPI from './domains/domains';
import { Domains } from './domains/domains';

export class Buckets extends APIResource {
  lifecycle: LifecycleAPI.Lifecycle = new LifecycleAPI.Lifecycle(this._client);
  cors: CORSAPI.CORS = new CORSAPI.CORS(this._client);
  domains: DomainsAPI.Domains = new DomainsAPI.Domains(this._client);
  eventNotifications: EventNotificationsAPI.EventNotifications = new EventNotificationsAPI.EventNotifications(
    this._client,
  );
  locks: LocksAPI.Locks = new LocksAPI.Locks(this._client);
  metrics: MetricsAPI.Metrics = new MetricsAPI.Metrics(this._client);
  sippy: SippyAPI.SippyResource = new SippyAPI.SippyResource(this._client);

  /**
   * Creates a new R2 bucket.
   *
   * @example
   * ```ts
   * const bucket = await client.r2.buckets.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   name: 'example-bucket',
   * });
   * ```
   */
  create(params: BucketCreateParams, options?: Core.RequestOptions): Core.APIPromise<Bucket> {
    const { account_id, jurisdiction, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/r2/buckets`, {
        body,
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: Bucket }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists all R2 buckets on your account.
   *
   * @example
   * ```ts
   * const buckets = await client.r2.buckets.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  list(params: BucketListParams, options?: Core.RequestOptions): Core.APIPromise<BucketListResponse> {
    const { account_id, jurisdiction, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/r2/buckets`, {
        query,
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: BucketListResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes an existing R2 bucket.
   *
   * @example
   * ```ts
   * const bucket = await client.r2.buckets.delete(
   *   'example-bucket',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    bucketName: string,
    params: BucketDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BucketDeleteResponse> {
    const { account_id, jurisdiction } = params;
    return (
      this._client.delete(`/accounts/${account_id}/r2/buckets/${bucketName}`, {
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: BucketDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates properties of an existing R2 bucket.
   *
   * @example
   * ```ts
   * const bucket = await client.r2.buckets.edit(
   *   'example-bucket',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     storage_class: 'Standard',
   *   },
   * );
   * ```
   */
  edit(bucketName: string, params: BucketEditParams, options?: Core.RequestOptions): Core.APIPromise<Bucket> {
    const { account_id, storage_class, jurisdiction } = params;
    return (
      this._client.patch(`/accounts/${account_id}/r2/buckets/${bucketName}`, {
        ...options,
        headers: {
          'cf-r2-storage-class': storage_class.toString(),
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: Bucket }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets properties of an existing R2 bucket.
   *
   * @example
   * ```ts
   * const bucket = await client.r2.buckets.get(
   *   'example-bucket',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(bucketName: string, params: BucketGetParams, options?: Core.RequestOptions): Core.APIPromise<Bucket> {
    const { account_id, jurisdiction } = params;
    return (
      this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}`, {
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: Bucket }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * A single R2 bucket.
 */
export interface Bucket {
  /**
   * Creation timestamp.
   */
  creation_date?: string;

  /**
   * Jurisdiction where objects in this bucket are guaranteed to be stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';

  /**
   * Location of the bucket.
   */
  location?: 'apac' | 'eeur' | 'enam' | 'weur' | 'wnam' | 'oc';

  /**
   * Name of the bucket.
   */
  name?: string;

  /**
   * Storage class for newly uploaded objects, unless specified otherwise.
   */
  storage_class?: 'Standard' | 'InfrequentAccess';
}

export interface BucketListResponse {
  buckets?: Array<Bucket>;
}

export type BucketDeleteResponse = unknown;

export interface BucketCreateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param: Name of the bucket.
   */
  name: string;

  /**
   * Body param: Location of the bucket.
   */
  locationHint?: 'apac' | 'eeur' | 'enam' | 'weur' | 'wnam' | 'oc';

  /**
   * Body param: Storage class for newly uploaded objects, unless specified
   * otherwise.
   */
  storageClass?: 'Standard' | 'InfrequentAccess';

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export interface BucketListParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Query param: Pagination cursor received during the last List Buckets call. R2
   * buckets are paginated using cursors instead of page numbers.
   */
  cursor?: string;

  /**
   * Query param: Direction to order buckets.
   */
  direction?: 'asc' | 'desc';

  /**
   * Query param: Bucket names to filter by. Only buckets with this phrase in their
   * name will be returned.
   */
  name_contains?: string;

  /**
   * Query param: Field to order buckets by.
   */
  order?: 'name';

  /**
   * Query param: Maximum number of buckets to return in a single call.
   */
  per_page?: number;

  /**
   * Query param: Bucket name to start searching after. Buckets are ordered
   * lexicographically.
   */
  start_after?: string;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export interface BucketDeleteParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export interface BucketEditParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Header param: Storage class for newly uploaded objects, unless specified
   * otherwise.
   */
  storage_class: 'Standard' | 'InfrequentAccess';

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export interface BucketGetParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

Buckets.Lifecycle = Lifecycle;
Buckets.CORS = CORS;
Buckets.Domains = Domains;
Buckets.EventNotifications = EventNotifications;
Buckets.Locks = Locks;
Buckets.Metrics = Metrics;
Buckets.SippyResource = SippyResource;

export declare namespace Buckets {
  export {
    type Bucket as Bucket,
    type BucketListResponse as BucketListResponse,
    type BucketDeleteResponse as BucketDeleteResponse,
    type BucketCreateParams as BucketCreateParams,
    type BucketListParams as BucketListParams,
    type BucketDeleteParams as BucketDeleteParams,
    type BucketEditParams as BucketEditParams,
    type BucketGetParams as BucketGetParams,
  };

  export {
    Lifecycle as Lifecycle,
    type LifecycleUpdateResponse as LifecycleUpdateResponse,
    type LifecycleGetResponse as LifecycleGetResponse,
    type LifecycleUpdateParams as LifecycleUpdateParams,
    type LifecycleGetParams as LifecycleGetParams,
  };

  export {
    CORS as CORS,
    type CORSUpdateResponse as CORSUpdateResponse,
    type CORSDeleteResponse as CORSDeleteResponse,
    type CORSGetResponse as CORSGetResponse,
    type CORSUpdateParams as CORSUpdateParams,
    type CORSDeleteParams as CORSDeleteParams,
    type CORSGetParams as CORSGetParams,
  };

  export { Domains as Domains };

  export {
    EventNotifications as EventNotifications,
    type EventNotificationUpdateResponse as EventNotificationUpdateResponse,
    type EventNotificationListResponse as EventNotificationListResponse,
    type EventNotificationDeleteResponse as EventNotificationDeleteResponse,
    type EventNotificationGetResponse as EventNotificationGetResponse,
    type EventNotificationUpdateParams as EventNotificationUpdateParams,
    type EventNotificationListParams as EventNotificationListParams,
    type EventNotificationDeleteParams as EventNotificationDeleteParams,
    type EventNotificationGetParams as EventNotificationGetParams,
  };

  export {
    Locks as Locks,
    type LockUpdateResponse as LockUpdateResponse,
    type LockGetResponse as LockGetResponse,
    type LockUpdateParams as LockUpdateParams,
    type LockGetParams as LockGetParams,
  };

  export {
    Metrics as Metrics,
    type MetricListResponse as MetricListResponse,
    type MetricListParams as MetricListParams,
  };

  export {
    SippyResource as SippyResource,
    type Provider as Provider,
    type Sippy as Sippy,
    type SippyDeleteResponse as SippyDeleteResponse,
    type SippyUpdateParams as SippyUpdateParams,
    type SippyDeleteParams as SippyDeleteParams,
    type SippyGetParams as SippyGetParams,
  };
}
