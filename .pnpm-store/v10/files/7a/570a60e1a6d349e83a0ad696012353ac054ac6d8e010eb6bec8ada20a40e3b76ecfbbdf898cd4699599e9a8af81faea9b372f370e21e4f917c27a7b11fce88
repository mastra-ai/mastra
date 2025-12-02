"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckResult = void 0;
const check_options_serializer_1 = require("../serializers/check-options.serializer");
const CHECK_RESULT_AUTHORIZED = 'authorized';
class CheckResult {
    constructor(json) {
        this.result = json.result;
        this.isImplicit = json.is_implicit;
        this.warrantToken = json.warrant_token;
        this.debugInfo = json.debug_info
            ? {
                processingTime: json.debug_info.processing_time,
                decisionTree: (0, check_options_serializer_1.deserializeDecisionTreeNode)(json.debug_info.decision_tree),
            }
            : undefined;
        this.warnings = json.warnings;
    }
    isAuthorized() {
        return this.result === CHECK_RESULT_AUTHORIZED;
    }
}
exports.CheckResult = CheckResult;
