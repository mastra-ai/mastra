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
exports.Ases = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const BotClassAPI = __importStar(require("./bot-class.js"));
const bot_class_1 = require("./bot-class.js");
const BrowserFamilyAPI = __importStar(require("./browser-family.js"));
const browser_family_1 = require("./browser-family.js");
const DeviceTypeAPI = __importStar(require("./device-type.js"));
const device_type_1 = require("./device-type.js");
const HTTPMethodAPI = __importStar(require("./http-method.js"));
const http_method_1 = require("./http-method.js");
const HTTPProtocolAPI = __importStar(require("./http-protocol.js"));
const http_protocol_1 = require("./http-protocol.js");
const IPVersionAPI = __importStar(require("./ip-version.js"));
const ip_version_1 = require("./ip-version.js");
const OSAPI = __importStar(require("./os.js"));
const os_1 = require("./os.js");
const TLSVersionAPI = __importStar(require("./tls-version.js"));
const tls_version_1 = require("./tls-version.js");
class Ases extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.botClass = new BotClassAPI.BotClass(this._client);
        this.deviceType = new DeviceTypeAPI.DeviceType(this._client);
        this.httpProtocol = new HTTPProtocolAPI.HTTPProtocol(this._client);
        this.httpMethod = new HTTPMethodAPI.HTTPMethod(this._client);
        this.ipVersion = new IPVersionAPI.IPVersion(this._client);
        this.os = new OSAPI.OS(this._client);
        this.tlsVersion = new TLSVersionAPI.TLSVersion(this._client);
        this.browserFamily = new BrowserFamilyAPI.BrowserFamily(this._client);
    }
    get(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/http/top/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Ases = Ases;
Ases.BotClass = bot_class_1.BotClass;
Ases.DeviceType = device_type_1.DeviceType;
Ases.HTTPProtocol = http_protocol_1.HTTPProtocol;
Ases.HTTPMethod = http_method_1.HTTPMethod;
Ases.IPVersion = ip_version_1.IPVersion;
Ases.OS = os_1.OS;
Ases.TLSVersion = tls_version_1.TLSVersion;
Ases.BrowserFamily = browser_family_1.BrowserFamily;
//# sourceMappingURL=ases.js.map