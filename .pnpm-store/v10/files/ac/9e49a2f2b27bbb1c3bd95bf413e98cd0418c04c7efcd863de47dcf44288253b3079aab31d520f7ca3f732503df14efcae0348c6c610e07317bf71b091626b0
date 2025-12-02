// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as DetectionsAPI from './detections';
import {
  DetectionCreateParams,
  DetectionCreateResponse,
  DetectionDeleteParams,
  DetectionDeleteResponse,
  DetectionListParams,
  DetectionListResponse,
  DetectionListResponsesSinglePage,
  DetectionUpdateParams,
  DetectionUpdateResponse,
  Detections,
} from './detections';

export class LeakedCredentialChecks extends APIResource {
  detections: DetectionsAPI.Detections = new DetectionsAPI.Detections(this._client);

  /**
   * Updates the current status of Leaked Credential Checks.
   *
   * @example
   * ```ts
   * const leakedCredentialCheck =
   *   await client.leakedCredentialChecks.create({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  create(
    params: LeakedCredentialCheckCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LeakedCredentialCheckCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/leaked-credential-checks`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: LeakedCredentialCheckCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves the current status of Leaked Credential Checks.
   *
   * @example
   * ```ts
   * const leakedCredentialCheck =
   *   await client.leakedCredentialChecks.get({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(
    params: LeakedCredentialCheckGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LeakedCredentialCheckGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/leaked-credential-checks`, options) as Core.APIPromise<{
        result: LeakedCredentialCheckGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Defines the overall status for Leaked Credential Checks.
 */
export interface LeakedCredentialCheckCreateResponse {
  /**
   * Determines whether or not Leaked Credential Checks are enabled.
   */
  enabled?: boolean;
}

/**
 * Defines the overall status for Leaked Credential Checks.
 */
export interface LeakedCredentialCheckGetResponse {
  /**
   * Determines whether or not Leaked Credential Checks are enabled.
   */
  enabled?: boolean;
}

export interface LeakedCredentialCheckCreateParams {
  /**
   * Path param: Defines an identifier.
   */
  zone_id: string;

  /**
   * Body param: Determines whether or not Leaked Credential Checks are enabled.
   */
  enabled?: boolean;
}

export interface LeakedCredentialCheckGetParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

LeakedCredentialChecks.Detections = Detections;
LeakedCredentialChecks.DetectionListResponsesSinglePage = DetectionListResponsesSinglePage;

export declare namespace LeakedCredentialChecks {
  export {
    type LeakedCredentialCheckCreateResponse as LeakedCredentialCheckCreateResponse,
    type LeakedCredentialCheckGetResponse as LeakedCredentialCheckGetResponse,
    type LeakedCredentialCheckCreateParams as LeakedCredentialCheckCreateParams,
    type LeakedCredentialCheckGetParams as LeakedCredentialCheckGetParams,
  };

  export {
    Detections as Detections,
    type DetectionCreateResponse as DetectionCreateResponse,
    type DetectionUpdateResponse as DetectionUpdateResponse,
    type DetectionListResponse as DetectionListResponse,
    type DetectionDeleteResponse as DetectionDeleteResponse,
    DetectionListResponsesSinglePage as DetectionListResponsesSinglePage,
    type DetectionCreateParams as DetectionCreateParams,
    type DetectionUpdateParams as DetectionUpdateParams,
    type DetectionListParams as DetectionListParams,
    type DetectionDeleteParams as DetectionDeleteParams,
  };
}
