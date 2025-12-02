"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewIndexManager = exports.DesignDocument = exports.DesignDocumentView = void 0;
const utilities_1 = require("./utilities");
const viewtypes_1 = require("./viewtypes");
const bindingutilities_1 = require("./bindingutilities");
/**
 * Contains information about a view in a design document.
 *
 * @category Management
 */
class DesignDocumentView {
    /**
     * @internal
     */
    constructor(...args) {
        let data;
        if (typeof args[0] === 'string' || typeof args[0] === 'function') {
            data = {
                map: args[0],
                reduce: args[1],
            };
        }
        else {
            data = args[0];
        }
        this.map = data.map;
        this.reduce = data.reduce;
    }
    /**
     * @internal
     */
    static _toCppData(name, data) {
        return {
            name: name,
            map: data.map,
            reduce: data.reduce,
        };
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new DesignDocumentView({
            map: data.map,
            reduce: data.reduce,
        });
    }
}
exports.DesignDocumentView = DesignDocumentView;
/**
 * Contains information about a design document.
 *
 * @category Management
 */
class DesignDocument {
    /**
     * Same as {@link DesignDocumentView}.
     *
     * @deprecated Use {@link DesignDocumentView} directly.
     */
    static get View() {
        return DesignDocumentView;
    }
    /**
     * @internal
     */
    constructor(...args) {
        let data;
        if (typeof args[0] === 'string') {
            data = {
                name: args[0],
                views: args[1],
            };
        }
        else {
            data = args[0];
        }
        this.name = data.name;
        this.views = data.views || {};
        this.namespace = data.namespace || viewtypes_1.DesignDocumentNamespace.Production;
        this.rev = data.rev;
    }
    /**
     * @internal
     */
    static _fromNsData(ddocName, ddocData) {
        const views = {};
        for (const viewName in ddocData.views) {
            const viewData = ddocData.views[viewName];
            views[viewName] = new DesignDocumentView({
                map: viewData.map,
                reduce: viewData.reduce,
            });
        }
        return new DesignDocument({ name: ddocName, views: views });
    }
    /**
     * @internal
     */
    static _toCppData(data, namespace) {
        const cppView = {};
        for (const [k, v] of Object.entries(data.views)) {
            cppView[k] = DesignDocumentView._toCppData(k, v);
        }
        return {
            rev: data.rev,
            name: data.name,
            ns: (0, bindingutilities_1.designDocumentNamespaceToCpp)(namespace),
            views: cppView,
        };
    }
    /**
     * @internal
     */
    static _fromCppData(ddoc) {
        const views = {};
        for (const [viewName, viewData] of Object.entries(ddoc.views)) {
            views[viewName] = DesignDocumentView._fromCppData(viewData);
        }
        return new DesignDocument({
            name: ddoc.name,
            views: views,
            namespace: (0, bindingutilities_1.designDocumentNamespaceFromCpp)(ddoc.ns),
            rev: ddoc.rev,
        });
    }
}
exports.DesignDocument = DesignDocument;
/**
 * ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.
 *
 * @category Management
 */
class ViewIndexManager {
    /**
     * @internal
     */
    constructor(bucket) {
        this._bucket = bucket;
    }
    /**
     * @internal
     */
    get _cluster() {
        return this._bucket.cluster;
    }
    /**
     * @internal
     */
    async getAllDesignDocuments() {
        let namespace;
        let options;
        let callback;
        // deprecated path: options and maybe callback passed in
        if (typeof arguments[0] === 'object') {
            namespace = undefined;
            options = arguments[0];
            callback = arguments[1];
        }
        else if (arguments[0] instanceof Function) {
            // deprecated path: no options, only callback passed in
            namespace = undefined;
            options = undefined;
            callback = arguments[0];
        }
        else {
            // either no args passed in or desired path (namespace is 1st arg)
            namespace = arguments[0];
            // still need to handle possible no options, but callback passed in
            if (arguments[1] instanceof Function) {
                callback = arguments[1];
                options = undefined;
            }
            else {
                options = arguments[1];
                callback = arguments[2];
            }
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        const ns = namespace !== null && namespace !== void 0 ? namespace : viewtypes_1.DesignDocumentNamespace.Production;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementViewIndexGetAll({
                bucket_name: this._bucket.name,
                ns: (0, bindingutilities_1.designDocumentNamespaceToCpp)(ns),
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const ddocs = [];
                for (const ddoc of resp.design_documents) {
                    ddocs.push(DesignDocument._fromCppData(ddoc));
                }
                wrapCallback(null, ddocs);
            });
        }, callback);
    }
    /**
     * @internal
     */
    async getDesignDocument() {
        let designDocName = arguments[0];
        let namespace;
        let options;
        let callback;
        // deprecated path: options and maybe callback passed in
        if (typeof arguments[1] === 'object') {
            namespace = undefined;
            options = arguments[1];
            callback = arguments[2];
        }
        else if (arguments[1] instanceof Function) {
            // deprecated path: no options, only callback passed in
            namespace = undefined;
            options = undefined;
            callback = arguments[1];
        }
        else {
            // either no other args passed in or desired path (namespace is 2nd arg)
            namespace = arguments[1];
            // still need to handle possible no options, but callback passed in
            if (arguments[2] instanceof Function) {
                callback = arguments[2];
                options = undefined;
            }
            else {
                options = arguments[2];
                callback = arguments[3];
            }
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        // for compatibility with older SDK versions (i.e. deprecated getDesignDocument())
        if (designDocName.startsWith('dev_')) {
            namespace = viewtypes_1.DesignDocumentNamespace.Development;
            designDocName = designDocName.substring(4);
        }
        const ns = namespace !== null && namespace !== void 0 ? namespace : viewtypes_1.DesignDocumentNamespace.Production;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementViewIndexGet({
                bucket_name: this._bucket.name,
                document_name: designDocName,
                ns: (0, bindingutilities_1.designDocumentNamespaceToCpp)(ns),
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const ddoc = DesignDocument._fromCppData(resp.document);
                wrapCallback(null, ddoc);
            });
        }, callback);
    }
    /**
     * @internal
     */
    async upsertDesignDocument() {
        const designDoc = arguments[0];
        let namespace;
        let options;
        let callback;
        // deprecated path: options and maybe callback passed in
        if (typeof arguments[1] === 'object') {
            namespace = undefined;
            options = arguments[1];
            callback = arguments[2];
        }
        else if (arguments[1] instanceof Function) {
            // deprecated path: no options, only callback passed in
            namespace = undefined;
            options = undefined;
            callback = arguments[1];
        }
        else {
            // either no other args passed in or desired path (namespace is 2nd arg)
            namespace = arguments[1];
            // still need to handle possible no options, but callback passed in
            if (arguments[2] instanceof Function) {
                callback = arguments[2];
                options = undefined;
            }
            else {
                options = arguments[2];
                callback = arguments[3];
            }
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        // for compatibility with older SDK versions (i.e. deprecated upsertDesignDocument())
        if (designDoc.name.startsWith('dev_')) {
            namespace = viewtypes_1.DesignDocumentNamespace.Development;
            designDoc.name = designDoc.name.substring(4);
        }
        const ns = namespace !== null && namespace !== void 0 ? namespace : viewtypes_1.DesignDocumentNamespace.Production;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementViewIndexUpsert({
                bucket_name: this._bucket.name,
                document: DesignDocument._toCppData(designDoc, ns),
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * @internal
     */
    async dropDesignDocument() {
        let designDocName = arguments[0];
        let namespace;
        let options;
        let callback;
        // deprecated path: options and maybe callback passed in
        if (typeof arguments[1] === 'object') {
            namespace = undefined;
            options = arguments[1];
            callback = arguments[2];
        }
        else if (arguments[1] instanceof Function) {
            // deprecated path: no options, only callback passed in
            namespace = undefined;
            options = undefined;
            callback = arguments[1];
        }
        else {
            // either no other args passed in or desired path (namespace is 2nd arg)
            namespace = arguments[1];
            // still need to handle possible no options, but callback passed in
            if (arguments[2] instanceof Function) {
                callback = arguments[2];
                options = undefined;
            }
            else {
                options = arguments[2];
                callback = arguments[3];
            }
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        // for compatibility with older SDK versions (i.e. deprecated dropDesignDocument())
        if (designDocName.startsWith('dev_')) {
            namespace = viewtypes_1.DesignDocumentNamespace.Development;
            designDocName = designDocName.substring(4);
        }
        const ns = namespace !== null && namespace !== void 0 ? namespace : viewtypes_1.DesignDocumentNamespace.Production;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementViewIndexDrop({
                bucket_name: this._bucket.name,
                document_name: designDocName,
                ns: (0, bindingutilities_1.designDocumentNamespaceToCpp)(ns),
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Publishes a development design document to be a production design document.
     * It does this by fetching the design document by the passed name with `dev_`
     * appended, and then performs an upsert of the production name (no `dev_`)
     * with the data which was just fetched.
     *
     * @param designDocName The name of the design document to publish.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async publishDesignDocument(designDocName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        const timer = new utilities_1.CompoundTimeout(timeout);
        return utilities_1.PromiseHelper.wrapAsync(async () => {
            const designDoc = await this.getDesignDocument(designDocName, viewtypes_1.DesignDocumentNamespace.Development, {
                timeout: timer.left(),
            });
            await this.upsertDesignDocument(designDoc, viewtypes_1.DesignDocumentNamespace.Production, {
                timeout: timer.left(),
            });
        }, callback);
    }
}
exports.ViewIndexManager = ViewIndexManager;
