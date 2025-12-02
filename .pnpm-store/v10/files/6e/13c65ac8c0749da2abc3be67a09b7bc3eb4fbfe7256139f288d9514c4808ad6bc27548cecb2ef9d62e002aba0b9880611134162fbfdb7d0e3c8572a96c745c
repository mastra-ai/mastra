"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeWriteWarrantOptions = void 0;
const interface_check_1 = require("../utils/interface-check");
const serializeWriteWarrantOptions = (warrant) => ({
    op: warrant.op,
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
    policy: warrant.policy,
});
exports.serializeWriteWarrantOptions = serializeWriteWarrantOptions;
