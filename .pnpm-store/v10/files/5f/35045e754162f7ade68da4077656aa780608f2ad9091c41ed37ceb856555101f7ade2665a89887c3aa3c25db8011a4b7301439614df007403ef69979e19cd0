import { AbstractPage, Response, APIClient, FinalRequestOptions, PageInfo } from "./core.js";
export interface V4PagePaginationResponse<Item> {
    result: V4PagePaginationResponse.Result<Item>;
    result_info: V4PagePaginationResponse.ResultInfo;
}
export declare namespace V4PagePaginationResponse {
    interface Result<Item> {
        items?: Array<Item>;
    }
    interface ResultInfo {
        page?: number;
        per_page?: number;
    }
}
export interface V4PagePaginationParams {
    page?: number;
    per_page?: number;
}
export declare class V4PagePagination<Item> extends AbstractPage<Item> implements V4PagePaginationResponse<Item> {
    result: V4PagePaginationResponse.Result<Item>;
    result_info: V4PagePaginationResponse.ResultInfo;
    constructor(client: APIClient, response: Response, body: V4PagePaginationResponse<Item>, options: FinalRequestOptions);
    getPaginatedItems(): Item[];
    nextPageParams(): Partial<V4PagePaginationParams> | null;
    nextPageInfo(): PageInfo | null;
}
export interface V4PagePaginationArrayResponse<Item> {
    result: Array<Item>;
    result_info: V4PagePaginationArrayResponse.ResultInfo;
}
export declare namespace V4PagePaginationArrayResponse {
    interface ResultInfo {
        page?: number;
        per_page?: number;
    }
}
export interface V4PagePaginationArrayParams {
    page?: number;
    per_page?: number;
}
export declare class V4PagePaginationArray<Item> extends AbstractPage<Item> implements V4PagePaginationArrayResponse<Item> {
    result: Array<Item>;
    result_info: V4PagePaginationArrayResponse.ResultInfo;
    constructor(client: APIClient, response: Response, body: V4PagePaginationArrayResponse<Item>, options: FinalRequestOptions);
    getPaginatedItems(): Item[];
    nextPageParams(): Partial<V4PagePaginationArrayParams> | null;
    nextPageInfo(): PageInfo | null;
}
export interface CursorPaginationResponse<Item> {
    result: Array<Item>;
    result_info: CursorPaginationResponse.ResultInfo;
}
export declare namespace CursorPaginationResponse {
    interface ResultInfo {
        count?: number;
        cursor?: string;
        per_page?: number;
    }
}
export interface CursorPaginationParams {
    per_page?: number;
    cursor?: string;
}
export declare class CursorPagination<Item> extends AbstractPage<Item> implements CursorPaginationResponse<Item> {
    result: Array<Item>;
    result_info: CursorPaginationResponse.ResultInfo;
    constructor(client: APIClient, response: Response, body: CursorPaginationResponse<Item>, options: FinalRequestOptions);
    getPaginatedItems(): Item[];
    nextPageParams(): Partial<CursorPaginationParams> | null;
    nextPageInfo(): PageInfo | null;
}
export interface CursorLimitPaginationResponse<Item> {
    result: Array<Item>;
    result_info: CursorLimitPaginationResponse.ResultInfo;
}
export declare namespace CursorLimitPaginationResponse {
    interface ResultInfo {
        count?: number;
        cursor?: string;
        per_page?: number;
    }
}
export interface CursorLimitPaginationParams {
    limit?: number;
    cursor?: string;
}
export declare class CursorLimitPagination<Item> extends AbstractPage<Item> implements CursorLimitPaginationResponse<Item> {
    result: Array<Item>;
    result_info: CursorLimitPaginationResponse.ResultInfo;
    constructor(client: APIClient, response: Response, body: CursorLimitPaginationResponse<Item>, options: FinalRequestOptions);
    getPaginatedItems(): Item[];
    nextPageParams(): Partial<CursorLimitPaginationParams> | null;
    nextPageInfo(): PageInfo | null;
}
export interface SinglePageResponse<Item> {
    result: Array<Item>;
}
export declare class SinglePage<Item> extends AbstractPage<Item> implements SinglePageResponse<Item> {
    result: Array<Item>;
    constructor(client: APIClient, response: Response, body: SinglePageResponse<Item>, options: FinalRequestOptions);
    getPaginatedItems(): Item[];
    /**
     * This page represents a response that isn't actually paginated at the API level
     * so there will never be any next page params.
     */
    nextPageParams(): null;
    nextPageInfo(): null;
}
//# sourceMappingURL=pagination.d.ts.map