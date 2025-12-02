"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeDecisionTreeNode = exports.serializeCheckBatchOptions = exports.serializeCheckOptions = void 0;
const interface_check_1 = require("../utils/interface-check");
const serializeCheckOptions = (options) => ({
    op: options.op,
    checks: options.checks.map(serializeCheckWarrantOptions),
    debug: options.debug,
});
exports.serializeCheckOptions = serializeCheckOptions;
const serializeCheckBatchOptions = (options) => ({
    op: 'batch',
    checks: options.checks.map(serializeCheckWarrantOptions),
    debug: options.debug,
});
exports.serializeCheckBatchOptions = serializeCheckBatchOptions;
const serializeCheckWarrantOptions = (warrant) => {
    var _a;
    return {
        resource_type: (0, interface_check_1.isResourceInterface)(warrant.resource)
            ? warrant.resource.getResourceType()
            : warrant.resource.resourceType,
        resource_id: (0, interface_check_1.isResourceInterface)(warrant.resource)
            ? warrant.resource.getResourceId()
            : warrant.resource.resourceId
                ? warrant.resource.resourceId
                : '',
        relation: warrant.relation,
        subject: (0, interface_check_1.isSubject)(warrant.subject)
            ? {
                resource_type: warrant.subject.resourceType,
                resource_id: warrant.subject.resourceId,
            }
            : {
                resource_type: warrant.subject.getResourceType(),
                resource_id: warrant.subject.getResourceId(),
            },
        context: (_a = warrant.context) !== null && _a !== void 0 ? _a : {},
    };
};
const deserializeDecisionTreeNode = (response) => {
    return {
        check: {
            resource: {
                resourceType: response.check.resource_type,
                resourceId: response.check.resource_id,
            },
            relation: response.check.relation,
            subject: {
                resourceType: response.check.subject.resource_type,
                resourceId: response.check.subject.resource_id,
            },
            context: response.check.context,
        },
        policy: response.policy,
        decision: response.decision,
        processingTime: response.processing_time,
        children: response.children.map(exports.deserializeDecisionTreeNode),
    };
};
exports.deserializeDecisionTreeNode = deserializeDecisionTreeNode;
