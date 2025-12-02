// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Detections extends APIResource {
  /**
   * Returns detection details such as threat categories and sender information for
   * non-benign messages.
   *
   * @example
   * ```ts
   * const detection =
   *   await client.emailSecurity.investigate.detections.get(
   *     '4Njp3P0STMz2c02Q',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    postfixId: string,
    params: DetectionGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DetectionGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/email-security/investigate/${postfixId}/detections`,
        options,
      ) as Core.APIPromise<{ result: DetectionGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface DetectionGetResponse {
  action: string;

  attachments: Array<DetectionGetResponse.Attachment>;

  headers: Array<DetectionGetResponse.Header>;

  links: Array<DetectionGetResponse.Link>;

  sender_info: DetectionGetResponse.SenderInfo;

  threat_categories: Array<DetectionGetResponse.ThreatCategory>;

  validation: DetectionGetResponse.Validation;

  final_disposition?:
    | 'MALICIOUS'
    | 'MALICIOUS-BEC'
    | 'SUSPICIOUS'
    | 'SPOOF'
    | 'SPAM'
    | 'BULK'
    | 'ENCRYPTED'
    | 'EXTERNAL'
    | 'UNKNOWN'
    | 'NONE'
    | null;
}

export namespace DetectionGetResponse {
  export interface Attachment {
    size: number;

    content_type?: string | null;

    detection?:
      | 'MALICIOUS'
      | 'MALICIOUS-BEC'
      | 'SUSPICIOUS'
      | 'SPOOF'
      | 'SPAM'
      | 'BULK'
      | 'ENCRYPTED'
      | 'EXTERNAL'
      | 'UNKNOWN'
      | 'NONE'
      | null;

    encrypted?: boolean | null;

    name?: string | null;
  }

  export interface Header {
    name: string;

    value: string;
  }

  export interface Link {
    href: string;

    text?: string | null;
  }

  export interface SenderInfo {
    /**
     * The name of the autonomous system.
     */
    as_name?: string | null;

    /**
     * The number of the autonomous system.
     */
    as_number?: number | null;

    geo?: string | null;

    ip?: string | null;

    pld?: string | null;
  }

  export interface ThreatCategory {
    id: number;

    description?: string | null;

    name?: string | null;
  }

  export interface Validation {
    comment?: string | null;

    dkim?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;

    dmarc?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;

    spf?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
  }
}

export interface DetectionGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export declare namespace Detections {
  export { type DetectionGetResponse as DetectionGetResponse, type DetectionGetParams as DetectionGetParams };
}
