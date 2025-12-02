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
exports.Destinations = void 0;
const resource_1 = require("../../../resource.js");
const EligibleAPI = __importStar(require("./eligible.js"));
const eligible_1 = require("./eligible.js");
const PagerdutyAPI = __importStar(require("./pagerduty.js"));
const pagerduty_1 = require("./pagerduty.js");
const WebhooksAPI = __importStar(require("./webhooks.js"));
const webhooks_1 = require("./webhooks.js");
class Destinations extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.eligible = new EligibleAPI.Eligible(this._client);
        this.pagerduty = new PagerdutyAPI.PagerdutyResource(this._client);
        this.webhooks = new WebhooksAPI.Webhooks(this._client);
    }
}
exports.Destinations = Destinations;
Destinations.Eligible = eligible_1.Eligible;
Destinations.PagerdutyResource = pagerduty_1.PagerdutyResource;
Destinations.PagerdutiesSinglePage = pagerduty_1.PagerdutiesSinglePage;
Destinations.WebhooksSinglePage = webhooks_1.WebhooksSinglePage;
//# sourceMappingURL=destinations.js.map