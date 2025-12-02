// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as IntegrationsAPI from "./integrations.mjs";
import { Integrations, IntegrationsSinglePage, } from "./integrations.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Posture extends APIResource {
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
export class DevicePostureRulesSinglePage extends SinglePage {
}
Posture.DevicePostureRulesSinglePage = DevicePostureRulesSinglePage;
Posture.Integrations = Integrations;
Posture.IntegrationsSinglePage = IntegrationsSinglePage;
//# sourceMappingURL=posture.mjs.map