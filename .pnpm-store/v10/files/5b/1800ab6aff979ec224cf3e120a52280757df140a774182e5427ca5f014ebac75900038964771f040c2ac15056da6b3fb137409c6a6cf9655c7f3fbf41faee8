"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinglePage = exports.CursorLimitPagination = exports.CursorPagination = exports.V4PagePaginationArray = exports.V4PagePagination = void 0;
const core_1 = require("./core.js");
class V4PagePagination extends core_1.AbstractPage {
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
exports.V4PagePagination = V4PagePagination;
class V4PagePaginationArray extends core_1.AbstractPage {
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
exports.V4PagePaginationArray = V4PagePaginationArray;
class CursorPagination extends core_1.AbstractPage {
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
exports.CursorPagination = CursorPagination;
class CursorLimitPagination extends core_1.AbstractPage {
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
exports.CursorLimitPagination = CursorLimitPagination;
class SinglePage extends core_1.AbstractPage {
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
exports.SinglePage = SinglePage;
//# sourceMappingURL=pagination.js.map