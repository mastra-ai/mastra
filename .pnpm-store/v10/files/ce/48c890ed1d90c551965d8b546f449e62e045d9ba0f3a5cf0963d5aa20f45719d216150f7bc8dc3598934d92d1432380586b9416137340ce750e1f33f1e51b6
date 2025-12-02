import { List, PaginationOptions } from '../interfaces';
export declare class AutoPaginatable<T> {
    protected list: List<T>;
    private apiCall;
    readonly object: 'list';
    readonly options: PaginationOptions;
    constructor(list: List<T>, apiCall: (params: PaginationOptions) => Promise<List<T>>, options?: PaginationOptions);
    get data(): T[];
    get listMetadata(): {
        before?: string | undefined;
        after?: string | undefined;
    };
    private generatePages;
    /**
     * Automatically paginates over the list of results, returning the complete data set.
     * Returns the first result if `options.limit` is passed to the first request.
     */
    autoPagination(): Promise<T[]>;
}
