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
exports.RulesetListResponsesCursorPagination = exports.Rulesets = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const RulesAPI = __importStar(require("./rules.js"));
const rules_1 = require("./rules.js");
const VersionsAPI = __importStar(require("./versions.js"));
const versions_1 = require("./versions.js");
const PhasesAPI = __importStar(require("./phases/phases.js"));
const phases_1 = require("./phases/phases.js");
const error_1 = require("../../error.js");
const pagination_1 = require("../../pagination.js");
class Rulesets extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.phases = new PhasesAPI.Phases(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.versions = new VersionsAPI.Versions(this._client);
    }
    /**
     * Creates a ruleset.
     *
     * @example
     * ```ts
     * const ruleset = await client.rulesets.create({
     *   kind: 'root',
     *   name: 'My ruleset',
     *   phase: 'http_request_firewall_custom',
     *   account_id: 'account_id',
     * });
     * ```
     */
    create(params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/rulesets`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an account or zone ruleset, creating a new version.
     *
     * @example
     * ```ts
     * const ruleset = await client.rulesets.update(
     *   '2f2feab2026849078ba485f918791bdc',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    update(rulesetId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/rulesets`, RulesetListResponsesCursorPagination, { query, ...options });
    }
    delete(rulesetId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(rulesetId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    get(rulesetId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(rulesetId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Rulesets = Rulesets;
class RulesetListResponsesCursorPagination extends pagination_1.CursorPagination {
}
exports.RulesetListResponsesCursorPagination = RulesetListResponsesCursorPagination;
Rulesets.RulesetListResponsesCursorPagination = RulesetListResponsesCursorPagination;
Rulesets.Phases = phases_1.Phases;
Rulesets.Rules = rules_1.Rules;
Rulesets.Versions = versions_1.Versions;
Rulesets.VersionListResponsesSinglePage = versions_1.VersionListResponsesSinglePage;
//# sourceMappingURL=rulesets.js.map