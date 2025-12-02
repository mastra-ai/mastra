// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as LOADocumentsAPI from "./loa-documents.mjs";
import { LOADocuments, } from "./loa-documents.mjs";
import * as ServicesAPI from "./services.mjs";
import { ServiceListResponsesSinglePage, Services } from "./services.mjs";
import * as AddressMapsAPI from "./address-maps/address-maps.mjs";
import { AddressMaps, AddressMapsSinglePage, } from "./address-maps/address-maps.mjs";
import * as PrefixesAPI from "./prefixes/prefixes.mjs";
import { Prefixes, PrefixesSinglePage, } from "./prefixes/prefixes.mjs";
import * as RegionalHostnamesAPI from "./regional-hostnames/regional-hostnames.mjs";
import { RegionalHostnameListResponsesSinglePage, RegionalHostnames, } from "./regional-hostnames/regional-hostnames.mjs";
export class Addressing extends APIResource {
    constructor() {
        super(...arguments);
        this.regionalHostnames = new RegionalHostnamesAPI.RegionalHostnames(this._client);
        this.services = new ServicesAPI.Services(this._client);
        this.addressMaps = new AddressMapsAPI.AddressMaps(this._client);
        this.loaDocuments = new LOADocumentsAPI.LOADocuments(this._client);
        this.prefixes = new PrefixesAPI.Prefixes(this._client);
    }
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
//# sourceMappingURL=addressing.mjs.map