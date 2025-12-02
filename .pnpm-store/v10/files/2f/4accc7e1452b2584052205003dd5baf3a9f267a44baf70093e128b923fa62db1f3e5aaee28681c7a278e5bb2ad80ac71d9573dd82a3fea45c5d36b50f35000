// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Trace extends APIResource {
  /**
   * Get email trace
   *
   * @example
   * ```ts
   * const trace =
   *   await client.emailSecurity.investigate.trace.get(
   *     '4Njp3P0STMz2c02Q',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    postfixId: string,
    params: TraceGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TraceGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/email-security/investigate/${postfixId}/trace`,
        options,
      ) as Core.APIPromise<{ result: TraceGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface TraceGetResponse {
  inbound: TraceGetResponse.Inbound;

  outbound: TraceGetResponse.Outbound;
}

export namespace TraceGetResponse {
  export interface Inbound {
    lines?: Array<Inbound.Line> | null;
  }

  export namespace Inbound {
    export interface Line {
      lineno: number;

      message: string;

      ts: string;
    }
  }

  export interface Outbound {
    lines?: Array<Outbound.Line> | null;
  }

  export namespace Outbound {
    export interface Line {
      lineno: number;

      message: string;

      ts: string;
    }
  }
}

export interface TraceGetParams {
  /**
   * Account Identifier
   */
  account_id: string;
}

export declare namespace Trace {
  export { type TraceGetResponse as TraceGetResponse, type TraceGetParams as TraceGetParams };
}
