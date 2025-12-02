import type { WaitlistEntryStatus } from './Enums';
import { Invitation } from './Invitation';
import type { WaitlistEntryJSON } from './JSON';
export declare class WaitlistEntry {
    readonly id: string;
    readonly emailAddress: string;
    readonly status: WaitlistEntryStatus;
    readonly invitation: Invitation | null;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly isLocked?: boolean | undefined;
    constructor(id: string, emailAddress: string, status: WaitlistEntryStatus, invitation: Invitation | null, createdAt: number, updatedAt: number, isLocked?: boolean | undefined);
    static fromJSON(data: WaitlistEntryJSON): WaitlistEntry;
}
//# sourceMappingURL=WaitlistEntry.d.ts.map