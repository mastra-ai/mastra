// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Layer3API from "./layer3/layer3.mjs";
import { Layer3 } from "./layer3/layer3.mjs";
import * as Layer7API from "./layer7/layer7.mjs";
import { Layer7 } from "./layer7/layer7.mjs";
export class Attacks extends APIResource {
    constructor() {
        super(...arguments);
        this.layer3 = new Layer3API.Layer3(this._client);
        this.layer7 = new Layer7API.Layer7(this._client);
    }
}
Attacks.Layer3 = Layer3;
Attacks.Layer7 = Layer7;
//# sourceMappingURL=attacks.mjs.map