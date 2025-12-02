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
exports.Billing = void 0;
const resource_1 = require("../../../resource.js");
const HistoryAPI = __importStar(require("./history.js"));
const history_1 = require("./history.js");
const ProfileAPI = __importStar(require("./profile.js"));
const profile_1 = require("./profile.js");
class Billing extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.history = new HistoryAPI.History(this._client);
        this.profile = new ProfileAPI.Profile(this._client);
    }
}
exports.Billing = Billing;
Billing.History = history_1.History;
Billing.BillingHistoriesV4PagePaginationArray = history_1.BillingHistoriesV4PagePaginationArray;
Billing.Profile = profile_1.Profile;
//# sourceMappingURL=billing.js.map