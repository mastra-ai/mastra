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
exports.NetworkInterconnects = void 0;
const resource_1 = require("../../resource.js");
const CNIsAPI = __importStar(require("./cnis.js"));
const cnis_1 = require("./cnis.js");
const InterconnectsAPI = __importStar(require("./interconnects.js"));
const interconnects_1 = require("./interconnects.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const SlotsAPI = __importStar(require("./slots.js"));
const slots_1 = require("./slots.js");
class NetworkInterconnects extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.cnis = new CNIsAPI.CNIs(this._client);
        this.interconnects = new InterconnectsAPI.Interconnects(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.slots = new SlotsAPI.Slots(this._client);
    }
}
exports.NetworkInterconnects = NetworkInterconnects;
NetworkInterconnects.CNIs = cnis_1.CNIs;
NetworkInterconnects.Interconnects = interconnects_1.Interconnects;
NetworkInterconnects.Settings = settings_1.Settings;
NetworkInterconnects.Slots = slots_1.Slots;
//# sourceMappingURL=network-interconnects.js.map