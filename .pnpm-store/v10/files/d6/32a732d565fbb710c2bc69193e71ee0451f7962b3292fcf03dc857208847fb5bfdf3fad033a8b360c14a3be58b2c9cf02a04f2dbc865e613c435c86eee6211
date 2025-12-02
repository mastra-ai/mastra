import type { ClerkPaginationRequest } from '@clerk/types';
import type { AllowlistIdentifier } from '../resources/AllowlistIdentifier';
import type { DeletedObject } from '../resources/DeletedObject';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import { AbstractAPI } from './AbstractApi';
type AllowlistIdentifierCreateParams = {
    identifier: string;
    notify: boolean;
};
export declare class AllowlistIdentifierAPI extends AbstractAPI {
    getAllowlistIdentifierList(params?: ClerkPaginationRequest): Promise<PaginatedResourceResponse<AllowlistIdentifier[]>>;
    createAllowlistIdentifier(params: AllowlistIdentifierCreateParams): Promise<AllowlistIdentifier>;
    deleteAllowlistIdentifier(allowlistIdentifierId: string): Promise<DeletedObject>;
}
export {};
//# sourceMappingURL=AllowlistIdentifierApi.d.ts.map