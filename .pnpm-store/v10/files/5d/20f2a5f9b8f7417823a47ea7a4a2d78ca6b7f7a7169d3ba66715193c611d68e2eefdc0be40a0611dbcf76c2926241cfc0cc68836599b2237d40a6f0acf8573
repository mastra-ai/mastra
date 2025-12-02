import type { SessionActivityJSON, SessionJSON } from './JSON';
export declare class SessionActivity {
    readonly id: string;
    readonly isMobile: boolean;
    readonly ipAddress?: string | undefined;
    readonly city?: string | undefined;
    readonly country?: string | undefined;
    readonly browserVersion?: string | undefined;
    readonly browserName?: string | undefined;
    readonly deviceType?: string | undefined;
    constructor(id: string, isMobile: boolean, ipAddress?: string | undefined, city?: string | undefined, country?: string | undefined, browserVersion?: string | undefined, browserName?: string | undefined, deviceType?: string | undefined);
    static fromJSON(data: SessionActivityJSON): SessionActivity;
}
export declare class Session {
    readonly id: string;
    readonly clientId: string;
    readonly userId: string;
    readonly status: string;
    readonly lastActiveAt: number;
    readonly expireAt: number;
    readonly abandonAt: number;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly lastActiveOrganizationId?: string | undefined;
    readonly latestActivity?: SessionActivity | undefined;
    readonly actor: Record<string, unknown> | null;
    constructor(id: string, clientId: string, userId: string, status: string, lastActiveAt: number, expireAt: number, abandonAt: number, createdAt: number, updatedAt: number, lastActiveOrganizationId?: string | undefined, latestActivity?: SessionActivity | undefined, actor?: Record<string, unknown> | null);
    static fromJSON(data: SessionJSON): Session;
}
//# sourceMappingURL=Session.d.ts.map