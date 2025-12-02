import { PostOptions } from '../../common/interfaces';
export interface AuditLogActor {
    id: string;
    name?: string;
    type: string;
    metadata?: Record<string, string | number | boolean>;
}
export interface AuditLogTarget {
    id: string;
    name?: string;
    type: string;
    metadata?: Record<string, string | number | boolean>;
}
export interface CreateAuditLogEventOptions {
    action: string;
    version?: number;
    occurredAt: Date;
    actor: AuditLogActor;
    targets: AuditLogTarget[];
    context: {
        location: string;
        userAgent?: string;
    };
    metadata?: Record<string, string | number | boolean>;
}
export interface SerializedCreateAuditLogEventOptions {
    action: string;
    version?: number;
    occurred_at: string;
    actor: AuditLogActor;
    targets: AuditLogTarget[];
    context: {
        location: string;
        user_agent?: string;
    };
    metadata?: Record<string, string | number | boolean>;
}
export type CreateAuditLogEventRequestOptions = Pick<PostOptions, 'idempotencyKey'>;
