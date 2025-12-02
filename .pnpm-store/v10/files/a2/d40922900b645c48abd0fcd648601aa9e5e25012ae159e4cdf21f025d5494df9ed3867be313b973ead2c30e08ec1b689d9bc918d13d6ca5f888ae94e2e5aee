"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetDocumentInfoListCursor = void 0;
const core_1 = require("./core.js");
class GetDocumentInfoListCursor extends core_1.AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.documents = body.documents || [];
    }
    getPaginatedItems() {
        return this.documents ?? [];
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
        const documents = this.getPaginatedItems();
        if (!documents.length) {
            return null;
        }
        const path = documents[documents.length - 1]?.path;
        if (!path) {
            return null;
        }
        return { params: { path_gt: path } };
    }
}
exports.GetDocumentInfoListCursor = GetDocumentInfoListCursor;
//# sourceMappingURL=pagination.js.map