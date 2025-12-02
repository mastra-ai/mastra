// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as AdvertisementStatusAPI from './advertisement-status';
import {
  AdvertisementStatus,
  AdvertisementStatusEditParams,
  AdvertisementStatusEditResponse,
  AdvertisementStatusGetParams,
  AdvertisementStatusGetResponse,
} from './advertisement-status';
import * as BGPPrefixesAPI from './bgp-prefixes';
import {
  BGPPrefix,
  BGPPrefixCreateParams,
  BGPPrefixEditParams,
  BGPPrefixGetParams,
  BGPPrefixListParams,
  BGPPrefixes,
  BGPPrefixesSinglePage,
} from './bgp-prefixes';
import * as DelegationsAPI from './delegations';
import {
  DelegationCreateParams,
  DelegationDeleteParams,
  DelegationDeleteResponse,
  DelegationListParams,
  Delegations,
  DelegationsSinglePage,
} from './delegations';
import * as ServiceBindingsAPI from './service-bindings';
import {
  ServiceBinding,
  ServiceBindingCreateParams,
  ServiceBindingDeleteParams,
  ServiceBindingDeleteResponse,
  ServiceBindingGetParams,
  ServiceBindingListParams,
  ServiceBindings,
  ServiceBindingsSinglePage,
} from './service-bindings';
import { SinglePage } from '../../../pagination';

export class Prefixes extends APIResource {
  serviceBindings: ServiceBindingsAPI.ServiceBindings = new ServiceBindingsAPI.ServiceBindings(this._client);
  bgpPrefixes: BGPPrefixesAPI.BGPPrefixes = new BGPPrefixesAPI.BGPPrefixes(this._client);
  advertisementStatus: AdvertisementStatusAPI.AdvertisementStatus =
    new AdvertisementStatusAPI.AdvertisementStatus(this._client);
  delegations: DelegationsAPI.Delegations = new DelegationsAPI.Delegations(this._client);

  /**
   * Add a new prefix under the account.
   *
   * @example
   * ```ts
   * const prefix = await client.addressing.prefixes.create({
   *   account_id: '258def64c72dae45f3e4c8516e2111f2',
   *   asn: 209242,
   *   cidr: '192.0.2.0/24',
   *   loa_document_id: 'd933b1530bc56c9953cf8ce166da8004',
   * });
   * ```
   */
  create(params: PrefixCreateParams, options?: Core.RequestOptions): Core.APIPromise<Prefix> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/addressing/prefixes`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Prefix }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List all prefixes owned by the account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const prefix of client.addressing.prefixes.list({
   *   account_id: '258def64c72dae45f3e4c8516e2111f2',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PrefixListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PrefixesSinglePage, Prefix> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/addressing/prefixes`,
      PrefixesSinglePage,
      options,
    );
  }

  /**
   * Delete an unapproved prefix owned by the account.
   *
   * @example
   * ```ts
   * const prefix = await client.addressing.prefixes.delete(
   *   '2af39739cc4e3b5910c918468bb89828',
   *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
   * );
   * ```
   */
  delete(
    prefixId: string,
    params: PrefixDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PrefixDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/addressing/prefixes/${prefixId}`, options);
  }

  /**
   * Modify the description for a prefix owned by the account.
   *
   * @example
   * ```ts
   * const prefix = await client.addressing.prefixes.edit(
   *   '2af39739cc4e3b5910c918468bb89828',
   *   {
   *     account_id: '258def64c72dae45f3e4c8516e2111f2',
   *     description: 'Internal test prefix',
   *   },
   * );
   * ```
   */
  edit(prefixId: string, params: PrefixEditParams, options?: Core.RequestOptions): Core.APIPromise<Prefix> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/addressing/prefixes/${prefixId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Prefix }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List a particular prefix owned by the account.
   *
   * @example
   * ```ts
   * const prefix = await client.addressing.prefixes.get(
   *   '2af39739cc4e3b5910c918468bb89828',
   *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
   * );
   * ```
   */
  get(prefixId: string, params: PrefixGetParams, options?: Core.RequestOptions): Core.APIPromise<Prefix> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/addressing/prefixes/${prefixId}`,
        options,
      ) as Core.APIPromise<{ result: Prefix }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PrefixesSinglePage extends SinglePage<Prefix> {}

export interface Prefix {
  /**
   * Identifier of an IP Prefix.
   */
  id?: string;

  /**
   * Identifier of a Cloudflare account.
   */
  account_id?: string;

  /**
   * Prefix advertisement status to the Internet. This field is only not 'null' if on
   * demand is enabled.
   */
  advertised?: boolean | null;

  /**
   * Last time the advertisement status was changed. This field is only not 'null' if
   * on demand is enabled.
   */
  advertised_modified_at?: string | null;

  /**
   * Approval state of the prefix (P = pending, V = active).
   */
  approved?: string;

  /**
   * Autonomous System Number (ASN) the prefix will be advertised under.
   */
  asn?: number | null;

  /**
   * IP Prefix in Classless Inter-Domain Routing format.
   */
  cidr?: string;

  created_at?: string;

  /**
   * Description of the prefix.
   */
  description?: string;

  /**
   * Identifier for the uploaded LOA document.
   */
  loa_document_id?: string | null;

  modified_at?: string;

  /**
   * Whether advertisement of the prefix to the Internet may be dynamically enabled
   * or disabled.
   */
  on_demand_enabled?: boolean;

  /**
   * Whether advertisement status of the prefix is locked, meaning it cannot be
   * changed.
   */
  on_demand_locked?: boolean;
}

export interface PrefixDeleteResponse {
  errors: Array<PrefixDeleteResponse.Error>;

  messages: Array<PrefixDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;

  result_info?: PrefixDeleteResponse.ResultInfo;
}

export namespace PrefixDeleteResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }

  export interface ResultInfo {
    /**
     * Total number of results for the requested service.
     */
    count?: number;

    /**
     * Current page within paginated list of results.
     */
    page?: number;

    /**
     * Number of results per page of results.
     */
    per_page?: number;

    /**
     * Total results available without any search parameters.
     */
    total_count?: number;
  }
}

export interface PrefixCreateParams {
  /**
   * Path param: Identifier of a Cloudflare account.
   */
  account_id: string;

  /**
   * Body param: Autonomous System Number (ASN) the prefix will be advertised under.
   */
  asn: number | null;

  /**
   * Body param: IP Prefix in Classless Inter-Domain Routing format.
   */
  cidr: string;

  /**
   * Body param: Identifier for the uploaded LOA document.
   */
  loa_document_id: string | null;
}

export interface PrefixListParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

export interface PrefixDeleteParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

export interface PrefixEditParams {
  /**
   * Path param: Identifier of a Cloudflare account.
   */
  account_id: string;

  /**
   * Body param: Description of the prefix.
   */
  description: string;
}

export interface PrefixGetParams {
  /**
   * Identifier of a Cloudflare account.
   */
  account_id: string;
}

Prefixes.PrefixesSinglePage = PrefixesSinglePage;
Prefixes.ServiceBindings = ServiceBindings;
Prefixes.ServiceBindingsSinglePage = ServiceBindingsSinglePage;
Prefixes.BGPPrefixes = BGPPrefixes;
Prefixes.BGPPrefixesSinglePage = BGPPrefixesSinglePage;
Prefixes.AdvertisementStatus = AdvertisementStatus;
Prefixes.DelegationsSinglePage = DelegationsSinglePage;

export declare namespace Prefixes {
  export {
    type Prefix as Prefix,
    type PrefixDeleteResponse as PrefixDeleteResponse,
    PrefixesSinglePage as PrefixesSinglePage,
    type PrefixCreateParams as PrefixCreateParams,
    type PrefixListParams as PrefixListParams,
    type PrefixDeleteParams as PrefixDeleteParams,
    type PrefixEditParams as PrefixEditParams,
    type PrefixGetParams as PrefixGetParams,
  };

  export {
    ServiceBindings as ServiceBindings,
    type ServiceBinding as ServiceBinding,
    type ServiceBindingDeleteResponse as ServiceBindingDeleteResponse,
    ServiceBindingsSinglePage as ServiceBindingsSinglePage,
    type ServiceBindingCreateParams as ServiceBindingCreateParams,
    type ServiceBindingListParams as ServiceBindingListParams,
    type ServiceBindingDeleteParams as ServiceBindingDeleteParams,
    type ServiceBindingGetParams as ServiceBindingGetParams,
  };

  export {
    BGPPrefixes as BGPPrefixes,
    type BGPPrefix as BGPPrefix,
    BGPPrefixesSinglePage as BGPPrefixesSinglePage,
    type BGPPrefixCreateParams as BGPPrefixCreateParams,
    type BGPPrefixListParams as BGPPrefixListParams,
    type BGPPrefixEditParams as BGPPrefixEditParams,
    type BGPPrefixGetParams as BGPPrefixGetParams,
  };

  export {
    AdvertisementStatus as AdvertisementStatus,
    type AdvertisementStatusEditResponse as AdvertisementStatusEditResponse,
    type AdvertisementStatusGetResponse as AdvertisementStatusGetResponse,
    type AdvertisementStatusEditParams as AdvertisementStatusEditParams,
    type AdvertisementStatusGetParams as AdvertisementStatusGetParams,
  };

  export {
    type Delegations as Delegations,
    type DelegationDeleteResponse as DelegationDeleteResponse,
    DelegationsSinglePage as DelegationsSinglePage,
    type DelegationCreateParams as DelegationCreateParams,
    type DelegationListParams as DelegationListParams,
    type DelegationDeleteParams as DelegationDeleteParams,
  };
}
