// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as ConfigurationsAPI from './configurations';

export class CustomCertificate extends APIResource {
  /**
   * Fetches the current Zero Trust certificate configuration.
   *
   * @deprecated
   */
  get(
    params: CustomCertificateGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ConfigurationsAPI.CustomCertificateSettings | null> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/gateway/configuration/custom_certificate`, options);
  }
}

export interface CustomCertificateGetParams {
  account_id: string;
}

export declare namespace CustomCertificate {
  export { type CustomCertificateGetParams as CustomCertificateGetParams };
}
