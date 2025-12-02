import { Impersonator } from './impersonator.interface';
export type AuthMethod = 'external_auth' | 'impersonation' | 'magic_code' | 'migrated_session' | 'oauth' | 'passkey' | 'password' | 'sso' | 'unknown';
export type SessionStatus = 'active' | 'expired' | 'revoked';
export interface Session {
    object: 'session';
    id: string;
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    organizationId?: string;
    impersonator?: Impersonator;
    authMethod: AuthMethod;
    status: SessionStatus;
    expiresAt: string;
    endedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface SessionResponse {
    object: 'session';
    id: string;
    user_id: string;
    ip_address: string | null;
    user_agent: string | null;
    organization_id?: string;
    impersonator?: Impersonator;
    auth_method: AuthMethod;
    status: SessionStatus;
    expires_at: string;
    ended_at: string | null;
    created_at: string;
    updated_at: string;
}
