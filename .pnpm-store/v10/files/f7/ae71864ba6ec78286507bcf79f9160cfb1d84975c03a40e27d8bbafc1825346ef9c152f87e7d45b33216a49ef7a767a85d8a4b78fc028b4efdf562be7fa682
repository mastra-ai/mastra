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
exports.DevicePostureRulesSinglePage = exports.Posture = void 0;
const resource_1 = require("../../../../resource.js");
const IntegrationsAPI = __importStar(require("./integrations.js"));
const integrations_1 = require("./integrations.js");
const pagination_1 = require("../../../../pagination.js");
class Posture extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.integrations = new IntegrationsAPI.Integrations(this._client);
    }
    /**
     * Creates a new device posture rule.
     *
     * @example
     * ```ts
     * const devicePostureRule =
     *   await client.zeroTrust.devices.posture.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'Admin Serial Numbers',
     *     type: 'file',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/posture`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a device posture rule.
     *
     * @example
     * ```ts
     * const devicePostureRule =
     *   await client.zeroTrust.devices.posture.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       name: 'Admin Serial Numbers',
     *       type: 'file',
     *     },
     *   );
     * ```
     */
    update(ruleId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/devices/posture/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches device posture rules for a Zero Trust account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const devicePostureRule of client.zeroTrust.devices.posture.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/posture`, DevicePostureRulesSinglePage, options);
    }
    /**
     * Deletes a device posture rule.
     *
     * @example
     * ```ts
     * const posture =
     *   await client.zeroTrust.devices.posture.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(ruleId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/devices/posture/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single device posture rule.
     *
     * @example
     * ```ts
     * const devicePostureRule =
     *   await client.zeroTrust.devices.posture.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(ruleId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/posture/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Posture = Posture;
class DevicePostureRulesSinglePage extends pagination_1.SinglePage {
}
exports.DevicePostureRulesSinglePage = DevicePostureRulesSinglePage;
Posture.DevicePostureRulesSinglePage = DevicePostureRulesSinglePage;
Posture.Integrations = integrations_1.Integrations;
Posture.IntegrationsSinglePage = integrations_1.IntegrationsSinglePage;
//# sourceMappingURL=posture.js.map