// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import { isRequestOptions } from '../../../../core';
import * as Core from '../../../../core';
import * as BotClassAPI from './bot-class';
import { BotClass, BotClassGetParams, BotClassGetResponse } from './bot-class';
import * as BrowserFamilyAPI from './browser-family';
import { BrowserFamily, BrowserFamilyGetParams, BrowserFamilyGetResponse } from './browser-family';
import * as DeviceTypeAPI from './device-type';
import { DeviceType, DeviceTypeGetParams, DeviceTypeGetResponse } from './device-type';
import * as HTTPMethodAPI from './http-method';
import { HTTPMethod, HTTPMethodGetParams, HTTPMethodGetResponse } from './http-method';
import * as HTTPProtocolAPI from './http-protocol';
import { HTTPProtocol, HTTPProtocolGetParams, HTTPProtocolGetResponse } from './http-protocol';
import * as IPVersionAPI from './ip-version';
import { IPVersion, IPVersionGetParams, IPVersionGetResponse } from './ip-version';
import * as OSAPI from './os';
import { OS, OSGetParams, OSGetResponse } from './os';
import * as TLSVersionAPI from './tls-version';
import { TLSVersion, TLSVersionGetParams, TLSVersionGetResponse } from './tls-version';

export class Ases extends APIResource {
  botClass: BotClassAPI.BotClass = new BotClassAPI.BotClass(this._client);
  deviceType: DeviceTypeAPI.DeviceType = new DeviceTypeAPI.DeviceType(this._client);
  httpProtocol: HTTPProtocolAPI.HTTPProtocol = new HTTPProtocolAPI.HTTPProtocol(this._client);
  httpMethod: HTTPMethodAPI.HTTPMethod = new HTTPMethodAPI.HTTPMethod(this._client);
  ipVersion: IPVersionAPI.IPVersion = new IPVersionAPI.IPVersion(this._client);
  os: OSAPI.OS = new OSAPI.OS(this._client);
  tlsVersion: TLSVersionAPI.TLSVersion = new TLSVersionAPI.TLSVersion(this._client);
  browserFamily: BrowserFamilyAPI.BrowserFamily = new BrowserFamilyAPI.BrowserFamily(this._client);

  /**
   * Retrieves the top autonomous systems by HTTP requests.
   *
   * @example
   * ```ts
   * const ase = await client.radar.http.ases.get();
   * ```
   */
  get(query?: AseGetParams, options?: Core.RequestOptions): Core.APIPromise<AseGetResponse>;
  get(options?: Core.RequestOptions): Core.APIPromise<AseGetResponse>;
  get(
    query: AseGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<AseGetResponse> {
    if (isRequestOptions(query)) {
      return this.get({}, query);
    }
    return (
      this._client.get('/radar/http/top/ases', { query, ...options }) as Core.APIPromise<{
        result: AseGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface AseGetResponse {
  /**
   * Metadata for the results.
   */
  meta: AseGetResponse.Meta;

  top_0: Array<AseGetResponse.Top0>;
}

export namespace AseGetResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

    dateRange: Array<Meta.DateRange>;

    /**
     * Timestamp of the last dataset update.
     */
    lastUpdated: string;

    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization:
      | 'PERCENTAGE'
      | 'MIN0_MAX'
      | 'MIN_MAX'
      | 'RAW_VALUES'
      | 'PERCENTAGE_CHANGE'
      | 'ROLLING_AVERAGE'
      | 'OVERLAPPED_PERCENTAGE'
      | 'RATIO';

    /**
     * Measurement units for the results.
     */
    units: Array<Meta.Unit>;
  }

  export namespace Meta {
    export interface ConfidenceInfo {
      annotations: Array<ConfidenceInfo.Annotation>;

      /**
       * Provides an indication of how much confidence Cloudflare has in the data.
       */
      level: number;
    }

    export namespace ConfidenceInfo {
      /**
       * Annotation associated with the result (e.g. outage or other type of event).
       */
      export interface Annotation {
        dataSource: string;

        description: string;

        endDate: string;

        eventType: string;

        /**
         * Whether event is a single point in time or a time range.
         */
        isInstantaneous: boolean;

        linkedUrl: string;

        startDate: string;
      }
    }

    export interface DateRange {
      /**
       * Adjusted end of date range.
       */
      endTime: string;

      /**
       * Adjusted start of date range.
       */
      startTime: string;
    }

    export interface Unit {
      name: string;

      value: string;
    }
  }

  export interface Top0 {
    clientASN: number;

    clientASName: string;

    /**
     * A numeric string.
     */
    value: string;
  }
}

export interface AseGetParams {
  /**
   * Filters results by Autonomous System. Specify one or more Autonomous System
   * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
   * results. For example, `-174, 3356` excludes results from AS174, but includes
   * results from AS3356.
   */
  asn?: Array<string>;

  /**
   * Filters results by bot class. Refer to
   * [Bot classes](https://developers.cloudflare.com/radar/concepts/bot-classes/).
   */
  botClass?: Array<'LIKELY_AUTOMATED' | 'LIKELY_HUMAN'>;

  /**
   * Filters results by browser family.
   */
  browserFamily?: Array<'CHROME' | 'EDGE' | 'FIREFOX' | 'SAFARI'>;

  /**
   * Filters results by continent. Specify a comma-separated list of alpha-2 codes.
   * Prefix with `-` to exclude continents from results. For example, `-EU,NA`
   * excludes results from EU, but includes results from NA.
   */
  continent?: Array<string>;

  /**
   * End of the date range (inclusive).
   */
  dateEnd?: Array<string>;

  /**
   * Filters results by date range. For example, use `7d` and `7dcontrol` to compare
   * this week with the previous week. Use this parameter or set specific start and
   * end dates (`dateStart` and `dateEnd` parameters).
   */
  dateRange?: Array<string>;

  /**
   * Start of the date range.
   */
  dateStart?: Array<string>;

  /**
   * Filters results by device type.
   */
  deviceType?: Array<'DESKTOP' | 'MOBILE' | 'OTHER'>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Filters results by HTTP protocol (HTTP vs. HTTPS).
   */
  httpProtocol?: Array<'HTTP' | 'HTTPS'>;

  /**
   * Filters results by HTTP version.
   */
  httpVersion?: Array<'HTTPv1' | 'HTTPv2' | 'HTTPv3'>;

  /**
   * Filters results by IP version (Ipv4 vs. IPv6).
   */
  ipVersion?: Array<'IPv4' | 'IPv6'>;

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Filters results by location. Specify a comma-separated list of alpha-2 codes.
   * Prefix with `-` to exclude locations from results. For example, `-US,PT`
   * excludes results from the US, but includes results from PT.
   */
  location?: Array<string>;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * Filters results by operating system.
   */
  os?: Array<'WINDOWS' | 'MACOSX' | 'IOS' | 'ANDROID' | 'CHROMEOS' | 'LINUX' | 'SMART_TV'>;

  /**
   * Filters results by TLS version.
   */
  tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3' | 'TLSvQUIC'>;
}

Ases.BotClass = BotClass;
Ases.DeviceType = DeviceType;
Ases.HTTPProtocol = HTTPProtocol;
Ases.HTTPMethod = HTTPMethod;
Ases.IPVersion = IPVersion;
Ases.OS = OS;
Ases.TLSVersion = TLSVersion;
Ases.BrowserFamily = BrowserFamily;

export declare namespace Ases {
  export { type AseGetResponse as AseGetResponse, type AseGetParams as AseGetParams };

  export {
    BotClass as BotClass,
    type BotClassGetResponse as BotClassGetResponse,
    type BotClassGetParams as BotClassGetParams,
  };

  export {
    DeviceType as DeviceType,
    type DeviceTypeGetResponse as DeviceTypeGetResponse,
    type DeviceTypeGetParams as DeviceTypeGetParams,
  };

  export {
    HTTPProtocol as HTTPProtocol,
    type HTTPProtocolGetResponse as HTTPProtocolGetResponse,
    type HTTPProtocolGetParams as HTTPProtocolGetParams,
  };

  export {
    HTTPMethod as HTTPMethod,
    type HTTPMethodGetResponse as HTTPMethodGetResponse,
    type HTTPMethodGetParams as HTTPMethodGetParams,
  };

  export {
    IPVersion as IPVersion,
    type IPVersionGetResponse as IPVersionGetResponse,
    type IPVersionGetParams as IPVersionGetParams,
  };

  export { OS as OS, type OSGetResponse as OSGetResponse, type OSGetParams as OSGetParams };

  export {
    TLSVersion as TLSVersion,
    type TLSVersionGetResponse as TLSVersionGetResponse,
    type TLSVersionGetParams as TLSVersionGetParams,
  };

  export {
    BrowserFamily as BrowserFamily,
    type BrowserFamilyGetResponse as BrowserFamilyGetResponse,
    type BrowserFamilyGetParams as BrowserFamilyGetParams,
  };
}
