// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class Versions extends APIResource {
  /**
   * List deployed Workflow versions
   */
  list(
    workflowName: string,
    params: VersionListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<VersionListResponsesV4PagePaginationArray, VersionListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workflows/${workflowName}/versions`,
      VersionListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Get Workflow version details
   */
  get(
    workflowName: string,
    versionId: string,
    params: VersionGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VersionGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workflows/${workflowName}/versions/${versionId}`,
        options,
      ) as Core.APIPromise<{ result: VersionGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class VersionListResponsesV4PagePaginationArray extends V4PagePaginationArray<VersionListResponse> {}

export interface VersionListResponse {
  id: string;

  class_name: string;

  created_on: string;

  modified_on: string;

  workflow_id: string;
}

export interface VersionGetResponse {
  id: string;

  class_name: string;

  created_on: string;

  modified_on: string;

  workflow_id: string;
}

export interface VersionListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;
}

export interface VersionGetParams {
  account_id: string;
}

Versions.VersionListResponsesV4PagePaginationArray = VersionListResponsesV4PagePaginationArray;

export declare namespace Versions {
  export {
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesV4PagePaginationArray as VersionListResponsesV4PagePaginationArray,
    type VersionListParams as VersionListParams,
    type VersionGetParams as VersionGetParams,
  };
}
