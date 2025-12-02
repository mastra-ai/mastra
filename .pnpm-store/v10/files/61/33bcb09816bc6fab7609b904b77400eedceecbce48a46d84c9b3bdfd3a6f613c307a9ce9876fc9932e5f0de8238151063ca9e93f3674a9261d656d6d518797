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
exports.Logpush = void 0;
const resource_1 = require("../../resource.js");
const EdgeAPI = __importStar(require("./edge.js"));
const edge_1 = require("./edge.js");
const JobsAPI = __importStar(require("./jobs.js"));
const jobs_1 = require("./jobs.js");
const OwnershipAPI = __importStar(require("./ownership.js"));
const ownership_1 = require("./ownership.js");
const ValidateAPI = __importStar(require("./validate.js"));
const validate_1 = require("./validate.js");
const DatasetsAPI = __importStar(require("./datasets/datasets.js"));
const datasets_1 = require("./datasets/datasets.js");
class Logpush extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.edge = new EdgeAPI.Edge(this._client);
        this.jobs = new JobsAPI.Jobs(this._client);
        this.ownership = new OwnershipAPI.Ownership(this._client);
        this.validate = new ValidateAPI.Validate(this._client);
    }
}
exports.Logpush = Logpush;
Logpush.Datasets = datasets_1.Datasets;
Logpush.Edge = edge_1.Edge;
Logpush.InstantLogpushJobsSinglePage = edge_1.InstantLogpushJobsSinglePage;
Logpush.Jobs = jobs_1.Jobs;
Logpush.LogpushJobsSinglePage = jobs_1.LogpushJobsSinglePage;
Logpush.Ownership = ownership_1.Ownership;
Logpush.Validate = validate_1.Validate;
//# sourceMappingURL=logpush.js.map