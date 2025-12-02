// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as IssuesAPI from './issues';
import { V4PagePagination, type V4PagePaginationParams } from '../../../pagination';

export class Issues extends APIResource {
  /**
   * Get Security Center Issues
   *
   * @deprecated
   */
  list(
    params: IssueListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<IssueListResponsesV4PagePagination, IssueListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/intel/attack-surface-report/issues`,
      IssueListResponsesV4PagePagination,
      { query, ...options },
    );
  }

  /**
   * Get Security Center Issue Counts by Class
   *
   * @deprecated
   */
  class(params: IssueClassParams, options?: Core.RequestOptions): Core.APIPromise<IssueClassResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/intel/attack-surface-report/issues/class`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: IssueClassResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Archive Security Center Insight
   *
   * @deprecated
   */
  dismiss(
    issueId: string,
    params: IssueDismissParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IssueDismissResponse> {
    const { account_id, ...body } = params;
    return this._client.put(`/accounts/${account_id}/intel/attack-surface-report/${issueId}/dismiss`, {
      body,
      ...options,
    });
  }

  /**
   * Get Security Center Issue Counts by Severity
   *
   * @deprecated
   */
  severity(
    params: IssueSeverityParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IssueSeverityResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/intel/attack-surface-report/issues/severity`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: IssueSeverityResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Security Center Issue Counts by Type
   *
   * @deprecated
   */
  type(params: IssueTypeParams, options?: Core.RequestOptions): Core.APIPromise<IssueTypeResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/intel/attack-surface-report/issues/type`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: IssueTypeResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class IssueListResponsesV4PagePagination extends V4PagePagination<IssueListResponse> {}

export type IssueType =
  | 'compliance_violation'
  | 'email_security'
  | 'exposed_infrastructure'
  | 'insecure_configuration'
  | 'weak_authentication';

export type IssueTypeParam =
  | 'compliance_violation'
  | 'email_security'
  | 'exposed_infrastructure'
  | 'insecure_configuration'
  | 'weak_authentication';

export type SeverityQueryParam = 'low' | 'moderate' | 'critical';

export type SeverityQueryParamParam = 'low' | 'moderate' | 'critical';

export interface IssueListResponse {
  /**
   * Total number of results
   */
  count?: number;

  issues?: Array<IssueListResponse.Issue>;

  /**
   * Current page within paginated list of results
   */
  page?: number;

  /**
   * Number of results per page of results
   */
  per_page?: number;
}

export namespace IssueListResponse {
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

export type IssueClassResponse = Array<IssueClassResponse.IssueClassResponseItem>;

export namespace IssueClassResponse {
  export interface IssueClassResponseItem {
    count?: number;

    value?: string;
  }
}

export interface IssueDismissResponse {
  errors: Array<IssueDismissResponse.Error>;

  messages: Array<IssueDismissResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace IssueDismissResponse {
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

export type IssueSeverityResponse = Array<IssueSeverityResponse.IssueSeverityResponseItem>;

export namespace IssueSeverityResponse {
  export interface IssueSeverityResponseItem {
    count?: number;

    value?: string;
  }
}

export type IssueTypeResponse = Array<IssueTypeResponse.IssueTypeResponseItem>;

export namespace IssueTypeResponse {
  export interface IssueTypeResponseItem {
    count?: number;

    value?: string;
  }
}

export interface IssueListParams extends V4PagePaginationParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

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
  issue_type?: Array<IssueTypeParam>;

  /**
   * Query param:
   */
  'issue_type~neq'?: Array<IssueTypeParam>;

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
  severity?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  'severity~neq'?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  subject?: Array<string>;

  /**
   * Query param:
   */
  'subject~neq'?: Array<string>;
}

export interface IssueClassParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

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
  issue_type?: Array<IssueTypeParam>;

  /**
   * Query param:
   */
  'issue_type~neq'?: Array<IssueTypeParam>;

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
  severity?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  'severity~neq'?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  subject?: Array<string>;

  /**
   * Query param:
   */
  'subject~neq'?: Array<string>;
}

export interface IssueDismissParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  dismiss?: boolean;
}

export interface IssueSeverityParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

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
  issue_type?: Array<IssueTypeParam>;

  /**
   * Query param:
   */
  'issue_type~neq'?: Array<IssueTypeParam>;

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
  severity?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  'severity~neq'?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  subject?: Array<string>;

  /**
   * Query param:
   */
  'subject~neq'?: Array<string>;
}

export interface IssueTypeParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

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
  issue_type?: Array<IssueTypeParam>;

  /**
   * Query param:
   */
  'issue_type~neq'?: Array<IssueTypeParam>;

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
  severity?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  'severity~neq'?: Array<SeverityQueryParamParam>;

  /**
   * Query param:
   */
  subject?: Array<string>;

  /**
   * Query param:
   */
  'subject~neq'?: Array<string>;
}

Issues.IssueListResponsesV4PagePagination = IssueListResponsesV4PagePagination;

export declare namespace Issues {
  export {
    type IssueType as IssueType,
    type SeverityQueryParam as SeverityQueryParam,
    type IssueListResponse as IssueListResponse,
    type IssueClassResponse as IssueClassResponse,
    type IssueDismissResponse as IssueDismissResponse,
    type IssueSeverityResponse as IssueSeverityResponse,
    type IssueTypeResponse as IssueTypeResponse,
    IssueListResponsesV4PagePagination as IssueListResponsesV4PagePagination,
    type IssueListParams as IssueListParams,
    type IssueClassParams as IssueClassParams,
    type IssueDismissParams as IssueDismissParams,
    type IssueSeverityParams as IssueSeverityParams,
    type IssueTypeParams as IssueTypeParams,
  };
}
