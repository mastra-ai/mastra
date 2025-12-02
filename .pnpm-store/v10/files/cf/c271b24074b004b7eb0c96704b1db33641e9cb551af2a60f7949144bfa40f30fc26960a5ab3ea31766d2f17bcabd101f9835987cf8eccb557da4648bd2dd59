import type { ClerkPaginationRequest, SessionStatus } from '@clerk/types';
import type { Cookies } from '../resources/Cookies';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import type { Session } from '../resources/Session';
import type { Token } from '../resources/Token';
import { AbstractAPI } from './AbstractApi';
type SessionListParams = ClerkPaginationRequest<{
    clientId?: string;
    userId?: string;
    status?: SessionStatus;
}>;
type RefreshTokenParams = {
    expired_token: string;
    refresh_token: string;
    request_origin: string;
    request_originating_ip?: string;
    request_headers?: Record<string, string[]>;
    suffixed_cookies?: boolean;
    format?: 'token' | 'cookie';
};
type CreateSessionParams = {
    userId: string;
};
export declare class SessionAPI extends AbstractAPI {
    getSessionList(params?: SessionListParams): Promise<PaginatedResourceResponse<Session[]>>;
    getSession(sessionId: string): Promise<Session>;
    createSession(params: CreateSessionParams): Promise<Session>;
    revokeSession(sessionId: string): Promise<Session>;
    verifySession(sessionId: string, token: string): Promise<Session>;
    getToken(sessionId: string, template: string): Promise<Token>;
    refreshSession(sessionId: string, params: RefreshTokenParams & {
        format: 'token';
    }): Promise<Token>;
    refreshSession(sessionId: string, params: RefreshTokenParams & {
        format: 'cookie';
    }): Promise<Cookies>;
    refreshSession(sessionId: string, params: RefreshTokenParams): Promise<Token>;
}
export {};
//# sourceMappingURL=SessionApi.d.ts.map