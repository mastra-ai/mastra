// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class AbuseReports extends APIResource {
  /**
   * Submit the Abuse Report of a particular type
   *
   * @example
   * ```ts
   * const abuseReport = await client.abuseReports.create(
   *   'abuse_general',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     act: 'abuse_general',
   *     email: 'email',
   *     email2: 'email2',
   *     name: 'x',
   *     urls: 'urls',
   *   },
   * );
   * ```
   */
  create(
    reportType:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei',
    params: AbuseReportCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AbuseReportCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/abuse-reports/${reportType}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: AbuseReportCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * The result should be 'success' for successful response
 */
export type AbuseReportCreateResponse = string;

export type AbuseReportCreateParams =
  | AbuseReportCreateParams.AbuseReportsDmcaReport
  | AbuseReportCreateParams.AbuseReportsTrademarkReport
  | AbuseReportCreateParams.AbuseReportsGeneralReport
  | AbuseReportCreateParams.AbuseReportsPhishingReport
  | AbuseReportCreateParams.AbuseReportsChildrenAbuseReport
  | AbuseReportCreateParams.AbuseReportsThreatReport
  | AbuseReportCreateParams.AbuseReportsRegistrarWhoisReport
  | AbuseReportCreateParams.AbuseReportsNcseiReport;

export declare namespace AbuseReportCreateParams {
  export interface AbuseReportsDmcaReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsTrademarkReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsGeneralReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsPhishingReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsChildrenAbuseReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsThreatReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsRegistrarWhoisReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }

  export interface AbuseReportsNcseiReport {
    /**
     * Path param: The account ID of the submitter.
     */
    account_id: string;

    /**
     * Body param: The abuse report type
     */
    act:
      | 'abuse_dmca'
      | 'abuse_trademark'
      | 'abuse_general'
      | 'abuse_phishing'
      | 'abuse_children'
      | 'abuse_threat'
      | 'abuse_registrar_whois'
      | 'abuse_ncsei';

    /**
     * Body param: A valid email of the abuse reporter. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    email: string;

    /**
     * Body param: Should match the value provided in `email`
     */
    email2: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    name: string;

    /**
     * Body param: A list of valid URLs separated by ‘ ’ (new line character). The list
     * of the URLs should not exceed 250 URLs. All URLs should have the same hostname.
     * Each URL should be unique. This field may be released by Cloudflare to third
     * parties such as the Lumen Database (https://lumendatabase.org/).
     */
    urls: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    address1?: string;

    /**
     * Body param: The name of the copyright holder. Text not exceeding 60 characters.
     * This field may be released by Cloudflare to third parties such as the Lumen
     * Database (https://lumendatabase.org/).
     */
    agent_name?: string;

    /**
     * Body param: Can be `0` for false or `1` for true. Must be value: 1 for DMCA
     * reports
     */
    agree?: 0 | 1;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    city?: string;

    /**
     * Body param: Any additional comments about the infringement not exceeding 2000
     * characters
     */
    comments?: string;

    /**
     * Body param: Text not exceeding 100 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    company?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    country?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of destination IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    destination_ips?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    host_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A detailed description of the infringement, including any necessary
     * access details and the exact steps needed to view the content, not exceeding
     * 5000 characters
     */
    justification?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    ncmec_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: If the submitter is the target of NCSEI in the URLs of the abuse
     * report.
     */
    ncsei_subject_representation?: boolean;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    original_work?: string;

    /**
     * Body param: Notification type based on the abuse type. NOTE: Copyright (DMCA)
     * and Trademark reports cannot be anonymous.
     */
    owner_notification?: 'send' | 'send-anon' | 'none';

    /**
     * Body param: A comma separated list of ports and protocols e.g. 80/TCP, 22/UDP.
     * The total size of the field should not exceed 2000 characters. Each individual
     * port/protocol should not exceed 100 characters. The list should not have more
     * than 30 unique ports and protocols.
     */
    ports_protocols?: string;

    /**
     * Body param: Text containing 2 characters
     */
    reported_country?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    reported_user_agent?: string;

    /**
     * Body param: Required for DMCA reports, should be same as Name. An affirmation
     * that all information in the report is true and accurate while agreeing to the
     * policies of Cloudflare's abuse reports
     */
    signature?: string;

    /**
     * Body param: A list of IP addresses separated by ‘ ’ (new line character). The
     * list of source IPs should not exceed 30 IP addresses. Each one of the IP
     * addresses ought to be unique
     */
    source_ips?: string;

    /**
     * Body param: Text not exceeding 255 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    state?: string;

    /**
     * Body param: Text not exceeding 20 characters. This field may be released by
     * Cloudflare to third parties such as the Lumen Database
     * (https://lumendatabase.org/).
     */
    tele?: string;

    /**
     * Body param: Text not exceeding 255 characters
     */
    title?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_number?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_office?: string;

    /**
     * Body param: Text not exceeding 1000 characters
     */
    trademark_symbol?: string;
  }
}

export declare namespace AbuseReports {
  export {
    type AbuseReportCreateResponse as AbuseReportCreateResponse,
    type AbuseReportCreateParams as AbuseReportCreateParams,
  };
}
