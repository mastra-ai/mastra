// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as BotClassAPI from "./bot-class.mjs";
import { BotClass } from "./bot-class.mjs";
import * as BrowserFamilyAPI from "./browser-family.mjs";
import { BrowserFamily } from "./browser-family.mjs";
import * as DeviceTypeAPI from "./device-type.mjs";
import { DeviceType } from "./device-type.mjs";
import * as HTTPMethodAPI from "./http-method.mjs";
import { HTTPMethod } from "./http-method.mjs";
import * as HTTPProtocolAPI from "./http-protocol.mjs";
import { HTTPProtocol } from "./http-protocol.mjs";
import * as IPVersionAPI from "./ip-version.mjs";
import { IPVersion } from "./ip-version.mjs";
import * as OSAPI from "./os.mjs";
import { OS } from "./os.mjs";
import * as TLSVersionAPI from "./tls-version.mjs";
import { TLSVersion } from "./tls-version.mjs";
export class Ases extends APIResource {
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
        if (isRequestOptions(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/http/top/ases', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Ases.BotClass = BotClass;
Ases.DeviceType = DeviceType;
Ases.HTTPProtocol = HTTPProtocol;
Ases.HTTPMethod = HTTPMethod;
Ases.IPVersion = IPVersion;
Ases.OS = OS;
Ases.TLSVersion = TLSVersion;
Ases.BrowserFamily = BrowserFamily;
//# sourceMappingURL=ases.mjs.map