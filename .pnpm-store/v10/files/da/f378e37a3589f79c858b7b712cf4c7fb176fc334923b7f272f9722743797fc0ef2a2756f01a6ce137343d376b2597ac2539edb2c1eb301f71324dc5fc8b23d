import type { InvitationStatus } from './Enums';
import type { InvitationJSON } from './JSON';
export declare class Invitation {
    readonly id: string;
    readonly emailAddress: string;
    readonly publicMetadata: Record<string, unknown> | null;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly status: InvitationStatus;
    readonly url?: string | undefined;
    readonly revoked?: boolean | undefined;
    private _raw;
    get raw(): InvitationJSON | null;
    constructor(id: string, emailAddress: string, publicMetadata: Record<string, unknown> | null, createdAt: number, updatedAt: number, status: InvitationStatus, url?: string | undefined, revoked?: boolean | undefined);
    static fromJSON(data: InvitationJSON): Invitation;
}
//# sourceMappingURL=Invitation.d.ts.map