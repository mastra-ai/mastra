"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCreateAuditLogEventOptions = void 0;
const serializeCreateAuditLogEventOptions = (event) => ({
    action: event.action,
    version: event.version,
    occurred_at: event.occurredAt.toISOString(),
    actor: event.actor,
    targets: event.targets,
    context: {
        location: event.context.location,
        user_agent: event.context.userAgent,
    },
    metadata: event.metadata,
});
exports.serializeCreateAuditLogEventOptions = serializeCreateAuditLogEventOptions;
