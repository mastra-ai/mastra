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
exports.Bots = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const WebCrawlersAPI = __importStar(require("./web-crawlers.js"));
const web_crawlers_1 = require("./web-crawlers.js");
class Bots extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.webCrawlers = new WebCrawlersAPI.WebCrawlers(this._client);
    }
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/bots', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    get(botSlug, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(botSlug, {}, query);
        }
        return this._client.get(`/radar/bots/${botSlug}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    summary(dimension, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.summary(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/summary/${dimension}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseries(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/bots/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(dimension, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.timeseriesGroups(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/timeseries_groups/${dimension}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Bots = Bots;
Bots.WebCrawlers = web_crawlers_1.WebCrawlers;
//# sourceMappingURL=bots.js.map