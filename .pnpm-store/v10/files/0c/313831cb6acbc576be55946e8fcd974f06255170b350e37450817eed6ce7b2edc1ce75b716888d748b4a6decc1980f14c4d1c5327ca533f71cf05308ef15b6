// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { CloudflareError } from '../../error';

export class Validate extends APIResource {
  /**
   * Validates destination.
   *
   * @example
   * ```ts
   * const response = await client.logpush.validate.destination({
   *   destination_conf: 's3://mybucket/logs?region=us-west-2',
   *   account_id: 'account_id',
   * });
   * ```
   */
  destination(
    params: ValidateDestinationParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ValidateDestinationResponse | null> {
    const { account_id, zone_id, ...body } = params;
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
    return (
      this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/validate/destination`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ValidateDestinationResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Checks if there is an existing job with a destination.
   *
   * @example
   * ```ts
   * const response =
   *   await client.logpush.validate.destinationExists({
   *     destination_conf: 's3://mybucket/logs?region=us-west-2',
   *     account_id: 'account_id',
   *   });
   * ```
   */
  destinationExists(
    params: ValidateDestinationExistsParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ValidateDestinationExistsResponse | null> {
    const { account_id, zone_id, ...body } = params;
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
    return (
      this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/validate/destination/exists`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ValidateDestinationExistsResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Validates logpull origin with logpull_options.
   *
   * @example
   * ```ts
   * const response = await client.logpush.validate.origin({
   *   logpull_options:
   *     'fields=RayID,ClientIP,EdgeStartTimestamp&timestamps=rfc3339',
   *   account_id: 'account_id',
   * });
   * ```
   */
  origin(
    params: ValidateOriginParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ValidateOriginResponse | null> {
    const { account_id, zone_id, ...body } = params;
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
    return (
      this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/validate/origin`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ValidateOriginResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ValidateDestinationResponse {
  message?: string;

  valid?: boolean;
}

export interface ValidateDestinationExistsResponse {
  exists?: boolean;
}

export interface ValidateOriginResponse {
  message?: string;

  valid?: boolean;
}

export interface ValidateDestinationParams {
  /**
   * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
   * will be pushed. Additional configuration parameters supported by the destination
   * may be included.
   */
  destination_conf: string;

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

export interface ValidateDestinationExistsParams {
  /**
   * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
   * will be pushed. Additional configuration parameters supported by the destination
   * may be included.
   */
  destination_conf: string;

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

export interface ValidateOriginParams {
  /**
   * @deprecated Body param: This field is deprecated. Use `output_options` instead.
   * Configuration string. It specifies things like requested fields and timestamp
   * formats. If migrating from the logpull api, copy the url (full url or just the
   * query string) of your call here, and logpush will keep on making this call for
   * you, setting start and end times appropriately.
   */
  logpull_options: string | null;

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

export declare namespace Validate {
  export {
    type ValidateDestinationResponse as ValidateDestinationResponse,
    type ValidateDestinationExistsResponse as ValidateDestinationExistsResponse,
    type ValidateOriginResponse as ValidateOriginResponse,
    type ValidateDestinationParams as ValidateDestinationParams,
    type ValidateDestinationExistsParams as ValidateDestinationExistsParams,
    type ValidateOriginParams as ValidateOriginParams,
  };
}
