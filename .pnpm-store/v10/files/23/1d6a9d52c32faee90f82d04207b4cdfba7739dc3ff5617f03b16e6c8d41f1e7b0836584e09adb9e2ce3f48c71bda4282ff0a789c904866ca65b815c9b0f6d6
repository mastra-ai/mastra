import { Warrant, PolicyContext, WarrantResponse } from './warrant.interface';
import { PaginationOptions } from '../../common/interfaces/pagination-options.interface';
import { GetOptions } from '../../common/interfaces';
export interface QueryOptions extends PaginationOptions {
    q: string;
    context?: PolicyContext;
}
export interface SerializedQueryOptions extends PaginationOptions {
    q: string;
    context?: string;
}
export interface QueryResult {
    resourceType: string;
    resourceId: string;
    relation: string;
    warrant: Warrant;
    isImplicit: boolean;
    meta?: {
        [key: string]: any;
    };
}
export interface QueryResultResponse {
    resource_type: string;
    resource_id: string;
    relation: string;
    warrant: WarrantResponse;
    is_implicit: boolean;
    meta?: Record<string, any>;
}
export type QueryRequestOptions = Pick<GetOptions, 'warrantToken'>;
