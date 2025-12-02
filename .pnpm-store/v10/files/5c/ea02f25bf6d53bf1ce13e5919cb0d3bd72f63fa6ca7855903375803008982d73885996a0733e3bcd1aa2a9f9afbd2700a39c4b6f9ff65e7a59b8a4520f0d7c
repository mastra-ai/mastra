// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as UpdatesAPI from './updates';
import { UpdateListParams, UpdateListResponse, UpdateListResponsesSinglePage, Updates } from './updates';

export class SCIM extends APIResource {
  updates: UpdatesAPI.Updates = new UpdatesAPI.Updates(this._client);
}

export interface AccessRequest {
  /**
   * The event that occurred, such as a login attempt.
   */
  action?: string;

  /**
   * The result of the authentication event.
   */
  allowed?: boolean;

  /**
   * The URL of the Access application.
   */
  app_domain?: string;

  /**
   * The unique identifier for the Access application.
   */
  app_uid?: string;

  /**
   * The IdP used to authenticate.
   */
  connection?: string;

  created_at?: string;

  /**
   * The IP address of the authenticating user.
   */
  ip_address?: string;

  /**
   * The unique identifier for the request to Cloudflare.
   */
  ray_id?: string;

  /**
   * The email address of the authenticating user.
   */
  user_email?: string;
}

SCIM.Updates = Updates;
SCIM.UpdateListResponsesSinglePage = UpdateListResponsesSinglePage;

export declare namespace SCIM {
  export { type AccessRequest as AccessRequest };

  export {
    Updates as Updates,
    type UpdateListResponse as UpdateListResponse,
    UpdateListResponsesSinglePage as UpdateListResponsesSinglePage,
    type UpdateListParams as UpdateListParams,
  };
}
