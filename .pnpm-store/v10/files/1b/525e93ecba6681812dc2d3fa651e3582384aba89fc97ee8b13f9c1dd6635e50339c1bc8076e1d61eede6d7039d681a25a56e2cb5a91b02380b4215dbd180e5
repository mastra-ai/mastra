// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as RayIDAPI from "./rayid.mjs";
import { RayID } from "./rayid.mjs";
import * as ControlAPI from "./control/control.mjs";
import { Control } from "./control/control.mjs";
import * as ReceivedAPI from "./received/received.mjs";
import { Received } from "./received/received.mjs";
export class Logs extends APIResource {
    constructor() {
        super(...arguments);
        this.control = new ControlAPI.Control(this._client);
        this.RayID = new RayIDAPI.RayID(this._client);
        this.received = new ReceivedAPI.Received(this._client);
    }
}
Logs.Control = Control;
Logs.RayID = RayID;
Logs.Received = Received;
//# sourceMappingURL=logs.mjs.map