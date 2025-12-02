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
exports.CommandListResponsesV4PagePagination = exports.Commands = void 0;
const resource_1 = require("../../../../resource.js");
const DevicesAPI = __importStar(require("./devices.js"));
const devices_1 = require("./devices.js");
const DownloadsAPI = __importStar(require("./downloads.js"));
const downloads_1 = require("./downloads.js");
const QuotaAPI = __importStar(require("./quota.js"));
const quota_1 = require("./quota.js");
const pagination_1 = require("../../../../pagination.js");
class Commands extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.devices = new DevicesAPI.Devices(this._client);
        this.downloads = new DownloadsAPI.Downloads(this._client);
        this.quota = new QuotaAPI.Quota(this._client);
    }
    /**
     * Initiate commands for up to 10 devices per account
     *
     * @example
     * ```ts
     * const command = await client.zeroTrust.dex.commands.create({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   commands: [
     *     {
     *       command_type: 'pcap',
     *       device_id: 'device_id',
     *       user_email: 'user_email',
     *     },
     *   ],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dex/commands`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves a paginated list of commands issued to devices under the specified
     * account, optionally filtered by time range, device, or other parameters
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const commandListResponse of client.zeroTrust.dex.commands.list(
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     page: 1,
     *     per_page: 50,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/commands`, CommandListResponsesV4PagePagination, { query, ...options });
    }
}
exports.Commands = Commands;
class CommandListResponsesV4PagePagination extends pagination_1.V4PagePagination {
}
exports.CommandListResponsesV4PagePagination = CommandListResponsesV4PagePagination;
Commands.CommandListResponsesV4PagePagination = CommandListResponsesV4PagePagination;
Commands.Devices = devices_1.Devices;
Commands.DeviceListResponsesV4PagePagination = devices_1.DeviceListResponsesV4PagePagination;
Commands.Downloads = downloads_1.Downloads;
Commands.Quota = quota_1.Quota;
//# sourceMappingURL=commands.js.map