// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as GroupsAPI from '../../access/groups';
import { ZeroTrustGroupsSinglePage } from '../../access/groups';

export class Groups extends APIResource {
  /**
   * Lists SCIM Group resources synced to Cloudflare via the System for Cross-domain
   * Identity Management (SCIM).
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const zeroTrustGroup of client.zeroTrust.identityProviders.scim.groups.list(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    identityProviderId: string,
    params: GroupListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ZeroTrustGroupsSinglePage, GroupsAPI.ZeroTrustGroup> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/access/identity_providers/${identityProviderId}/scim/groups`,
      ZeroTrustGroupsSinglePage,
      { query, ...options },
    );
  }
}

export interface GroupListParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param: The unique Cloudflare-generated Id of the SCIM Group resource; also
   * known as the "Id".
   */
  cf_resource_id?: string;

  /**
   * Query param: The IdP-generated Id of the SCIM Group resource; also known as the
   * "external Id".
   */
  idp_resource_id?: string;

  /**
   * Query param: The display name of the SCIM Group resource.
   */
  name?: string;
}

export declare namespace Groups {
  export { type GroupListParams as GroupListParams };
}

export { ZeroTrustGroupsSinglePage };
