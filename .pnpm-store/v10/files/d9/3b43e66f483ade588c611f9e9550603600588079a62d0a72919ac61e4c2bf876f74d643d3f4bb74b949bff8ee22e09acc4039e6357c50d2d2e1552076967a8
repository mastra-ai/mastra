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
exports.Received = void 0;
const resource_1 = require("../../../resource.js");
const FieldsAPI = __importStar(require("./fields.js"));
const fields_1 = require("./fields.js");
class Received extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.fields = new FieldsAPI.Fields(this._client);
    }
    /**
     * The `/received` api route allows customers to retrieve their edge HTTP logs. The
     * basic access pattern is "give me all the logs for zone Z for minute M", where
     * the minute M refers to the time records were received at Cloudflare's central
     * data center. `start` is inclusive, and `end` is exclusive. Because of that, to
     * get all data, at minutely cadence, starting at 10AM, the proper values are:
     * `start=2018-05-20T10:00:00Z&end=2018-05-20T10:01:00Z`, then
     * `start=2018-05-20T10:01:00Z&end=2018-05-20T10:02:00Z` and so on; the overlap
     * will be handled properly.
     *
     * @example
     * ```ts
     * const received = await client.logs.received.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   end: '2018-05-20T10:01:00Z',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/logs/received`, { query, ...options });
    }
}
exports.Received = Received;
Received.Fields = fields_1.Fields;
//# sourceMappingURL=received.js.map