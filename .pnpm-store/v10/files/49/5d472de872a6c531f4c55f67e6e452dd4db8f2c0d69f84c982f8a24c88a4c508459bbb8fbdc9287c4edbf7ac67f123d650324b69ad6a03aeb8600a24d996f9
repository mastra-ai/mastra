"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeAuditLogSchema = void 0;
function deserializeMetadata(metadata) {
    if (!metadata || !metadata.properties) {
        return {};
    }
    const deserializedMetadata = {};
    Object.keys(metadata.properties).forEach((key) => {
        if (metadata.properties) {
            deserializedMetadata[key] = metadata.properties[key].type;
        }
    });
    return deserializedMetadata;
}
const deserializeAuditLogSchema = (auditLogSchema) => {
    var _a;
    return ({
        object: auditLogSchema.object,
        version: auditLogSchema.version,
        targets: auditLogSchema.targets.map((target) => {
            return {
                type: target.type,
                metadata: target.metadata
                    ? deserializeMetadata(target.metadata)
                    : undefined,
            };
        }),
        actor: {
            metadata: deserializeMetadata((_a = auditLogSchema.actor) === null || _a === void 0 ? void 0 : _a.metadata),
        },
        metadata: auditLogSchema.metadata
            ? deserializeMetadata(auditLogSchema.metadata)
            : undefined,
        createdAt: auditLogSchema.created_at,
    });
};
exports.deserializeAuditLogSchema = deserializeAuditLogSchema;
