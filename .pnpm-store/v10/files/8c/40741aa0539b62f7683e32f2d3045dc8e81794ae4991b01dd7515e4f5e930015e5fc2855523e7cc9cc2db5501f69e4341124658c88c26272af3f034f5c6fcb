interface AuthenticationEventError {
    code: string;
    message: string;
}
type AuthenticationEventType = 'sso' | 'password' | 'oauth' | 'mfa' | 'magic_auth' | 'email_verification';
type AuthenticationEventStatus = 'failed' | 'succeeded';
export type AuthenticationEvent = {
    email: string | null;
    error?: AuthenticationEventError;
    ipAddress: string | null;
    status: AuthenticationEventStatus;
    type: AuthenticationEventType;
    userAgent: string | null;
    userId: string | null;
};
export interface AuthenticationEventResponse {
    email: string | null;
    error?: AuthenticationEventError;
    ip_address: string | null;
    status: AuthenticationEventStatus;
    type: AuthenticationEventType;
    user_agent: string | null;
    user_id: string | null;
}
export {};
