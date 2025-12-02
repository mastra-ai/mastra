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
exports.ConnectorListResponsesSinglePage = exports.Connectors = void 0;
const resource_1 = require("../../../resource.js");
const EventsAPI = __importStar(require("./events/events.js"));
const events_1 = require("./events/events.js");
const SnapshotsAPI = __importStar(require("./snapshots/snapshots.js"));
const snapshots_1 = require("./snapshots/snapshots.js");
const pagination_1 = require("../../../pagination.js");
class Connectors extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.events = new EventsAPI.Events(this._client);
        this.snapshots = new SnapshotsAPI.Snapshots(this._client);
    }
    /**
     * Add a connector to your account
     *
     * @example
     * ```ts
     * const connector =
     *   await client.magicTransit.connectors.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     device: {},
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/connectors`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Replace Connector
     *
     * @example
     * ```ts
     * const connector =
     *   await client.magicTransit.connectors.update(
     *     'connector_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(connectorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/connectors/${connectorId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Connectors
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const connectorListResponse of client.magicTransit.connectors.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/connectors`, ConnectorListResponsesSinglePage, options);
    }
    /**
     * Remove a connector from your account
     *
     * @example
     * ```ts
     * const connector =
     *   await client.magicTransit.connectors.delete(
     *     'connector_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(connectorId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/connectors/${connectorId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit Connector to update specific properties
     *
     * @example
     * ```ts
     * const response = await client.magicTransit.connectors.edit(
     *   'connector_id',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(connectorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/connectors/${connectorId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch Connector
     *
     * @example
     * ```ts
     * const connector = await client.magicTransit.connectors.get(
     *   'connector_id',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(connectorId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Connectors = Connectors;
class ConnectorListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ConnectorListResponsesSinglePage = ConnectorListResponsesSinglePage;
Connectors.ConnectorListResponsesSinglePage = ConnectorListResponsesSinglePage;
Connectors.Events = events_1.Events;
Connectors.Snapshots = snapshots_1.Snapshots;
//# sourceMappingURL=connectors.js.map