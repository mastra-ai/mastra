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
exports.OutgoingResource = void 0;
const resource_1 = require("../../../../resource.js");
const StatusAPI = __importStar(require("./status.js"));
const status_1 = require("./status.js");
class OutgoingResource extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.status = new StatusAPI.Status(this._client);
    }
    /**
     * Create primary zone configuration for outgoing zone transfers.
     *
     * @example
     * ```ts
     * const outgoing =
     *   await client.dns.zoneTransfers.outgoing.create({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     name: 'www.example.com.',
     *     peers: [
     *       '23ff594956f20c2a721606e94745a8aa',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/outgoing`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update primary zone configuration for outgoing zone transfers.
     *
     * @example
     * ```ts
     * const outgoing =
     *   await client.dns.zoneTransfers.outgoing.update({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     name: 'www.example.com.',
     *     peers: [
     *       '23ff594956f20c2a721606e94745a8aa',
     *       '00920f38ce07c2e2f4df50b1f61d4194',
     *     ],
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/secondary_dns/outgoing`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete primary zone configuration for outgoing zone transfers.
     *
     * @example
     * ```ts
     * const outgoing =
     *   await client.dns.zoneTransfers.outgoing.delete({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/secondary_dns/outgoing`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disable outgoing zone transfers for primary zone and clears IXFR backlog of
     * primary zone.
     *
     * @example
     * ```ts
     * const disableTransfer =
     *   await client.dns.zoneTransfers.outgoing.disable({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     body: {},
     *   });
     * ```
     */
    disable(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/outgoing/disable`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Enable outgoing zone transfers for primary zone.
     *
     * @example
     * ```ts
     * const enableTransfer =
     *   await client.dns.zoneTransfers.outgoing.enable({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     body: {},
     *   });
     * ```
     */
    enable(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/outgoing/enable`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Notifies the secondary nameserver(s) and clears IXFR backlog of primary zone.
     *
     * @example
     * ```ts
     * const response =
     *   await client.dns.zoneTransfers.outgoing.forceNotify({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *     body: {},
     *   });
     * ```
     */
    forceNotify(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/secondary_dns/outgoing/force_notify`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get primary zone configuration for outgoing zone transfers.
     *
     * @example
     * ```ts
     * const outgoing =
     *   await client.dns.zoneTransfers.outgoing.get({
     *     zone_id: '269d8f4853475ca241c4e730be286b20',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/secondary_dns/outgoing`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.OutgoingResource = OutgoingResource;
OutgoingResource.Status = status_1.Status;
//# sourceMappingURL=outgoing.js.map