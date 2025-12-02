// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import * as IssuesAPI from '../../intel/attack-surface-report/issues';
import * as ClassAPI from './class';
import { Class, ClassGetParams, ClassGetResponse } from './class';
import * as SeverityAPI from './severity';
import { Severity, SeverityGetParams, SeverityGetResponse } from './severity';
import * as TypeAPI from './type';
import { Type, TypeGetParams, TypeGetResponse } from './type';
import { CloudflareError } from '../../../error';
import { V4PagePagination, type V4PagePaginationParams } from '../../../pagination';

export class Insights extends APIResource {
  class: ClassAPI.Class = new ClassAPI.Class(this._client);
  severity: SeverityAPI.Severity = new SeverityAPI.Severity(this._client);
  type: TypeAPI.Type = new TypeAPI.Type(this._client);

  /**
   * Get Security Center Insights
   */
  list(
    params?: InsightListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<InsightListResponsesV4PagePagination, InsightListResponse>;
  list(
    options?: Core.RequestOptions,
  ): Core.PagePromise<InsightListResponsesV4PagePagination, InsightListResponse>;
  list(
    params: InsightListParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.PagePromise<InsightListResponsesV4PagePagination, InsightListResponse> {
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
      `/${accountOrZone}/${accountOrZoneId}/security-center/insights`,
      InsightListResponsesV4PagePagination,
      { query, ...options },
    );
  }

  /**
   * Archive Security Center Insight
   */
  dismiss(
    issueId: string,
    params: InsightDismissParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InsightDismissResponse> {
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
    return this._client.put(
      `/${accountOrZone}/${accountOrZoneId}/security-center/insights/${issueId}/dismiss`,
      { body, ...options },
    );
  }
}

export class InsightListResponsesV4PagePagination extends V4PagePagination<InsightListResponse> {}

export interface InsightListResponse {
  /**
   * Total number of results
   */
  count?: number;

  issues?: Array<InsightListResponse.Issue>;

  /**
   * Current page within paginated list of results
   */
  page?: number;

  /**
   * Number of results per page of results
   */
  per_page?: number;
}

export namespace InsightListResponse {
  export interface Issue {
    id?: string;

    dismissed?: boolean;

    issue_class?: string;

    issue_type?: IssuesAPI.IssueType;

    payload?: unknown;

    resolve_link?: string;

    resolve_text?: string;

    severity?: 'Low' | 'Moderate' | 'Critical';

    since?: string;

    subject?: string;

    timestamp?: string;
  }
}

export interface InsightDismissResponse {
  errors: Array<InsightDismissResponse.Error>;

  messages: Array<InsightDismissResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace InsightDismissResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }
}

export interface InsightListParams extends V4PagePaginationParams {
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

  /**
   * Query param:
   */
  dismissed?: boolean;

  /**
   * Query param:
   */
  issue_class?: Array<string>;

  /**
   * Query param:
   */
  'issue_class~neq'?: Array<string>;

  /**
   * Query param:
   */
  issue_type?: Array<IssuesAPI.IssueTypeParam>;

  /**
   * Query param:
   */
  'issue_type~neq'?: Array<IssuesAPI.IssueTypeParam>;

  /**
   * Query param:
   */
  product?: Array<string>;

  /**
   * Query param:
   */
  'product~neq'?: Array<string>;

  /**
   * Query param:
   */
  severity?: Array<IssuesAPI.SeverityQueryParamParam>;

  /**
   * Query param:
   */
  'severity~neq'?: Array<IssuesAPI.SeverityQueryParamParam>;

  /**
   * Query param:
   */
  subject?: Array<string>;

  /**
   * Query param:
   */
  'subject~neq'?: Array<string>;
}

export interface InsightDismissParams {
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

  /**
   * Body param:
   */
  dismiss?: boolean;
}

Insights.InsightListResponsesV4PagePagination = InsightListResponsesV4PagePagination;
Insights.Class = Class;
Insights.Severity = Severity;
Insights.Type = Type;

export declare namespace Insights {
  export {
    type InsightListResponse as InsightListResponse,
    type InsightDismissResponse as InsightDismissResponse,
    InsightListResponsesV4PagePagination as InsightListResponsesV4PagePagination,
    type InsightListParams as InsightListParams,
    type InsightDismissParams as InsightDismissParams,
  };

  export { Class as Class, type ClassGetResponse as ClassGetResponse, type ClassGetParams as ClassGetParams };

  export {
    Severity as Severity,
    type SeverityGetResponse as SeverityGetResponse,
    type SeverityGetParams as SeverityGetParams,
  };

  export { Type as Type, type TypeGetResponse as TypeGetResponse, type TypeGetParams as TypeGetParams };
}
