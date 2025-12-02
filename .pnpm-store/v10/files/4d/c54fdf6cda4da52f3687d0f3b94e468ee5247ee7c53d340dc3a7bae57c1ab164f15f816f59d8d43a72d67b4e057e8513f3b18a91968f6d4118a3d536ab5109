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
exports.ZeroTrust = void 0;
const resource_1 = require("../../resource.js");
const ConnectivitySettingsAPI = __importStar(require("./connectivity-settings.js"));
const connectivity_settings_1 = require("./connectivity-settings.js");
const SeatsAPI = __importStar(require("./seats.js"));
const seats_1 = require("./seats.js");
const AccessAPI = __importStar(require("./access/access.js"));
const access_1 = require("./access/access.js");
const DevicesAPI = __importStar(require("./devices/devices.js"));
const devices_1 = require("./devices/devices.js");
const DEXAPI = __importStar(require("./dex/dex.js"));
const dex_1 = require("./dex/dex.js");
const DLPAPI = __importStar(require("./dlp/dlp.js"));
const dlp_1 = require("./dlp/dlp.js");
const GatewayAPI = __importStar(require("./gateway/gateway.js"));
const gateway_1 = require("./gateway/gateway.js");
const IdentityProvidersAPI = __importStar(require("./identity-providers/identity-providers.js"));
const identity_providers_1 = require("./identity-providers/identity-providers.js");
const NetworksAPI = __importStar(require("./networks/networks.js"));
const networks_1 = require("./networks/networks.js");
const OrganizationsAPI = __importStar(require("./organizations/organizations.js"));
const organizations_1 = require("./organizations/organizations.js");
const RiskScoringAPI = __importStar(require("./risk-scoring/risk-scoring.js"));
const risk_scoring_1 = require("./risk-scoring/risk-scoring.js");
const TunnelsAPI = __importStar(require("./tunnels/tunnels.js"));
const tunnels_1 = require("./tunnels/tunnels.js");
class ZeroTrust extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.devices = new DevicesAPI.Devices(this._client);
        this.identityProviders = new IdentityProvidersAPI.IdentityProviders(this._client);
        this.organizations = new OrganizationsAPI.Organizations(this._client);
        this.seats = new SeatsAPI.Seats(this._client);
        this.access = new AccessAPI.Access(this._client);
        this.dex = new DEXAPI.DEX(this._client);
        this.tunnels = new TunnelsAPI.Tunnels(this._client);
        this.connectivitySettings = new ConnectivitySettingsAPI.ConnectivitySettings(this._client);
        this.dlp = new DLPAPI.DLP(this._client);
        this.gateway = new GatewayAPI.Gateway(this._client);
        this.networks = new NetworksAPI.Networks(this._client);
        this.riskScoring = new RiskScoringAPI.RiskScoring(this._client);
    }
}
exports.ZeroTrust = ZeroTrust;
ZeroTrust.Devices = devices_1.Devices;
ZeroTrust.DevicesSinglePage = devices_1.DevicesSinglePage;
ZeroTrust.IdentityProviders = identity_providers_1.IdentityProviders;
ZeroTrust.IdentityProviderListResponsesSinglePage = identity_providers_1.IdentityProviderListResponsesSinglePage;
ZeroTrust.Organizations = organizations_1.Organizations;
ZeroTrust.Seats = seats_1.Seats;
ZeroTrust.SeatsSinglePage = seats_1.SeatsSinglePage;
ZeroTrust.Access = access_1.Access;
ZeroTrust.DEX = dex_1.DEX;
ZeroTrust.Tunnels = tunnels_1.Tunnels;
ZeroTrust.TunnelListResponsesV4PagePaginationArray = tunnels_1.TunnelListResponsesV4PagePaginationArray;
ZeroTrust.ConnectivitySettings = connectivity_settings_1.ConnectivitySettings;
ZeroTrust.DLP = dlp_1.DLP;
ZeroTrust.Gateway = gateway_1.Gateway;
ZeroTrust.Networks = networks_1.Networks;
ZeroTrust.RiskScoring = risk_scoring_1.RiskScoring;
//# sourceMappingURL=zero-trust.js.map