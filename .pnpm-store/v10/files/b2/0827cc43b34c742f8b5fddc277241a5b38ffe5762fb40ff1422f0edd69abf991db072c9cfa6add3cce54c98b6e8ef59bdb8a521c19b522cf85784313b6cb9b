// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as PayloadsAPI from './payloads';
import {
  PayloadCreateParams,
  PayloadCreateResponse,
  PayloadCreateResponsesSinglePage,
  PayloadDeleteParams,
  PayloadDeleteResponse,
  PayloadDeleteResponsesSinglePage,
  PayloadListParams,
  PayloadListResponse,
  PayloadListResponsesSinglePage,
  Payloads,
} from './payloads';
import * as SettingsAPI from './settings';
import { SettingGetParams, SettingGetResponse, Settings } from './settings';

export class ContentScanning extends APIResource {
  payloads: PayloadsAPI.Payloads = new PayloadsAPI.Payloads(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);

  /**
   * Disable Content Scanning.
   */
  disable(
    params: ContentScanningDisableParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ContentScanningDisableResponse> {
    const { zone_id } = params;
    return (
      this._client.post(`/zones/${zone_id}/content-upload-scan/disable`, options) as Core.APIPromise<{
        result: ContentScanningDisableResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Enable Content Scanning.
   */
  enable(
    params: ContentScanningEnableParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ContentScanningEnableResponse> {
    const { zone_id } = params;
    return (
      this._client.post(`/zones/${zone_id}/content-upload-scan/enable`, options) as Core.APIPromise<{
        result: ContentScanningEnableResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type ContentScanningDisableResponse = unknown;

export type ContentScanningEnableResponse = unknown;

export interface ContentScanningDisableParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

export interface ContentScanningEnableParams {
  /**
   * Defines an identifier.
   */
  zone_id: string;
}

ContentScanning.Payloads = Payloads;
ContentScanning.PayloadCreateResponsesSinglePage = PayloadCreateResponsesSinglePage;
ContentScanning.PayloadListResponsesSinglePage = PayloadListResponsesSinglePage;
ContentScanning.PayloadDeleteResponsesSinglePage = PayloadDeleteResponsesSinglePage;
ContentScanning.Settings = Settings;

export declare namespace ContentScanning {
  export {
    type ContentScanningDisableResponse as ContentScanningDisableResponse,
    type ContentScanningEnableResponse as ContentScanningEnableResponse,
    type ContentScanningDisableParams as ContentScanningDisableParams,
    type ContentScanningEnableParams as ContentScanningEnableParams,
  };

  export {
    Payloads as Payloads,
    type PayloadCreateResponse as PayloadCreateResponse,
    type PayloadListResponse as PayloadListResponse,
    type PayloadDeleteResponse as PayloadDeleteResponse,
    PayloadCreateResponsesSinglePage as PayloadCreateResponsesSinglePage,
    PayloadListResponsesSinglePage as PayloadListResponsesSinglePage,
    PayloadDeleteResponsesSinglePage as PayloadDeleteResponsesSinglePage,
    type PayloadCreateParams as PayloadCreateParams,
    type PayloadListParams as PayloadListParams,
    type PayloadDeleteParams as PayloadDeleteParams,
  };

  export {
    Settings as Settings,
    type SettingGetResponse as SettingGetResponse,
    type SettingGetParams as SettingGetParams,
  };
}
