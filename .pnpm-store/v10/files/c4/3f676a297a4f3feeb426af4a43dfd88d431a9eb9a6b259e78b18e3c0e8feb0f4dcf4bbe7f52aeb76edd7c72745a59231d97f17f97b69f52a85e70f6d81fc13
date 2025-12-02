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
exports.Logs = void 0;
const resource_1 = require("../../resource.js");
const RayIDAPI = __importStar(require("./rayid.js"));
const rayid_1 = require("./rayid.js");
const ControlAPI = __importStar(require("./control/control.js"));
const control_1 = require("./control/control.js");
const ReceivedAPI = __importStar(require("./received/received.js"));
const received_1 = require("./received/received.js");
class Logs extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.control = new ControlAPI.Control(this._client);
        this.RayID = new RayIDAPI.RayID(this._client);
        this.received = new ReceivedAPI.Received(this._client);
    }
}
exports.Logs = Logs;
Logs.Control = control_1.Control;
Logs.RayID = rayid_1.RayID;
Logs.Received = received_1.Received;
//# sourceMappingURL=logs.js.map