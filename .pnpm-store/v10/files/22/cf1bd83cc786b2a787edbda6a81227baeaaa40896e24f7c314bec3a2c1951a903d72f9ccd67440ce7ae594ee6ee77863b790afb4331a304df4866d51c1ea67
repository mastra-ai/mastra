"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Addressing = void 0;
const resource_1 = require("../../resource.js");
const LOADocumentsAPI = __importStar(require("./loa-documents.js"));
const loa_documents_1 = require("./loa-documents.js");
const ServicesAPI = __importStar(require("./services.js"));
const services_1 = require("./services.js");
const AddressMapsAPI = __importStar(require("./address-maps/address-maps.js"));
const address_maps_1 = require("./address-maps/address-maps.js");
const PrefixesAPI = __importStar(require("./prefixes/prefixes.js"));
const prefixes_1 = require("./prefixes/prefixes.js");
const RegionalHostnamesAPI = __importStar(require("./regional-hostnames/regional-hostnames.js"));
const regional_hostnames_1 = require("./regional-hostnames/regional-hostnames.js");
class Addressing extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.regionalHostnames = new RegionalHostnamesAPI.RegionalHostnames(this._client);
        this.services = new ServicesAPI.Services(this._client);
        this.addressMaps = new AddressMapsAPI.AddressMaps(this._client);
        this.loaDocuments = new LOADocumentsAPI.LOADocuments(this._client);
        this.prefixes = new PrefixesAPI.Prefixes(this._client);
    }
}
exports.Addressing = Addressing;
Addressing.RegionalHostnames = regional_hostnames_1.RegionalHostnames;
Addressing.RegionalHostnameListResponsesSinglePage = regional_hostnames_1.RegionalHostnameListResponsesSinglePage;
Addressing.Services = services_1.Services;
Addressing.ServiceListResponsesSinglePage = services_1.ServiceListResponsesSinglePage;
Addressing.AddressMaps = address_maps_1.AddressMaps;
Addressing.AddressMapsSinglePage = address_maps_1.AddressMapsSinglePage;
Addressing.LOADocuments = loa_documents_1.LOADocuments;
Addressing.Prefixes = prefixes_1.Prefixes;
Addressing.PrefixesSinglePage = prefixes_1.PrefixesSinglePage;
//# sourceMappingURL=addressing.js.map