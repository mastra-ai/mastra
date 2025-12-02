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
exports.Zaraz = void 0;
const resource_1 = require("../../resource.js");
const ConfigAPI = __importStar(require("./config.js"));
const config_1 = require("./config.js");
const DefaultAPI = __importStar(require("./default.js"));
const default_1 = require("./default.js");
const ExportAPI = __importStar(require("./export.js"));
const export_1 = require("./export.js");
const PublishAPI = __importStar(require("./publish.js"));
const publish_1 = require("./publish.js");
const WorkflowAPI = __importStar(require("./workflow.js"));
const workflow_1 = require("./workflow.js");
const HistoryAPI = __importStar(require("./history/history.js"));
const history_1 = require("./history/history.js");
class Zaraz extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.config = new ConfigAPI.Config(this._client);
        this.default = new DefaultAPI.Default(this._client);
        this.export = new ExportAPI.Export(this._client);
        this.history = new HistoryAPI.History(this._client);
        this.publish = new PublishAPI.Publish(this._client);
        this.workflow = new WorkflowAPI.WorkflowResource(this._client);
    }
    /**
     * Updates Zaraz workflow for a zone.
     *
     * @example
     * ```ts
     * const workflow = await client.zaraz.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   workflow: 'realtime',
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, workflow } = params;
        return this._client.put(`/zones/${zone_id}/settings/zaraz/workflow`, {
            body: workflow,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Zaraz = Zaraz;
Zaraz.Config = config_1.Config;
Zaraz.Default = default_1.Default;
Zaraz.Export = export_1.Export;
Zaraz.History = history_1.History;
Zaraz.HistoryListResponsesSinglePage = history_1.HistoryListResponsesSinglePage;
Zaraz.Publish = publish_1.Publish;
Zaraz.WorkflowResource = workflow_1.WorkflowResource;
//# sourceMappingURL=zaraz.js.map