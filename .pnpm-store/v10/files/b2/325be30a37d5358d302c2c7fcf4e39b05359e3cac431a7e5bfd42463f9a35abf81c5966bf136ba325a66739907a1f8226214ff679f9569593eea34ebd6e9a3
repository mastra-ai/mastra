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
exports.AI = void 0;
const resource_1 = require("../../../resource.js");
const TimeseriesGroupsAPI = __importStar(require("./timeseries-groups.js"));
const timeseries_groups_1 = require("./timeseries-groups.js");
const ToMarkdownAPI = __importStar(require("./to-markdown.js"));
const to_markdown_1 = require("./to-markdown.js");
const BotsAPI = __importStar(require("./bots/bots.js"));
const bots_1 = require("./bots/bots.js");
const InferenceAPI = __importStar(require("./inference/inference.js"));
const inference_1 = require("./inference/inference.js");
class AI extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.toMarkdown = new ToMarkdownAPI.ToMarkdown(this._client);
        this.inference = new InferenceAPI.Inference(this._client);
        this.bots = new BotsAPI.Bots(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
    }
}
exports.AI = AI;
AI.ToMarkdown = to_markdown_1.ToMarkdown;
AI.ToMarkdownCreateResponsesSinglePage = to_markdown_1.ToMarkdownCreateResponsesSinglePage;
AI.Inference = inference_1.Inference;
AI.Bots = bots_1.Bots;
AI.TimeseriesGroups = timeseries_groups_1.TimeseriesGroups;
//# sourceMappingURL=ai.js.map