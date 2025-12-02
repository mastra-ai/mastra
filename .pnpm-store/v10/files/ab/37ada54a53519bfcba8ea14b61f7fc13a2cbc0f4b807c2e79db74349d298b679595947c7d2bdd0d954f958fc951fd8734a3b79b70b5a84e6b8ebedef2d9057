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
exports.BGP = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const IPsAPI = __importStar(require("./ips.js"));
const ips_1 = require("./ips.js");
const RoutesAPI = __importStar(require("./routes.js"));
const routes_1 = require("./routes.js");
const HijacksAPI = __importStar(require("./hijacks/hijacks.js"));
const hijacks_1 = require("./hijacks/hijacks.js");
const LeaksAPI = __importStar(require("./leaks/leaks.js"));
const leaks_1 = require("./leaks/leaks.js");
const TopAPI = __importStar(require("./top/top.js"));
const top_1 = require("./top/top.js");
class BGP extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.leaks = new LeaksAPI.Leaks(this._client);
        this.top = new TopAPI.Top(this._client);
        this.hijacks = new HijacksAPI.Hijacks(this._client);
        this.routes = new RoutesAPI.Routes(this._client);
        this.ips = new IPsAPI.IPs(this._client);
    }
    timeseries(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/bgp/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.BGP = BGP;
BGP.Leaks = leaks_1.Leaks;
BGP.Top = top_1.Top;
BGP.Hijacks = hijacks_1.Hijacks;
BGP.Routes = routes_1.Routes;
BGP.IPs = ips_1.IPs;
//# sourceMappingURL=bgp.js.map