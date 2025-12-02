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
exports.DevicesSinglePage = exports.Devices = void 0;
const resource_1 = require("../../../resource.js");
const DevicesDevicesAPI = __importStar(require("./devices_.js"));
const devices_1 = require("./devices_.js");
const DEXTestsAPI = __importStar(require("./dex-tests.js"));
const dex_tests_1 = require("./dex-tests.js");
const FleetStatusAPI = __importStar(require("./fleet-status.js"));
const fleet_status_1 = require("./fleet-status.js");
const NetworksAPI = __importStar(require("./networks.js"));
const networks_1 = require("./networks.js");
const OverrideCodesAPI = __importStar(require("./override-codes.js"));
const override_codes_1 = require("./override-codes.js");
const RegistrationsAPI = __importStar(require("./registrations.js"));
const registrations_1 = require("./registrations.js");
const RevokeAPI = __importStar(require("./revoke.js"));
const revoke_1 = require("./revoke.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const UnrevokeAPI = __importStar(require("./unrevoke.js"));
const unrevoke_1 = require("./unrevoke.js");
const PoliciesAPI = __importStar(require("./policies/policies.js"));
const policies_1 = require("./policies/policies.js");
const PostureAPI = __importStar(require("./posture/posture.js"));
const posture_1 = require("./posture/posture.js");
const ResilienceAPI = __importStar(require("./resilience/resilience.js"));
const resilience_1 = require("./resilience/resilience.js");
const pagination_1 = require("../../../pagination.js");
class Devices extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.devices = new DevicesDevicesAPI.Devices(this._client);
        this.resilience = new ResilienceAPI.Resilience(this._client);
        this.registrations = new RegistrationsAPI.Registrations(this._client);
        this.dexTests = new DEXTestsAPI.DEXTests(this._client);
        this.networks = new NetworksAPI.Networks(this._client);
        this.fleetStatus = new FleetStatusAPI.FleetStatus(this._client);
        this.policies = new PoliciesAPI.Policies(this._client);
        this.posture = new PostureAPI.Posture(this._client);
        this.revoke = new RevokeAPI.Revoke(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.unrevoke = new UnrevokeAPI.Unrevoke(this._client);
        this.overrideCodes = new OverrideCodesAPI.OverrideCodes(this._client);
    }
    /**
     * List WARP devices. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled for the account.
     *
     * **Deprecated**: please use one of the following endpoints instead:
     *
     * - GET /accounts/{account_id}/devices/physical-devices
     * - GET /accounts/{account_id}/devices/registrations
     *
     * @deprecated
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices`, DevicesSinglePage, options);
    }
    /**
     * Fetches a single WARP device. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled for the account.
     *
     * **Deprecated**: please use one of the following endpoints instead:
     *
     * - GET /accounts/{account_id}/devices/physical-devices/{device_id}
     * - GET /accounts/{account_id}/devices/registrations/{registration_id}
     *
     * @deprecated
     */
    get(deviceId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/${deviceId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Devices = Devices;
class DevicesSinglePage extends pagination_1.SinglePage {
}
exports.DevicesSinglePage = DevicesSinglePage;
Devices.DevicesSinglePage = DevicesSinglePage;
Devices.Devices = devices_1.Devices;
Devices.DeviceListResponsesCursorPagination = devices_1.DeviceListResponsesCursorPagination;
Devices.Resilience = resilience_1.Resilience;
Devices.Registrations = registrations_1.Registrations;
Devices.RegistrationListResponsesCursorPagination = registrations_1.RegistrationListResponsesCursorPagination;
Devices.DEXTests = dex_tests_1.DEXTests;
Devices.DEXTestListResponsesSinglePage = dex_tests_1.DEXTestListResponsesSinglePage;
Devices.Networks = networks_1.Networks;
Devices.DeviceNetworksSinglePage = networks_1.DeviceNetworksSinglePage;
Devices.FleetStatus = fleet_status_1.FleetStatus;
Devices.Policies = policies_1.Policies;
Devices.Posture = posture_1.Posture;
Devices.DevicePostureRulesSinglePage = posture_1.DevicePostureRulesSinglePage;
Devices.Revoke = revoke_1.Revoke;
Devices.Settings = settings_1.Settings;
Devices.Unrevoke = unrevoke_1.Unrevoke;
Devices.OverrideCodes = override_codes_1.OverrideCodes;
Devices.OverrideCodeListResponsesSinglePage = override_codes_1.OverrideCodeListResponsesSinglePage;
//# sourceMappingURL=devices.js.map