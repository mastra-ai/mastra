import { AbstractPage, Response, APIClient, FinalRequestOptions, PageInfo } from "./core.js";
export interface GetDocumentInfoListCursorResponse<Item> {
    documents: Array<Item>;
}
export interface GetDocumentInfoListCursorParams {
    path_gt?: string;
    limit?: number;
}
export declare class GetDocumentInfoListCursor<Item extends {
    path: string;
}> extends AbstractPage<Item> implements GetDocumentInfoListCursorResponse<Item> {
    documents: Array<Item>;
    constructor(client: APIClient, response: Response, body: GetDocumentInfoListCursorResponse<Item>, options: FinalRequestOptions);
    getPaginatedItems(): Item[];
    nextPageParams(): Partial<GetDocumentInfoListCursorParams> | null;
    nextPageInfo(): PageInfo | null;
}
//# sourceMappingURL=pagination.d.ts.map