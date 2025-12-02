// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class ASN extends APIResource {
  /**
   * Gets all the data the botnet tracking database has for a given ASN registered to
   * user account for given date. If no date is given, it will return results for the
   * previous day.
   */
  dayReport(
    asnId: number,
    params: ASNDayReportParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ASNDayReportResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/botnet_feed/asn/${asnId}/day_report`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: ASNDayReportResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Gets all the data the botnet threat feed tracking database has for a given ASN
   * registered to user account.
   */
  fullReport(
    asnId: number,
    params: ASNFullReportParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ASNFullReportResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/botnet_feed/asn/${asnId}/full_report`,
        options,
      ) as Core.APIPromise<{ result: ASNFullReportResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ASNDayReportResponse {
  cidr?: string;

  date?: string;

  offense_count?: number;
}

export interface ASNFullReportResponse {
  cidr?: string;

  date?: string;

  offense_count?: number;
}

export interface ASNDayReportParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param:
   */
  date?: string;
}

export interface ASNFullReportParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace ASN {
  export {
    type ASNDayReportResponse as ASNDayReportResponse,
    type ASNFullReportResponse as ASNFullReportResponse,
    type ASNDayReportParams as ASNDayReportParams,
    type ASNFullReportParams as ASNFullReportParams,
  };
}
