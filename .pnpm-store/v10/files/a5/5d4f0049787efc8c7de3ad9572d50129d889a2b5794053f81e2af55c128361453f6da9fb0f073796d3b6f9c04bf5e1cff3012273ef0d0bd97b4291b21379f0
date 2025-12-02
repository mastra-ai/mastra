// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as WebCrawlersAPI from "./web-crawlers.mjs";
import { WebCrawlers, } from "./web-crawlers.mjs";
export class Bots extends APIResource {
    constructor() {
        super(...arguments);
        this.webCrawlers = new WebCrawlersAPI.WebCrawlers(this._client);
    }
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/bots', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    get(botSlug, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(botSlug, {}, query);
        }
        return this._client.get(`/radar/bots/${botSlug}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    summary(dimension, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.summary(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/summary/${dimension}`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/bots/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseriesGroups(dimension, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseriesGroups(dimension, {}, query);
        }
        return this._client.get(`/radar/bots/timeseries_groups/${dimension}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
Bots.WebCrawlers = WebCrawlers;
//# sourceMappingURL=bots.mjs.map