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
exports.Entities = void 0;
const resource_1 = require("../../../resource.js");
const ASNsAPI = __importStar(require("./asns.js"));
const asns_1 = require("./asns.js");
const LocationsAPI = __importStar(require("./locations.js"));
const locations_1 = require("./locations.js");
class Entities extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.asns = new ASNsAPI.ASNs(this._client);
        this.locations = new LocationsAPI.Locations(this._client);
    }
    /**
     * Retrieves IP address information.
     *
     * @example
     * ```ts
     * const entity = await client.radar.entities.get({
     *   ip: '8.8.8.8',
     * });
     * ```
     */
    get(query, options) {
        return this._client.get('/radar/entities/ip', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Entities = Entities;
Entities.ASNs = asns_1.ASNs;
Entities.Locations = locations_1.Locations;
//# sourceMappingURL=entities.js.map