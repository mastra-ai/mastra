import type { ClerkPaginationRequest } from '@clerk/types';
import type { BlocklistIdentifier } from '../resources/BlocklistIdentifier';
import type { DeletedObject } from '../resources/DeletedObject';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import { AbstractAPI } from './AbstractApi';
type BlocklistIdentifierCreateParams = {
    identifier: string;
};
export declare class BlocklistIdentifierAPI extends AbstractAPI {
    getBlocklistIdentifierList(params?: ClerkPaginationRequest): Promise<PaginatedResourceResponse<BlocklistIdentifier[]>>;
    createBlocklistIdentifier(params: BlocklistIdentifierCreateParams): Promise<BlocklistIdentifier>;
    deleteBlocklistIdentifier(blocklistIdentifierId: string): Promise<DeletedObject>;
}
export {};
//# sourceMappingURL=BlocklistIdentifierApi.d.ts.map