// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as IPsAPI from "./ips.mjs";
import { IPs } from "./ips.mjs";
import * as RoutesAPI from "./routes.mjs";
import { Routes, } from "./routes.mjs";
import * as HijacksAPI from "./hijacks/hijacks.mjs";
import { Hijacks } from "./hijacks/hijacks.mjs";
import * as LeaksAPI from "./leaks/leaks.mjs";
import { Leaks } from "./leaks/leaks.mjs";
import * as TopAPI from "./top/top.mjs";
import { Top } from "./top/top.mjs";
export class BGP extends APIResource {
    constructor() {
        super(...arguments);
        this.leaks = new LeaksAPI.Leaks(this._client);
        this.top = new TopAPI.Top(this._client);
        this.hijacks = new HijacksAPI.Hijacks(this._client);
        this.routes = new RoutesAPI.Routes(this._client);
        this.ips = new IPsAPI.IPs(this._client);
    }
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/bgp/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
BGP.Leaks = Leaks;
BGP.Top = Top;
BGP.Hijacks = Hijacks;
BGP.Routes = Routes;
BGP.IPs = IPs;
//# sourceMappingURL=bgp.mjs.map