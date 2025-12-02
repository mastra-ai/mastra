// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as AccessRequestsAPI from './access-requests';
import { AccessRequestListParams, AccessRequestListResponse, AccessRequests } from './access-requests';
import * as SCIMAPI from './scim/scim';
import { AccessRequest, SCIM } from './scim/scim';

export class Logs extends APIResource {
  accessRequests: AccessRequestsAPI.AccessRequests = new AccessRequestsAPI.AccessRequests(this._client);
  scim: SCIMAPI.SCIM = new SCIMAPI.SCIM(this._client);
}

Logs.AccessRequests = AccessRequests;
Logs.SCIM = SCIM;

export declare namespace Logs {
  export {
    AccessRequests as AccessRequests,
    type AccessRequestListResponse as AccessRequestListResponse,
    type AccessRequestListParams as AccessRequestListParams,
  };

  export { SCIM as SCIM, type AccessRequest as AccessRequest };
}
