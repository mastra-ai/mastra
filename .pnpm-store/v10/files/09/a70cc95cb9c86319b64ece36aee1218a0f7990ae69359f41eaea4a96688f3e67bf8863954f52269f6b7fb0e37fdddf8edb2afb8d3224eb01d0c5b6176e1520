import type { ClerkPaginationRequest } from '@clerk/types';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import type { WaitlistEntryStatus } from '../resources/Enums';
import type { WaitlistEntry } from '../resources/WaitlistEntry';
import { AbstractAPI } from './AbstractApi';
import type { WithSign } from './util-types';
type WaitlistEntryListParams = ClerkPaginationRequest<{
    /**
     * Filter waitlist entries by `email_address` or `id`
     */
    query?: string;
    status?: WaitlistEntryStatus;
    orderBy?: WithSign<'created_at' | 'invited_at' | 'email_address'>;
}>;
type WaitlistEntryCreateParams = {
    emailAddress: string;
    notify?: boolean;
};
export declare class WaitlistEntryAPI extends AbstractAPI {
    list(params?: WaitlistEntryListParams): Promise<PaginatedResourceResponse<WaitlistEntry>>;
    create(params: WaitlistEntryCreateParams): Promise<WaitlistEntry>;
}
export {};
//# sourceMappingURL=WaitlistEntryApi.d.ts.map