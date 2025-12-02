// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as ASNAPI from './asn';
import {
  ASN,
  ASNDayReportParams,
  ASNDayReportResponse,
  ASNFullReportParams,
  ASNFullReportResponse,
} from './asn';
import * as ConfigsAPI from './configs/configs';
import { Configs } from './configs/configs';

export class BotnetFeed extends APIResource {
  asn: ASNAPI.ASN = new ASNAPI.ASN(this._client);
  configs: ConfigsAPI.Configs = new ConfigsAPI.Configs(this._client);
}

BotnetFeed.ASN = ASN;
BotnetFeed.Configs = Configs;

export declare namespace BotnetFeed {
  export {
    ASN as ASN,
    type ASNDayReportResponse as ASNDayReportResponse,
    type ASNFullReportResponse as ASNFullReportResponse,
    type ASNDayReportParams as ASNDayReportParams,
    type ASNFullReportParams as ASNFullReportParams,
  };

  export { Configs as Configs };
}
