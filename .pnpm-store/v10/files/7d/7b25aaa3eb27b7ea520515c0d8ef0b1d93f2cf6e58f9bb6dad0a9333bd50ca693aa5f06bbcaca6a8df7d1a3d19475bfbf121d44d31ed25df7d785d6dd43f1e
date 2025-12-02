import type { ClerkPaginationRequest } from '@clerk/types';
import type { Client } from '../resources/Client';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import type { HandshakePayload } from '../resources/HandshakePayload';
import { AbstractAPI } from './AbstractApi';
type GetHandshakePayloadParams = {
    nonce: string;
};
export declare class ClientAPI extends AbstractAPI {
    getClientList(params?: ClerkPaginationRequest): Promise<PaginatedResourceResponse<Client[]>>;
    getClient(clientId: string): Promise<Client>;
    verifyClient(token: string): Promise<Client>;
    getHandshakePayload(queryParams: GetHandshakePayloadParams): Promise<HandshakePayload>;
}
export {};
//# sourceMappingURL=ClientApi.d.ts.map