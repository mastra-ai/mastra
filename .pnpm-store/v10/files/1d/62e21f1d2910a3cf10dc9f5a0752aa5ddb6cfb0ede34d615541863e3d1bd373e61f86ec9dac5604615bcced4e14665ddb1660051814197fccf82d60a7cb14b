// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DevicesDevicesAPI from "./devices_.mjs";
import { DeviceListResponsesCursorPagination, Devices as DevicesAPIDevices, } from "./devices_.mjs";
import * as DEXTestsAPI from "./dex-tests.mjs";
import { DEXTestListResponsesSinglePage, DEXTests, } from "./dex-tests.mjs";
import * as FleetStatusAPI from "./fleet-status.mjs";
import { FleetStatus } from "./fleet-status.mjs";
import * as NetworksAPI from "./networks.mjs";
import { DeviceNetworksSinglePage, Networks, } from "./networks.mjs";
import * as OverrideCodesAPI from "./override-codes.mjs";
import { OverrideCodeListResponsesSinglePage, OverrideCodes, } from "./override-codes.mjs";
import * as RegistrationsAPI from "./registrations.mjs";
import { RegistrationListResponsesCursorPagination, Registrations, } from "./registrations.mjs";
import * as RevokeAPI from "./revoke.mjs";
import { Revoke } from "./revoke.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings, } from "./settings.mjs";
import * as UnrevokeAPI from "./unrevoke.mjs";
import { Unrevoke } from "./unrevoke.mjs";
import * as PoliciesAPI from "./policies/policies.mjs";
import { Policies, } from "./policies/policies.mjs";
import * as PostureAPI from "./posture/posture.mjs";
import { DevicePostureRulesSinglePage, Posture, } from "./posture/posture.mjs";
import * as ResilienceAPI from "./resilience/resilience.mjs";
import { Resilience } from "./resilience/resilience.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Devices extends APIResource {
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
export class DevicesSinglePage extends SinglePage {
}
Devices.DevicesSinglePage = DevicesSinglePage;
Devices.Devices = DevicesAPIDevices;
Devices.DeviceListResponsesCursorPagination = DeviceListResponsesCursorPagination;
Devices.Resilience = Resilience;
Devices.Registrations = Registrations;
Devices.RegistrationListResponsesCursorPagination = RegistrationListResponsesCursorPagination;
Devices.DEXTests = DEXTests;
Devices.DEXTestListResponsesSinglePage = DEXTestListResponsesSinglePage;
Devices.Networks = Networks;
Devices.DeviceNetworksSinglePage = DeviceNetworksSinglePage;
Devices.FleetStatus = FleetStatus;
Devices.Policies = Policies;
Devices.Posture = Posture;
Devices.DevicePostureRulesSinglePage = DevicePostureRulesSinglePage;
Devices.Revoke = Revoke;
Devices.Settings = Settings;
Devices.Unrevoke = Unrevoke;
Devices.OverrideCodes = OverrideCodes;
Devices.OverrideCodeListResponsesSinglePage = OverrideCodeListResponsesSinglePage;
//# sourceMappingURL=devices.mjs.map