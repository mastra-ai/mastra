// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as IQIAPI from "./iqi.mjs";
import { IQI, } from "./iqi.mjs";
import * as SpeedAPI from "./speed/speed.mjs";
import { Speed, } from "./speed/speed.mjs";
export class Quality extends APIResource {
    constructor() {
        super(...arguments);
        this.iqi = new IQIAPI.IQI(this._client);
        this.speed = new SpeedAPI.Speed(this._client);
    }
}
Quality.IQI = IQI;
Quality.Speed = Speed;
//# sourceMappingURL=quality.mjs.map