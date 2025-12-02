// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as CNIsAPI from "./cnis.mjs";
import { CNIs, } from "./cnis.mjs";
import * as InterconnectsAPI from "./interconnects.mjs";
import { Interconnects, } from "./interconnects.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings, } from "./settings.mjs";
import * as SlotsAPI from "./slots.mjs";
import { Slots } from "./slots.mjs";
export class NetworkInterconnects extends APIResource {
    constructor() {
        super(...arguments);
        this.cnis = new CNIsAPI.CNIs(this._client);
        this.interconnects = new InterconnectsAPI.Interconnects(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.slots = new SlotsAPI.Slots(this._client);
    }
}
NetworkInterconnects.CNIs = CNIs;
NetworkInterconnects.Interconnects = Interconnects;
NetworkInterconnects.Settings = Settings;
NetworkInterconnects.Slots = Slots;
//# sourceMappingURL=network-interconnects.mjs.map