"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCreateAuditLogSchemaOptions = void 0;
function serializeMetadata(metadata) {
    if (!metadata) {
        return {};
    }
    const serializedMetadata = {};
    Object.keys(metadata).forEach((key) => {
        serializedMetadata[key] = {
            type: metadata[key],
        };
    });
    return serializedMetadata;
}
const serializeCreateAuditLogSchemaOptions = (schema) => {
    var _a;
    return ({
        actor: {
            metadata: {
                type: 'object',
                properties: serializeMetadata((_a = schema.actor) === null || _a === void 0 ? void 0 : _a.metadata),
            },
        },
        targets: schema.targets.map((target) => {
            return {
                type: target.type,
                metadata: target.metadata
                    ? {
                        type: 'object',
                        properties: serializeMetadata(target.metadata),
                    }
                    : undefined,
            };
        }),
        metadata: schema.metadata
            ? {
                type: 'object',
                properties: serializeMetadata(schema.metadata),
            }
            : undefined,
    });
};
exports.serializeCreateAuditLogSchemaOptions = serializeCreateAuditLogSchemaOptions;
