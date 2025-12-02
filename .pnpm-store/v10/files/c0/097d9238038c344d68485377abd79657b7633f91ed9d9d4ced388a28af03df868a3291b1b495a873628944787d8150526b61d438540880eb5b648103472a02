import { PostOptions } from '../../common/interfaces';
export type AuditLogSchemaMetadata = Record<string, {
    type: 'string' | 'boolean' | 'number';
}> | undefined;
export interface AuditLogSchema {
    object: 'audit_log_schema';
    version: number;
    targets: AuditLogTargetSchema[];
    actor: AuditLogActorSchema;
    metadata: Record<string, string | boolean | number> | undefined;
    createdAt: string;
}
export interface AuditLogActorSchema {
    metadata: Record<string, string | boolean | number>;
}
export interface AuditLogTargetSchema {
    type: string;
    metadata?: Record<string, string | boolean | number> | undefined;
}
export interface CreateAuditLogSchemaOptions {
    action: string;
    targets: AuditLogTargetSchema[];
    actor?: AuditLogActorSchema;
    metadata?: Record<string, string | boolean | number>;
}
interface SerializedAuditLogTargetSchema {
    type: string;
    metadata?: {
        type: 'object';
        properties: AuditLogSchemaMetadata;
    };
}
export interface SerializedCreateAuditLogSchemaOptions {
    targets: SerializedAuditLogTargetSchema[];
    actor?: {
        metadata: {
            type: 'object';
            properties: AuditLogSchemaMetadata;
        };
    };
    metadata?: {
        type: 'object';
        properties: AuditLogSchemaMetadata;
    };
}
export interface CreateAuditLogSchemaResponse {
    object: 'audit_log_schema';
    version: number;
    targets: SerializedAuditLogTargetSchema[];
    actor: {
        metadata: {
            type: 'object';
            properties: AuditLogSchemaMetadata;
        };
    };
    metadata?: {
        type: 'object';
        properties: AuditLogSchemaMetadata;
    };
    created_at: string;
}
export type CreateAuditLogSchemaRequestOptions = Pick<PostOptions, 'idempotencyKey'>;
export {};
