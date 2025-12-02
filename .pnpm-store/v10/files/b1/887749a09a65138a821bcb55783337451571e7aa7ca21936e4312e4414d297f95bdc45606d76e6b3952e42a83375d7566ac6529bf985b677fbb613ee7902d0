// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { AbstractPage } from "./core.mjs";
export class V4PagePagination extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.result = body.result || {};
        this.result_info = body.result_info || {};
    }
    getPaginatedItems() {
        return this.result?.items ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    nextPageParams() {
        const info = this.nextPageInfo();
        if (!info)
            return null;
        if ('params' in info)
            return info.params;
        const params = Object.fromEntries(info.url.searchParams);
        if (!Object.keys(params).length)
            return null;
        return params;
    }
    nextPageInfo() {
        const query = this.options.query;
        const currentPage = query?.page ?? 1;
        return { params: { page: currentPage + 1 } };
    }
}
export class V4PagePaginationArray extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.result = body.result || [];
        this.result_info = body.result_info || {};
    }
    getPaginatedItems() {
        return this.result ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    nextPageParams() {
        const info = this.nextPageInfo();
        if (!info)
            return null;
        if ('params' in info)
            return info.params;
        const params = Object.fromEntries(info.url.searchParams);
        if (!Object.keys(params).length)
            return null;
        return params;
    }
    nextPageInfo() {
        const query = this.options.query;
        const currentPage = query?.page ?? 1;
        return { params: { page: currentPage + 1 } };
    }
}
export class CursorPagination extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.result = body.result || [];
        this.result_info = body.result_info || {};
    }
    getPaginatedItems() {
        return this.result ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    nextPageParams() {
        const info = this.nextPageInfo();
        if (!info)
            return null;
        if ('params' in info)
            return info.params;
        const params = Object.fromEntries(info.url.searchParams);
        if (!Object.keys(params).length)
            return null;
        return params;
    }
    nextPageInfo() {
        const cursor = this.result_info?.cursor;
        if (!cursor) {
            return null;
        }
        return {
            params: {
                cursor,
            },
        };
    }
}
export class CursorLimitPagination extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.result = body.result || [];
        this.result_info = body.result_info || {};
    }
    getPaginatedItems() {
        return this.result ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    nextPageParams() {
        const info = this.nextPageInfo();
        if (!info)
            return null;
        if ('params' in info)
            return info.params;
        const params = Object.fromEntries(info.url.searchParams);
        if (!Object.keys(params).length)
            return null;
        return params;
    }
    nextPageInfo() {
        const cursor = this.result_info?.cursor;
        if (!cursor) {
            return null;
        }
        return {
            params: {
                cursor,
            },
        };
    }
}
export class SinglePage extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.result = body.result || [];
    }
    getPaginatedItems() {
        return this.result ?? [];
    }
    // @deprecated Please use `nextPageInfo()` instead
    /**
     * This page represents a response that isn't actually paginated at the API level
     * so there will never be any next page params.
     */
    nextPageParams() {
        return null;
    }
    nextPageInfo() {
        return null;
    }
}
//# sourceMappingURL=pagination.mjs.map