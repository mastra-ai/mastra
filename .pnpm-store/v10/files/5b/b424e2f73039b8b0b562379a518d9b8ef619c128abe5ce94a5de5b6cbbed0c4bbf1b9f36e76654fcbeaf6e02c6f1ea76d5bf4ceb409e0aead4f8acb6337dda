// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { AbstractPage } from "./core.mjs";
export class GetDocumentInfoListCursor extends AbstractPage {
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
//# sourceMappingURL=pagination.mjs.map