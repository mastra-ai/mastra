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
exports.MagicTransit = void 0;
const resource_1 = require("../../resource.js");
const AppsAPI = __importStar(require("./apps.js"));
const apps_1 = require("./apps.js");
const CfInterconnectsAPI = __importStar(require("./cf-interconnects.js"));
const cf_interconnects_1 = require("./cf-interconnects.js");
const GRETunnelsAPI = __importStar(require("./gre-tunnels.js"));
const gre_tunnels_1 = require("./gre-tunnels.js");
const IPSECTunnelsAPI = __importStar(require("./ipsec-tunnels.js"));
const ipsec_tunnels_1 = require("./ipsec-tunnels.js");
const RoutesAPI = __importStar(require("./routes.js"));
const routes_1 = require("./routes.js");
const ConnectorsAPI = __importStar(require("./connectors/connectors.js"));
const connectors_1 = require("./connectors/connectors.js");
const PCAPsAPI = __importStar(require("./pcaps/pcaps.js"));
const pcaps_1 = require("./pcaps/pcaps.js");
const SitesAPI = __importStar(require("./sites/sites.js"));
const sites_1 = require("./sites/sites.js");
class MagicTransit extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.apps = new AppsAPI.Apps(this._client);
        this.cfInterconnects = new CfInterconnectsAPI.CfInterconnects(this._client);
        this.greTunnels = new GRETunnelsAPI.GRETunnels(this._client);
        this.ipsecTunnels = new IPSECTunnelsAPI.IPSECTunnels(this._client);
        this.routes = new RoutesAPI.Routes(this._client);
        this.sites = new SitesAPI.Sites(this._client);
        this.connectors = new ConnectorsAPI.Connectors(this._client);
        this.pcaps = new PCAPsAPI.PCAPs(this._client);
    }
}
exports.MagicTransit = MagicTransit;
MagicTransit.Apps = apps_1.Apps;
MagicTransit.AppListResponsesSinglePage = apps_1.AppListResponsesSinglePage;
MagicTransit.CfInterconnects = cf_interconnects_1.CfInterconnects;
MagicTransit.GRETunnels = gre_tunnels_1.GRETunnels;
MagicTransit.IPSECTunnels = ipsec_tunnels_1.IPSECTunnels;
MagicTransit.Routes = routes_1.Routes;
MagicTransit.Sites = sites_1.Sites;
MagicTransit.SitesSinglePage = sites_1.SitesSinglePage;
MagicTransit.Connectors = connectors_1.Connectors;
MagicTransit.ConnectorListResponsesSinglePage = connectors_1.ConnectorListResponsesSinglePage;
MagicTransit.PCAPs = pcaps_1.PCAPs;
MagicTransit.PCAPListResponsesSinglePage = pcaps_1.PCAPListResponsesSinglePage;
//# sourceMappingURL=magic-transit.js.map