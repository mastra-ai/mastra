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
exports.Phases = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const VersionsAPI = __importStar(require("./versions.js"));
const versions_1 = require("./versions.js");
const error_1 = require("../../../error.js");
class Phases extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.versions = new VersionsAPI.Versions(this._client);
    }
    /**
     * Updates an account or zone entry point ruleset, creating a new version.
     *
     * @example
     * ```ts
     * const phase = await client.rulesets.phases.update(
     *   'http_request_firewall_custom',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    update(rulesetPhase, params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    get(rulesetPhase, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(rulesetPhase, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Phases = Phases;
Phases.Versions = versions_1.Versions;
Phases.VersionListResponsesSinglePage = versions_1.VersionListResponsesSinglePage;
//# sourceMappingURL=phases.js.map