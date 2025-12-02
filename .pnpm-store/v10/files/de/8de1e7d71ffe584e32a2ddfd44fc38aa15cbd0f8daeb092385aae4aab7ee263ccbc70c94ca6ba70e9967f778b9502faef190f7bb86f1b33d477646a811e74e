// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Profiles extends APIResource {
  /**
   * Gets the current billing profile for the account.
   *
   * @deprecated
   */
  get(params: ProfileGetParams, options?: Core.RequestOptions): Core.APIPromise<ProfileGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/billing/profile`, options) as Core.APIPromise<{
        result: ProfileGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ProfileGetResponse {
  /**
   * Billing item identifier tag.
   */
  id?: string;

  account_type?: string;

  address?: string;

  address2?: string;

  balance?: string;

  card_expiry_month?: number;

  card_expiry_year?: number;

  card_number?: string;

  city?: string;

  company?: string;

  country?: string;

  created_on?: string;

  device_data?: string;

  edited_on?: string;

  enterprise_billing_email?: string;

  enterprise_primary_email?: string;

  first_name?: string;

  is_partner?: boolean;

  last_name?: string;

  next_bill_date?: string;

  payment_address?: string;

  payment_address2?: string;

  payment_city?: string;

  payment_country?: string;

  payment_email?: string;

  payment_first_name?: string;

  payment_gateway?: string;

  payment_last_name?: string;

  payment_nonce?: string;

  payment_state?: string;

  payment_zipcode?: string;

  primary_email?: string;

  state?: string;

  tax_id_type?: string;

  telephone?: string;

  use_legacy?: boolean;

  validation_code?: string;

  vat?: string;

  zipcode?: string;
}

export interface ProfileGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

export declare namespace Profiles {
  export { type ProfileGetResponse as ProfileGetResponse, type ProfileGetParams as ProfileGetParams };
}
