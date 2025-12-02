"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeWarrant = void 0;
const deserializeWarrant = (warrant) => ({
    resourceType: warrant.resource_type,
    resourceId: warrant.resource_id,
    relation: warrant.relation,
    subject: {
        resourceType: warrant.subject.resource_type,
        resourceId: warrant.subject.resource_id,
        relation: warrant.subject.relation,
    },
    policy: warrant.policy,
});
exports.deserializeWarrant = deserializeWarrant;
