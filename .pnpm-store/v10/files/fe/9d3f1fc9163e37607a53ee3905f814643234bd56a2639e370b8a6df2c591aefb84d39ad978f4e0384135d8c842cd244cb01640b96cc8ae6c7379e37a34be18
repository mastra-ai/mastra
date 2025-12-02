// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as LOADocumentsAPI from './loa-documents';
import {
  LOADocumentCreateParams,
  LOADocumentCreateResponse,
  LOADocumentGetParams,
  LOADocuments,
} from './loa-documents';
import * as ServicesAPI from './services';
import { ServiceListParams, ServiceListResponse, ServiceListResponsesSinglePage, Services } from './services';
import * as AddressMapsAPI from './address-maps/address-maps';
import {
  AddressMap,
  AddressMapCreateParams,
  AddressMapCreateResponse,
  AddressMapDeleteParams,
  AddressMapDeleteResponse,
  AddressMapEditParams,
  AddressMapGetParams,
  AddressMapGetResponse,
  AddressMapListParams,
  AddressMaps,
  AddressMapsSinglePage,
  Kind,
} from './address-maps/address-maps';
import * as PrefixesAPI from './prefixes/prefixes';
import {
  Prefix,
  PrefixCreateParams,
  PrefixDeleteParams,
  PrefixDeleteResponse,
  PrefixEditParams,
  PrefixGetParams,
  PrefixListParams,
  Prefixes,
  PrefixesSinglePage,
} from './prefixes/prefixes';
import * as RegionalHostnamesAPI from './regional-hostnames/regional-hostnames';
import {
  RegionalHostnameCreateParams,
  RegionalHostnameCreateResponse,
  RegionalHostnameDeleteParams,
  RegionalHostnameDeleteResponse,
  RegionalHostnameEditParams,
  RegionalHostnameEditResponse,
  RegionalHostnameGetParams,
  RegionalHostnameGetResponse,
  RegionalHostnameListParams,
  RegionalHostnameListResponse,
  RegionalHostnameListResponsesSinglePage,
  RegionalHostnames,
} from './regional-hostnames/regional-hostnames';

export class Addressing extends APIResource {
  regionalHostnames: RegionalHostnamesAPI.RegionalHostnames = new RegionalHostnamesAPI.RegionalHostnames(
    this._client,
  );
  services: ServicesAPI.Services = new ServicesAPI.Services(this._client);
  addressMaps: AddressMapsAPI.AddressMaps = new AddressMapsAPI.AddressMaps(this._client);
  loaDocuments: LOADocumentsAPI.LOADocuments = new LOADocumentsAPI.LOADocuments(this._client);
  prefixes: PrefixesAPI.Prefixes = new PrefixesAPI.Prefixes(this._client);
}

Addressing.RegionalHostnames = RegionalHostnames;
Addressing.RegionalHostnameListResponsesSinglePage = RegionalHostnameListResponsesSinglePage;
Addressing.Services = Services;
Addressing.ServiceListResponsesSinglePage = ServiceListResponsesSinglePage;
Addressing.AddressMaps = AddressMaps;
Addressing.AddressMapsSinglePage = AddressMapsSinglePage;
Addressing.LOADocuments = LOADocuments;
Addressing.Prefixes = Prefixes;
Addressing.PrefixesSinglePage = PrefixesSinglePage;

export declare namespace Addressing {
  export {
    RegionalHostnames as RegionalHostnames,
    type RegionalHostnameCreateResponse as RegionalHostnameCreateResponse,
    type RegionalHostnameListResponse as RegionalHostnameListResponse,
    type RegionalHostnameDeleteResponse as RegionalHostnameDeleteResponse,
    type RegionalHostnameEditResponse as RegionalHostnameEditResponse,
    type RegionalHostnameGetResponse as RegionalHostnameGetResponse,
    RegionalHostnameListResponsesSinglePage as RegionalHostnameListResponsesSinglePage,
    type RegionalHostnameCreateParams as RegionalHostnameCreateParams,
    type RegionalHostnameListParams as RegionalHostnameListParams,
    type RegionalHostnameDeleteParams as RegionalHostnameDeleteParams,
    type RegionalHostnameEditParams as RegionalHostnameEditParams,
    type RegionalHostnameGetParams as RegionalHostnameGetParams,
  };

  export {
    Services as Services,
    type ServiceListResponse as ServiceListResponse,
    ServiceListResponsesSinglePage as ServiceListResponsesSinglePage,
    type ServiceListParams as ServiceListParams,
  };

  export {
    AddressMaps as AddressMaps,
    type AddressMap as AddressMap,
    type Kind as Kind,
    type AddressMapCreateResponse as AddressMapCreateResponse,
    type AddressMapDeleteResponse as AddressMapDeleteResponse,
    type AddressMapGetResponse as AddressMapGetResponse,
    AddressMapsSinglePage as AddressMapsSinglePage,
    type AddressMapCreateParams as AddressMapCreateParams,
    type AddressMapListParams as AddressMapListParams,
    type AddressMapDeleteParams as AddressMapDeleteParams,
    type AddressMapEditParams as AddressMapEditParams,
    type AddressMapGetParams as AddressMapGetParams,
  };

  export {
    LOADocuments as LOADocuments,
    type LOADocumentCreateResponse as LOADocumentCreateResponse,
    type LOADocumentCreateParams as LOADocumentCreateParams,
    type LOADocumentGetParams as LOADocumentGetParams,
  };

  export {
    Prefixes as Prefixes,
    type Prefix as Prefix,
    type PrefixDeleteResponse as PrefixDeleteResponse,
    PrefixesSinglePage as PrefixesSinglePage,
    type PrefixCreateParams as PrefixCreateParams,
    type PrefixListParams as PrefixListParams,
    type PrefixDeleteParams as PrefixDeleteParams,
    type PrefixEditParams as PrefixEditParams,
    type PrefixGetParams as PrefixGetParams,
  };
}
