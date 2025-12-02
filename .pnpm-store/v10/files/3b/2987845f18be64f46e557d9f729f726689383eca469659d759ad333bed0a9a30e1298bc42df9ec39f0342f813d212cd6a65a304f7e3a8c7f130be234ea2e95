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
exports.Snapshots = void 0;
const resource_1 = require("../../../../resource.js");
const LatestAPI = __importStar(require("./latest.js"));
const latest_1 = require("./latest.js");
class Snapshots extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.latest = new LatestAPI.Latest(this._client);
    }
    /**
     * List Snapshots
     *
     * @example
     * ```ts
     * const snapshots =
     *   await client.magicTransit.connectors.snapshots.list(
     *     'connector_id',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       from: 0,
     *       to: 0,
     *     },
     *   );
     * ```
     */
    list(connectorId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/snapshots`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Snapshot
     *
     * @example
     * ```ts
     * const snapshot =
     *   await client.magicTransit.connectors.snapshots.get(
     *     'connector_id',
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(connectorId, snapshotT, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/snapshots/${snapshotT}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Snapshots = Snapshots;
Snapshots.Latest = latest_1.Latest;
//# sourceMappingURL=snapshots.js.map