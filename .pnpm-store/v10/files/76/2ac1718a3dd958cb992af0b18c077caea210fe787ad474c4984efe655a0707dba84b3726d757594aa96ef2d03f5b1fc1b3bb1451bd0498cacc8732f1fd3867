"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleListResponsesSinglePage = exports.RuleUpdateResponsesSinglePage = exports.Rules = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Rules extends resource_1.APIResource {
    /**
     * Put Rules
     */
    update(params, options) {
        const { zone_id, rules } = params ?? {};
        return this._client.getAPIList(`/zones/${zone_id}/cloud_connector/rules`, RuleUpdateResponsesSinglePage, {
            body: rules,
            method: 'put',
            ...options,
        });
    }
    /**
     * Rules
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/cloud_connector/rules`, RuleListResponsesSinglePage, options);
    }
}
exports.Rules = Rules;
class RuleUpdateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
class RuleListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
Rules.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
//# sourceMappingURL=rules.js.map