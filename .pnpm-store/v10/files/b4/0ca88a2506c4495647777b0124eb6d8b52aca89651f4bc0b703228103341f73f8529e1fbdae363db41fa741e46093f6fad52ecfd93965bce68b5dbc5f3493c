// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as RetentionAPI from "./retention.mjs";
import { Retention, } from "./retention.mjs";
import * as CmbAPI from "./cmb/cmb.mjs";
import { Cmb } from "./cmb/cmb.mjs";
export class Control extends APIResource {
    constructor() {
        super(...arguments);
        this.retention = new RetentionAPI.Retention(this._client);
        this.cmb = new CmbAPI.Cmb(this._client);
    }
}
Control.Retention = Retention;
Control.Cmb = Cmb;
//# sourceMappingURL=control.mjs.map